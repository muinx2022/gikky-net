import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Core } from '@strapi/strapi';

type UploadProvider = 'local' | 'cloudinary';
const MAX_VIDEO_DURATION_SECONDS = 180;
const FFMPEG_BIN = 'ffmpeg';

const resolveAuthUserId = async (strapi: Core.Strapi, ctx: any): Promise<number | null> => {
  if (ctx.state.user?.id) {
    return Number(ctx.state.user.id);
  }

  const authHeader = ctx.request.header?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = await jwtService.verify(token);
    const userId = Number(decoded?.id);
    return Number.isFinite(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
};

const resolveAbsoluteUrl = (strapi: Core.Strapi, ctx: any, url?: string | null): string => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;

  const configuredUrl = strapi.config.get('server.url') as string | undefined;
  if (configuredUrl) {
    return new URL(url, configuredUrl).toString();
  }

  const host = ctx.request.header?.host || '127.0.0.1:1337';
  const protocol = ctx.request.header?.['x-forwarded-proto'] || ctx.protocol || 'http';
  return `${protocol}://${host}${url}`;
};

const normalizeKind = (mime?: string): 'image' | 'video' | 'file' => {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
};

const resolveDuration = (value: unknown): number | null => {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
};

const runCommand = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });

const isLikelyVideoFile = (file: any): boolean => {
  const mime = String(file?.type || file?.mimetype || file?.mime || '');
  if (mime.startsWith('video/')) return true;

  const name = String(file?.originalFilename || file?.name || '');
  return /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(name);
};

const trimVideoToMaxDuration = async (file: any): Promise<{ trimmed: boolean; cleanupPath?: string }> => {
  if (!file?.filepath || !isLikelyVideoFile(file)) {
    return { trimmed: false };
  }

  const inputPath = String(file.filepath);
  const inputExt = path.extname(inputPath) || '.mp4';
  const copyOutputPath = path.join(path.dirname(inputPath), `${path.basename(inputPath, inputExt)}-trim${inputExt}`);
  let outputPath = copyOutputPath;

  try {
    await runCommand(FFMPEG_BIN, ['-y', '-i', inputPath, '-t', String(MAX_VIDEO_DURATION_SECONDS), '-c', 'copy', outputPath]);
  } catch {
    outputPath = path.join(path.dirname(inputPath), `${path.basename(inputPath, inputExt)}-trim.mp4`);
    await runCommand(FFMPEG_BIN, [
      '-y',
      '-i',
      inputPath,
      '-t',
      String(MAX_VIDEO_DURATION_SECONDS),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
  }

  const stats = await fs.promises.stat(outputPath);
  if (!stats.size) {
    throw new Error('Trimmed video is empty.');
  }

  file.filepath = outputPath;
  file.size = stats.size;
  return { trimmed: true, cleanupPath: outputPath };
};

const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const getConfiguredProvider = (): UploadProvider => {
  const raw = String(process.env.UPLOAD_PROVIDER || 'local').trim().toLowerCase();
  return raw === 'cloudinary' ? 'cloudinary' : 'local';
};

const getSingleFile = (ctx: any) => {
  const fileInput = ctx.request.files?.file ?? ctx.request.files?.files;
  if (Array.isArray(fileInput)) {
    return fileInput[0];
  }
  return fileInput;
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async providers(ctx: any) {
    const configured = getConfiguredProvider();
    ctx.body = {
      data: [
        {
          key: configured,
          label: configured === 'cloudinary' ? 'Cloudinary' : 'Local',
          configured: configured === 'cloudinary' ? isCloudinaryConfigured() : true,
          active: true,
        },
      ],
    };
  },

  async upload(ctx: any) {
    const userId = await resolveAuthUserId(strapi, ctx);
    if (!userId) {
      return ctx.unauthorized('You must be logged in to upload files.');
    }

    const provider = getConfiguredProvider();
    const file = getSingleFile(ctx);

    if (!file) {
      return ctx.badRequest('No file provided. Expected multipart field "file".');
    }

    let originalTempPath: string | null = typeof file.filepath === 'string' ? file.filepath : null;
    let trimmedTempPath: string | null = null;
    let wasTrimmed = false;
    try {
      const trimResult = await trimVideoToMaxDuration(file);
      wasTrimmed = trimResult.trimmed;
      trimmedTempPath = trimResult.cleanupPath || null;
    } catch (error) {
      strapi.log.warn(`Failed to auto-trim uploaded video. Uploading original file instead. ${String((error as any)?.message || error)}`);
      wasTrimmed = false;
      trimmedTempPath = null;
      if (originalTempPath) {
        file.filepath = originalTempPath;
      }
    }

    if (provider === 'local') {
      const uploadService = strapi.plugin('upload').service('upload');
      const previousSettings = (await uploadService.getSettings()) || {};
      const safeSettings = {
        ...previousSettings,
        sizeOptimization: false,
        autoOrientation: false,
        responsiveDimensions: false,
      };

      let uploaded: any;
      try {
        await uploadService.setSettings(safeSettings);
        uploaded = await uploadService.upload({
          data: {},
          files: file,
        });
      } finally {
        await uploadService.setSettings(previousSettings);
      }

      const uploadedFile = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      if (!uploadedFile) {
        return ctx.badRequest('Unable to upload file to local provider.');
      }

      const mime = uploadedFile.mime as string | undefined;
      const kind = normalizeKind(mime);
      const duration = resolveDuration((uploadedFile as any).duration);

      ctx.body = {
        data: {
          id: uploadedFile.id,
          provider: 'local',
          name: uploadedFile.name,
          url: resolveAbsoluteUrl(strapi, ctx, uploadedFile.url),
          mime,
          size: uploadedFile.size,
          width: uploadedFile.width ?? null,
          height: uploadedFile.height ?? null,
          duration,
          trimmed: wasTrimmed,
          kind,
        },
      };

      if (originalTempPath && originalTempPath !== file.filepath) {
        fs.promises.unlink(originalTempPath).catch(() => undefined);
      }
      if (trimmedTempPath) {
        fs.promises.unlink(trimmedTempPath).catch(() => undefined);
      }
      return;
    }

    if (!isCloudinaryConfigured()) {
      return ctx.badRequest('Cloudinary is not configured on server.');
    }

    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });

    const result = await cloudinary.uploader.upload(file.filepath, {
      resource_type: 'auto',
      folder: String(ctx.request.body?.folder || 'forgefeed'),
      use_filename: true,
      unique_filename: true,
    });

    const mime = String(result.resource_type || '').startsWith('video')
      ? `video/${result.format || 'mp4'}`
      : `image/${result.format || 'jpeg'}`;
    const kind = normalizeKind(mime);
    const duration = resolveDuration(result.duration);

    if (file.filepath) {
      fs.promises
        .unlink(file.filepath)
        .catch(() => undefined);
    }
    if (originalTempPath && originalTempPath !== file.filepath) {
      fs.promises.unlink(originalTempPath).catch(() => undefined);
    }

    ctx.body = {
      data: {
        id: result.public_id,
        provider: 'cloudinary',
        name: file.originalFilename || result.original_filename || result.public_id,
        url: result.secure_url,
        mime,
        size: Number(result.bytes || 0),
        width: result.width ?? null,
        height: result.height ?? null,
        duration,
        trimmed: wasTrimmed,
        kind,
      },
    };
  },
});
