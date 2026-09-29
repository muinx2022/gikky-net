import subprocess
import os
import sys
import shutil
import imageio_ffmpeg

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_DIR = os.path.join(BASE_DIR, "lo_b_temp")
AUDIO_DIR = os.path.join(TEMP_DIR, "audio")
PUBLIC_DIR = r"d:\Projects\gikky-net\apps\web\public"

YT_SCENES = [
    {"video": "yt_scene_1.webm", "audio": "yt_scene_1.mp3", "clip": "yt_clip_1.mp4"},
    {"video": "yt_scene_2.webm", "audio": "yt_scene_2.mp3", "clip": "yt_clip_2.mp4"},
    {"video": "yt_scene_3.webm", "audio": "yt_scene_3.mp3", "clip": "yt_clip_3.mp4"},
    {"video": "yt_scene_4.webm", "audio": "yt_scene_4.mp3", "clip": "yt_clip_4.mp4"},
    {"video": "yt_scene_5.webm", "audio": "yt_scene_5.mp3", "clip": "yt_clip_5.mp4"},
]

SHORT_SCENES = [
    {"video": "short_scene_1.webm", "audio": "short_scene_1.mp3", "clip": "short_clip_1.mp4"},
    {"video": "short_scene_2.webm", "audio": "short_scene_2.mp3", "clip": "short_clip_2.mp4"},
    {"video": "short_scene_3.webm", "audio": "short_scene_3.mp3", "clip": "short_clip_3.mp4"},
    {"video": "short_scene_4.webm", "audio": "short_scene_4.mp3", "clip": "short_clip_4.mp4"},
    {"video": "short_scene_5.webm", "audio": "short_scene_5.mp3", "clip": "short_clip_5.mp4"},
]

def get_duration(file_path):
    cmd = [FFMPEG, "-i", file_path]
    p = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True, errors="ignore")
    for line in p.stderr.splitlines():
        if "Duration:" in line:
            time_str = line.split("Duration:")[1].split(",")[0].strip()
            parts = time_str.split(":")
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    return 10.0

def process_scenes(scenes_list, output_name, title_prefix):
    print(f"\n🎬 === Bắt đầu xử lý {title_prefix} ===")
    clips = []
    for idx, s in enumerate(scenes_list, 1):
        v_path = os.path.join(TEMP_DIR, s["video"])
        a_path = os.path.join(AUDIO_DIR, s["audio"])
        clip_path = os.path.join(TEMP_DIR, s["clip"])

        a_dur = get_duration(a_path)
        clip_dur = a_dur + 0.25
        print(f" -> Phân cảnh {idx}: {s['clip']} (Thời lượng audio: {a_dur:.2f}s, Clip: {clip_dur:.2f}s)...")

        cmd = [
            FFMPEG, "-y",
            "-i", v_path,
            "-i", a_path,
            "-t", str(clip_dur),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "20",
            "-r", "30",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            clip_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors="ignore")
        if res.returncode != 0:
            print(f"❌ Lỗi ghép {s['clip']}:", res.stderr)
            raise RuntimeError(res.stderr)
        clips.append(clip_path)

    # Concat
    concat_txt = os.path.join(TEMP_DIR, f"concat_{output_name}.txt")
    with open(concat_txt, "w", encoding="utf-8") as f:
        for c in clips:
            f.write(f"file '{c.replace(os.sep, '/')}'\n")

    final_local = os.path.join(TEMP_DIR, f"{output_name}.mp4")
    print(f" -> Ghép toàn bộ {len(clips)} phân cảnh thành video {output_name}.mp4...")

    cmd_concat = [
        FFMPEG, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_txt,
        "-c", "copy",
        final_local
    ]
    subprocess.run(cmd_concat, check=True)

    final_size = os.path.getsize(final_local)
    final_dur = get_duration(final_local)
    print(f"✅ Hoàn tất: {final_local}")
    print(f"   Dung lượng: {final_size / (1024*1024):.2f} MB | Thời lượng: {final_dur:.2f}s")

    # Copy to apps/web/public
    if os.path.exists(PUBLIC_DIR):
        pub_dest = os.path.join(PUBLIC_DIR, f"{output_name}.mp4")
        shutil.copyfile(final_local, pub_dest)
        print(f"🚀 Đã sao chép vào thư mục public: {pub_dest}")

    return final_local

def main():
    print("🚀 Bắt đầu quá trình ghép Audio + Video hoàn chỉnh cho Lô B Ô Môn...")

    # 1. YouTube 16:9
    yt_out = process_scenes(YT_SCENES, "gikky_youtube_lo_b_o_mon_16x9", "YouTube 16:9")

    # 2. Short 9:16
    short_out = process_scenes(SHORT_SCENES, "gikky_short_lo_b_o_mon_9x16", "Short/Reels 9:16")

    # 3. Copy Thumbnail
    thumb_src = os.path.join(TEMP_DIR, "youtube_thumbnail_lo_b.png")
    if os.path.exists(thumb_src):
        thumb_dest = os.path.join(PUBLIC_DIR, "gikky_thumbnail_lo_b_16x9.png")
        shutil.copyfile(thumb_src, thumb_dest)
        print(f"🖼️ Đã sao chép Thumbnail vào: {thumb_dest}")

    print("\n🎉 HOÀN TẤT TOÀN BỘ QUÁ TRÌNH XUẤT BẢN FILE VIDEO MP4!")

if __name__ == "__main__":
    main()
