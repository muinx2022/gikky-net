import asyncio
import os
import sys
import edge_tts

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')


SCRATCH_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_AUDIO_DIR = os.path.join(SCRATCH_DIR, "tam_audio")
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)

VOICE = "vi-VN-NamMinhNeural"
RATE = "-2%"
PITCH = "-1Hz"

# YouTube 16:9 Long-Form Script (5 Scenes)
YT_SEGMENTS = [
    {
        "id": "yt_scene_1",
        "text": "Chào mừng anh em trader đã quay trở lại với Gikky. Trong phân tích kỹ thuật, Fibonacci 61.8% được mệnh danh là Tỷ Lệ Vàng của tự nhiên, nơi mà hàng triệu trader tin rằng giá nhất định sẽ bật tăng. Nhưng thực tế tàn khốc là: Đây cũng chính là cái bẫy chết người khiến vô số tài khoản bốc hơi chỉ sau một đêm. Tại sao một công cụ kinh điển lại biến thành cái bẫy dao rơi? Hãy cùng mổ xẻ ngay sau đây."
    },
    {
        "id": "yt_scene_2",
        "text": "Hãy nhìn vào nhịp giảm từ 1.0950 về 1.0800. Khi giá vừa chạm mốc 61.8%, một cây nến rút chân nhẹ xuất hiện, kích hoạt ngay tâm lý tham lam của các trader bắt đáy. Nhưng thay vì một nhịp điều chỉnh cạn kiệt thanh khoản, cây nến tiếp theo là một cây Marubozu giảm thân đặc với khối lượng đột biến. Dòng tiền thông minh không gom hàng ở đây, mà họ đang tận dụng sự ngây thơ của đám đông để xả hàng ồ ạt. Bắt đáy khi chưa có nến xác nhận thực chất chỉ là hành vi hứng một lưỡi dao đang rơi."
    },
    {
        "id": "yt_scene_3",
        "text": "Khi giá tiếp tục lao dốc và đâm thủng mốc cắt lỗ 1.0750, sự khác biệt giữa trader nghiệp dư và chuyên nghiệp bắt đầu lộ rõ. Kẻ nghiệp dư sẽ tiếc nuối, nới rộng Stop Loss, thậm chí nhồi thêm lệnh để bình quân giá xuống. Kết quả: Khi giá rơi tự do về 1.0640, họ phải gánh khoản lỗ lên tới âm 3.2R. Ngược lại, việc tuân thủ kỷ luật cắt lỗ dứt khoát tại âm 1.0R đã giúp chúng ta rời cuộc chơi với mức thiệt hại tối thiểu, bảo toàn nguyên vẹn 99% tài sản."
    },
    {
        "id": "yt_scene_4",
        "text": "Để không bao giờ trở thành thanh khoản cho thị trường, hãy khắc ghi 3 nguyên tắc thép: Thứ nhất, Fibonacci chỉ là vùng hỗ trợ tiềm năng, không phải bức tường bê tông. Luôn đợi nến Price Action đảo chiều như Pin Bar hoặc Bullish Engulfing xác nhận trước khi vào lệnh. Thứ hai, tuyệt đối không bình quân giá một vị thế đang thua lỗ. Và thứ ba, ghi chép nhật ký lệnh trước khi nến chạy để loại bỏ hoàn toàn cảm xúc bốc đồng."
    },
    {
        "id": "yt_scene_5",
        "text": "Đó chính là cách chúng tôi rèn luyện kỷ luật và quản trị rủi ro mỗi ngày trên gikky chấm nét. Một nền tảng minh bạch ghi lại từng mốc vào lệnh, quản trị lệnh và đóng lệnh theo thời gian thực. Hãy truy cập ngay gikky chấm nét để khám phá các chuỗi lệnh thực chiến và nâng tầm tư duy giao dịch của bạn. Đừng quên bấm Đăng ký kênh và chuông thông báo để không bỏ lỡ những video tiếp theo nhé!"
    }
]

# TikTok / Shorts 9:16 Script (5 Scenes, fast & punchy)
SHORT_SEGMENTS = [
    {
        "id": "short_scene_1",
        "text": "Đừng bao giờ vội vàng bắt đáy ở Fibonacci 61.8% nếu bạn không muốn tài khoản bốc hơi trong tích tắc!"
    },
    {
        "id": "short_scene_2",
        "text": "Nhiều người lầm tưởng Fibo 61.8% là đáy cứng. Nhưng khi dòng tiền lớn xả hàng, một cây nến Marubozu đỏ quạch có thể đâm thủng vùng vàng này dễ như chém vào bùn."
    },
    {
        "id": "short_scene_3",
        "text": "Sai lầm chết người là nới Stop Loss và bình quân giá xuống. Nhìn xem: Cắt lỗ kỷ luật chỉ mất đúng 1R, trong khi cố chấp gồng lệnh sẽ khiến bạn ăn trọn cú rơi âm 3.2R cháy sạch ví."
    },
    {
        "id": "short_scene_4",
        "text": "Nhớ lấy: Luôn chờ nến đảo chiều xác nhận. Không có tín hiệu, tuyệt đối không thò tay bắt dao rơi!"
    },
    {
        "id": "short_scene_5",
        "text": "Theo dõi toàn bộ nhật ký lệnh thực chiến minh bạch tại gikky chấm nét. Link ở phần tiểu sử nhé!"
    }
]

async def generate_audio():
    print(f"Bắt đầu sinh âm thanh bằng giọng: {VOICE} (rate={RATE}, pitch={PITCH})...")
    
    for seg in YT_SEGMENTS:
        out_file = os.path.join(TEMP_AUDIO_DIR, f"{seg['id']}.mp3")
        c = edge_tts.Communicate(seg["text"], VOICE, rate=RATE, pitch=PITCH)
        await c.save(out_file)
        print(f" [YT] Sinh xong: {seg['id']}.mp3")

    for seg in SHORT_SEGMENTS:
        out_file = os.path.join(TEMP_AUDIO_DIR, f"{seg['id']}.mp3")
        c = edge_tts.Communicate(seg["text"], VOICE, rate=RATE, pitch=PITCH)
        await c.save(out_file)
        print(f" [Short] Sinh xong: {seg['id']}.mp3")

    print(f"==> Hoàn tất 10 file audio tại: {TEMP_AUDIO_DIR}")

if __name__ == "__main__":
    asyncio.run(generate_audio())
