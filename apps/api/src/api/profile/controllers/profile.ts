import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async getMe(ctx) {
    const userId = ctx.state?.user?.id;
    if (!userId) return ctx.unauthorized();

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      populate: { avatar: true },
    });

    if (!user) return ctx.notFound();

    ctx.body = {
      id: user.id,
      username: (user as any).username,
      email: (user as any).email,
      bio: (user as any).bio ?? null,
      avatar: (user as any).avatar ?? null,
    };
  },

  async getByUsername(ctx) {
    const { username } = ctx.params;
    if (!username) return ctx.badRequest('Username is required');

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { username: { $eqi: String(username).trim() } as any },
      populate: { avatar: true },
    });

    if (!user) return ctx.notFound();

    ctx.body = {
      id: user.id,
      username: (user as any).username,
      bio: (user as any).bio ?? null,
      avatar: (user as any).avatar ?? null,
      createdAt: (user as any).createdAt ?? null,
    };
  },

  async updateMe(ctx) {
    const userId = ctx.state?.user?.id;
    if (!userId) return ctx.unauthorized();

    const body = ctx.request.body as Record<string, unknown>;
    const allowed: Record<string, unknown> = {};

    if (typeof body.bio === 'string' || body.bio === null) {
      allowed.bio = body.bio;
    }
    if (typeof body.username === 'string' && body.username.trim()) {
      allowed.username = body.username.trim();
    }
    if (body.avatar !== undefined) {
      // Accept media id (number) or null to remove
      allowed.avatar = body.avatar === null ? null : Number(body.avatar) || null;
    }

    if (Object.keys(allowed).length === 0) {
      return ctx.badRequest('No valid fields to update');
    }

    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: userId },
      data: allowed,
    });

    // Re-fetch with populated avatar
    const updated = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      populate: { avatar: true },
    });

    ctx.body = {
      id: (updated as any).id,
      username: (updated as any).username,
      email: (updated as any).email,
      bio: (updated as any).bio ?? null,
      avatar: (updated as any).avatar ?? null,
    };
  },
});
