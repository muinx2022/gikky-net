import asyncio
import os
import sys
import edge_tts

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

VOICE = "vi-VN-NamMinhNeural"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lo_b_temp", "audio")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. YouTube 16:9 Scripts (5 Scenes)
YT_SCRIPTS = [
    {
        "id": "yt_scene_1",
        "text": "Cách bờ biển Tây Nam gần ba trăm cây số, một mỏ khí tự nhiên khổng lồ dưới đáy biển sâu đang nắm giữ chìa khóa an ninh năng lượng cho cả vùng kinh tế trọng điểm phía Nam. Đó là Lô B Ô Môn, đại công trình trị giá gần mười hai tỷ đô la. Khi các mỏ khí truyền thống tại bể Nam Côn Sơn và Cửu Long đang cạn kiệt nhanh chóng từ mười lăm đến hai mươi phần trăm mỗi năm, Lô B không chỉ là một dự án khai thác dầu khí, mà là nguồn điện nền sống còn để giữ cho lưới điện quốc gia luôn vận hành ổn định."
    },
    {
        "id": "yt_scene_2",
        "text": "Sức nặng của Lô B nằm ở chuỗi liên kết ba tầng chặt chẽ. Thượng nguồn ngoài khơi với sáu phẩy bảy tỷ đô la gồm một giàn xử lý trung tâm nặng hơn hai mươi nghìn tấn và gần một nghìn giếng khoan, trữ lượng một trăm lẻ bảy tỷ mét khối khí. Trung nguồn là tuyến đường ống dài bốn trăm ba mươi mốt cây số xuyên qua đáy biển vào đất liền trị giá một phẩy ba tỷ đô la. Và hạ nguồn là Cụm nhiệt điện Ô Môn bốn phẩy năm tỷ đô la với bốn nhà máy, tổng công suất ba nghìn tám trăm mười Mê-ga-oát, cung cấp hơn hai mươi tỷ ki-lô-oát-giờ điện mỗi năm, tương đương tám phần trăm sản lượng điện cả nước."
    },
    {
        "id": "yt_scene_3",
        "text": "Dù tiềm năng khổng lồ, dự án từng đình trệ gần hai mươi năm bởi hai nút thắt cơ chế. Đầu tiên là bài toán chuyển ngang giá khí: khí Lô B xa bờ và chứa nhiều tạp chất khiến giá thành về đến bờ dao động từ chín phẩy năm đến mười hai đô la một triệu B-T-U, cao hơn nhiều so với khí truyền thống. Thứ hai là cam kết bao tiêu tối thiểu: bên khai thác đòi hỏi bao tiêu tám mươi phần trăm sản lượng khí để tránh rủi ro sập giếng, buộc bên mua điện phải cam kết sản lượng điện huy động tương ứng, tạo nên áp lực tài chính rất lớn trong đàm phán hợp đồng P-P-A."
    },
    {
        "id": "yt_scene_4",
        "text": "Khi các gói thầu trao thầu hạn chế được kích hoạt, chuỗi cung ứng trong nước chính là bên hưởng lợi trực tiếp nhất. Khối lượng công việc khổng lồ từ chế tạo giàn ngoài khơi, bọc ống ngầm và dịch vụ giàn khoan biển mở ra chu kỳ tăng trưởng doanh thu kỷ lục kéo dài năm đến mười năm cho các nhà thầu cơ khí Việt Nam như P-V-S, P-V-D hay P-V-B. Đây là phép thử đỉnh cao khẳng định năng lực làm chủ công trình biển siêu trường siêu trọng của kỹ sư Việt."
    },
    {
        "id": "yt_scene_5",
        "text": "Lô B Ô Môn không chỉ là câu chuyện của những khối thép trên biển, mà là minh chứng cho năng lực điều phối chính sách và quyết tâm bảo đảm an ninh năng lượng cho tương lai phát triển của Việt Nam. Để theo dõi những phân tích chuyên sâu về kinh tế vĩ mô, chuỗi giá trị ngành và dòng tiền thị trường, mời bạn bấm đăng ký kênh và truy cập gikky chấm nét mỗi ngày."
    }
]

# 2. Short/TikTok/Reels 9:16 Scripts (5 Scenes)
SHORT_SCRIPTS = [
    {
        "id": "short_scene_1",
        "text": "Mười hai tỷ đô la dưới đáy biển Tây Nam! Đại dự án Lô B Ô Môn có gì mà quyết định vận mệnh an ninh năng lượng của cả miền Nam?"
    },
    {
        "id": "short_scene_2",
        "text": "Trữ lượng một trăm lẻ bảy tỷ mét khối khí ngoài khơi, dẫn qua bốn trăm ba mươi mốt cây số đường ống biển, cấp cho bốn nhà máy điện Ô Môn với tổng công suất ba nghìn tám trăm mười Mê-ga-oát."
    },
    {
        "id": "short_scene_3",
        "text": "Vì sao từng tắc nghẽn gần hai mươi năm? Nút thắt nằm ở giá khí mười đến mười hai đô la và cam kết bao tiêu tám mươi phần trăm sản lượng trong hợp đồng mua bán điện P-P-A!"
    },
    {
        "id": "short_scene_4",
        "text": "Khi nút thắt được gỡ bỏ, các nhà thầu cơ khí biển trong nước như P-V-S, P-V-D bước vào chu kỳ việc làm khổng lồ kéo dài nhiều năm."
    },
    {
        "id": "short_scene_5",
        "text": "Khám phá các góc nhìn vĩ mô và chuỗi giá trị chuyên sâu tại gikky chấm nét. Bấm theo dõi kênh ngay hôm nay!"
    }
]

async def run():
    all_scripts = YT_SCRIPTS + SHORT_SCRIPTS
    print(f"🎙️ Bắt đầu tạo {len(all_scripts)} tệp audio cho Lô B Ô Môn...")

    for item in all_scripts:
        sid = item["id"]
        out_f = os.path.join(OUTPUT_DIR, f"{sid}.mp3")

        if os.path.exists(out_f) and os.path.getsize(out_f) > 5000:
            print(f"⏩ Đã tồn tại {sid} ({os.path.getsize(out_f):,} bytes), bỏ qua.")
            continue

        print(f"-> Đang tạo {sid}...")
        success = False
        for attempt in range(1, 5):
            try:
                c = edge_tts.Communicate(item["text"], VOICE, rate="-2%", pitch="-1Hz")
                await c.save(out_f)
                if os.path.exists(out_f) and os.path.getsize(out_f) > 5000:
                    print(f"   ✅ Xong {sid} (lần {attempt}, {os.path.getsize(out_f):,} bytes)")
                    success = True
                    break
            except Exception as e:
                print(f"   ⚠️ Lỗi {sid} lần {attempt}: {e}")
                await asyncio.sleep(2.5)

        if not success:
            # Thử lại không rate/pitch
            try:
                print(f"   Thử lại {sid} với cấu hình mặc định...")
                c = edge_tts.Communicate(item["text"], VOICE)
                await c.save(out_f)
                if os.path.exists(out_f) and os.path.getsize(out_f) > 5000:
                    print(f"   ✅ Xong {sid} mặc định ({os.path.getsize(out_f):,} bytes)")
                    success = True
            except Exception as e:
                print(f"   ❌ Thất bại {sid}: {e}")

        await asyncio.sleep(1.5)

    print("🎉 HOÀN TẤT TOÀN BỘ ÂM THANH!")

if __name__ == "__main__":
    asyncio.run(run())
