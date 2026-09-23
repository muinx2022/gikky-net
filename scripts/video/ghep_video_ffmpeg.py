import subprocess
import os
import shutil
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

FFMPEG = r"C:\Users\Ng Xuan Mui\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
SCRATCH_DIR = os.path.dirname(os.path.abspath(__file__))
SLIDES_DIR = os.path.join(SCRATCH_DIR, "slides")
AUDIO_DIR = os.path.join(SCRATCH_DIR, "tam_audio")
PUBLIC_DIR = r"d:\Projects\gikky-net\apps\web\public"

YT_SCENES = [
    {"slide": "yt_slide_1.png", "audio": "yt_scene_1.mp3", "clip": "yt_clip_1.mp4"},
    {"slide": "yt_slide_2.png", "audio": "yt_scene_2.mp3", "clip": "yt_clip_2.mp4"},
    {"slide": "yt_slide_3.png", "audio": "yt_scene_3.mp3", "clip": "yt_clip_3.mp4"},
    {"slide": "yt_slide_4.png", "audio": "yt_scene_4.mp3", "clip": "yt_clip_4.mp4"},
    {"slide": "yt_slide_5.png", "audio": "yt_scene_5.mp3", "clip": "yt_clip_5.mp4"}
]

SHORT_SCENES = [
    {"slide": "short_slide_1.png", "audio": "short_scene_1.mp3", "clip": "short_clip_1.mp4"},
    {"slide": "short_slide_2.png", "audio": "short_scene_2.mp3", "clip": "short_clip_2.mp4"},
    {"slide": "short_slide_3.png", "audio": "short_scene_3.mp3", "clip": "short_clip_3.mp4"},
    {"slide": "short_slide_4.png", "audio": "short_scene_4.mp3", "clip": "short_clip_4.mp4"},
    {"slide": "short_slide_5.png", "audio": "short_scene_5.mp3", "clip": "short_clip_5.mp4"}
]

def get_audio_duration(audio_path):
    cmd = [FFMPEG, "-i", audio_path]
    p = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True, errors="ignore")
    for line in p.stderr.splitlines():
        if "Duration:" in line:
            time_str = line.split("Duration:")[1].split(",")[0].strip()
            parts = time_str.split(":")
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    return 10.0

def build_clips(scenes, res_w, res_h):
    clips = []
    for s in scenes:
        img_path = os.path.join(SLIDES_DIR, s["slide"])
        audio_path = os.path.join(AUDIO_DIR, s["audio"])
        clip_path = os.path.join(SCRATCH_DIR, s["clip"])
        dur = get_audio_duration(audio_path) + 0.35
        print(f" -> Đang render clip {s['clip']} ({dur:.2f}s)...")
        
        cmd = [
            FFMPEG, "-y",
            "-loop", "1",
            "-i", img_path,
            "-i", audio_path,
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-r", "30",
            "-t", f"{dur:.2f}",
            "-shortest",
            clip_path
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        clips.append(clip_path)
    return clips

def assemble_video(clips, out_filename):
    concat_txt = os.path.join(SCRATCH_DIR, f"concat_{out_filename}.txt")
    with open(concat_txt, "w", encoding="utf-8") as f:
        for c in clips:
            f.write(f"file '{c.replace(chr(92), '/')}'\n")

    out_scratch = os.path.join(SCRATCH_DIR, out_filename)
    out_public = os.path.join(PUBLIC_DIR, out_filename)

    cmd = [
        FFMPEG, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_txt,
        "-c", "copy",
        out_scratch
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    shutil.copyfile(out_scratch, out_public)
    print(f" ==> ĐÃ XUẤT XƯỞNG: {out_public} (Kích thước: {os.path.getsize(out_public):,} bytes)")

def main():
    print("==================================================")
    print("GHÉP VIDEO CHỦ ĐỀ CHÊNH LỆCH GIÁ VÀNG CHO GIKKY.NET")
    print("==================================================")

    # 1. Ghép YouTube 16:9 Video
    print("\n1. Render Video YouTube 16:9 Full HD (1920x1080)...")
    yt_clips = build_clips(YT_SCENES, 1920, 1080)
    assemble_video(yt_clips, "gikky_youtube_gia_vang_chenh_lech_16x9.mp4")

    # 2. Ghép TikTok / Shorts 9:16 Video
    print("\n2. Render Video TikTok / Shorts 9:16 (1080x1920)...")
    short_clips = build_clips(SHORT_SCENES, 1080, 1920)
    assemble_video(short_clips, "gikky_short_gia_vang_chenh_lech.mp4")

    # 3. Copy Thumbnail vào apps/web/public/
    thumb_src = os.path.join(SLIDES_DIR, "youtube_thumbnail_gia_vang_chenh_lech.png")
    thumb_dst = os.path.join(PUBLIC_DIR, "youtube_thumbnail_gia_vang_chenh_lech.png")
    shutil.copyfile(thumb_src, thumb_dst)
    print(f"\n3. ĐÃ XUẤT THUMBNAIL: {thumb_dst}")

    print("\n===> HOÀN TẤT TOÀN BỘ TIẾN TRÌNH SẢN XUẤT THÀNH PHẨM!")

if __name__ == "__main__":
    main()
