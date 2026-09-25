import os
import sys
import asyncio
import edge_tts

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

VOICE = "vi-VN-NamMinhNeural"
TEMP_AUDIO_DIR = "scripts/video/tam_audio"

YT_REMAINING = [
    {
        "id": "yt_scene_3",
        "text": "Ngược lại, đây là cách các nhà giao dịch chuyên nghiệp tạo dựng gia tài bền vững với tỷ lệ thắng chỉ vỏn vẹn bốn mươi phần trăm. Họ chấp nhận sai sáu lần trên mười lệnh giao dịch! Nhưng sự khác biệt sống còn nằm ở tỷ lệ Risk Reward một ba: Mỗi lần sai, họ kỷ luật cắt lỗ dứt khoát tại chuẩn âm một R, tức mất một triệu đồng, tổng cộng sáu lệnh thua mất sáu triệu. Nhưng ở bốn lệnh đúng, họ kiên nhẫn để lãi chạy tối đa chạm mốc ba R, thu về ba triệu mỗi lệnh, tổng cộng mười hai triệu đồng. Lấy mười hai triệu tiền thắng trừ sáu triệu tiền thua, tài khoản vẫn tăng trưởng dương sáu triệu đồng lợi nhuận ròng! Đúng ít hơn sai, tài khoản vẫn nhân đôi bền bỉ."
    },
    {
        "id": "yt_scene_4",
        "text": "Huyền thoại đầu cơ George Soros từng đúc kết một chân lý bất hủ: Vấn đề không phải là bạn đúng hay sai, mà là bạn kiếm được bao nhiêu tiền khi bạn đúng, và bạn mất bao nhiêu tiền khi bạn sai. Để làm chủ cuộc chơi này, trader bắt buộc phải dẹp bỏ cái tôi háo thắng, ngừng khoe tỷ lệ thắng trên mạng xã hội, và học cách chấp nhận những lệnh thua nhỏ như một khoản chi phí kinh doanh bắt buộc. Thua một R trong kỷ luật không phải là thất bại, mà là chiếc vé bảo hiểm rẻ nhất để bạn bảo toàn vốn và chờ đón những cơn sóng lớn ăn trọn ba R hoặc năm R."
    },
    {
        "id": "yt_scene_5",
        "text": "Thành công trên thị trường không thuộc về người đoán đúng một trăm phần trăm, mà thuộc về người sở hữu kỳ vọng toán học dương và kỷ luật thép để thực thi nó qua hàng trăm lệnh. Hãy truy cập ngay gikky chấm nét để khám phá chuỗi nhật ký lệnh thực chiến minh bạch, nơi mọi thương vụ thắng lớn hay bài học cắt lỗ đều được công khai thời gian thực. Đừng quên bấm Đăng ký kênh @gikky-net và bật chuông thông báo để cùng nâng tầm tư duy giao dịch nhé!"
    }
]

SHORT_SEGMENTS = [
    {
        "id": "short_scene_1",
        "text": "Bạn có tin: Thắng tám mươi phần trăm số lệnh vẫn cháy tài khoản, còn chỉ cần đúng bốn mươi phần trăm lại kiếm được gia tài?"
    },
    {
        "id": "short_scene_2",
        "text": "Thắng tám lệnh chốt non được tám triệu, nhưng dính đúng hai lệnh gồng lỗ mất mười triệu. Tài khoản âm ròng hai triệu đồng!"
    },
    {
        "id": "short_scene_3",
        "text": "Ngược lại, đúng bốn lệnh ăn ba R được mười hai triệu, sai sáu lệnh cắt lỗ một R mất sáu triệu. Bạn vẫn bỏ túi sáu triệu tiền lãi!"
    },
    {
        "id": "short_scene_4",
        "text": "George Soros từng nói: Quan trọng là bạn kiếm bao nhiêu khi đúng, và mất bao nhiêu tiền khi sai!"
    },
    {
        "id": "short_scene_5",
        "text": "Học cách quản trị vốn và xem nhật ký lệnh thực chiến minh bạch tại gikky chấm nét nhé anh em!"
    }
]

async def run():
    all_segs = YT_REMAINING + SHORT_SEGMENTS
    for s in all_segs:
        sid = s["id"]
        out_f = os.path.join(TEMP_AUDIO_DIR, f"{sid}.mp3")
        print(f"-> Đang sinh {sid}...")
        for attempt in range(1, 4):
            try:
                c = edge_tts.Communicate(s["text"], VOICE)
                await c.save(out_f)
                if os.path.exists(out_f) and os.path.getsize(out_f) > 5000:
                    print(f"   Xong {sid} ({os.path.getsize(out_f):,} bytes)")
                    break
            except Exception as e:
                print(f"   Lỗi {sid} lần {attempt}: {e}")
                await asyncio.sleep(2)
        await asyncio.sleep(1.5)
    print("==> HOÀN TẤT TOÀN BỘ AUDIO!")

if __name__ == "__main__":
    asyncio.run(run())
