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
        "text": "Chào mừng anh em trader đã quay trở lại với Gikky. Trong giao dịch kỹ thuật, không có khoảnh khắc nào kích thích lòng tham tột độ bằng một cây nến xanh thân đặc bứt phá qua vùng đỉnh kháng cự với khối lượng bùng nổ. Tại vùng cản then chốt năm mươi hai nghìn đồng, sau chuỗi hồi phục từ đáy bốn mươi sáu, một cây nến breakout xuất hiện kèm thanh khoản gấp đôi trung bình hai mươi phiên. Kế hoạch mua theo đà bứt phá được kích hoạt ngay lập tức tại năm mươi hai phẩy năm, với điểm dừng lỗ đặt tại năm mươi phẩy năm, tương ứng rủi ro chuẩn một R, và mục tiêu lợi nhuận năm mươi bảy phẩy năm, tỷ lệ R:R một hai phẩy năm. Một setup tưởng như hoàn hảo theo sách giáo khoa, nhưng thực tế tàn khốc của thị trường đã bắt đầu giăng bẫy."
    },
    {
        "id": "yt_scene_2",
        "text": "Ngay sau khi khớp lệnh, cây nến tiếp theo rướn lên năm mươi ba phẩy hai nhưng lập tức bị xả ngược dữ dội, để lại bóng nến phía trên dài ngoẵng dạng Bắn sao Shooting Star. Liền sau đó, một cây nến đỏ đặc dài Bearish Engulfing xuất hiện, nhấn chìm toàn bộ đà tăng trước đó và kéo giá rơi tuột trở lại dưới năm mươi hai. Mổ xẻ nguyên nhân kỹ thuật, thất bại này bắt nguồn từ việc nhịp tăng trước đó dốc đứng hình chữ V mà không hề có nền tích lũy hay nhịp co hẹp biên độ VCP lành mạnh. Cú bứt phá thực chất là một pha rướn kiệt sức. Khối lượng bùng nổ không phải là lực gom hàng của dòng tiền thông minh, mà là các tay to đang đặt lệnh bán đối ứng khổng lồ để xả hàng cho đám đông mua đuổi FOMO."
    },
    {
        "id": "yt_scene_3",
        "text": "Khi thị giá trượt dần về vùng năm mươi mốt phẩy hai, tài khoản chịu khoản lỗ tạm tính âm không phẩy sáu lăm R. Đây chính là thời điểm tâm lý trader bị thử thách khốc liệt nhất. Chúng tôi tuân thủ tuyệt đối ba nguyên tắc thép: Không nới rộng Stop Loss, không gồng lỗ vô căn cứ, và tuyệt đối không nhồi lệnh bình quân giá xuống. Khi lực cầu biến mất và giá đâm thủng năm mươi phẩy năm, hệ thống tự động kích hoạt cắt lỗ dứt khoát tại âm một R. Và hãy nhìn xem điều gì diễn ra sau đó: Thị trường rơi tự do không phanh qua năm mươi, bốn mươi chín và lao dốc về tận bốn mươi bảy phẩy hai, sụt giảm hơn mười phần trăm từ đỉnh. Khoản cắt lỗ âm một R đã hoàn thành xuất sắc sứ mệnh làm bức tường lửa, cứu sống chín mươi chín phần trăm tài sản của bạn."
    },
    {
        "id": "yt_scene_4",
        "text": "Nhìn lại trận đánh, bài học đắt giá nhất chính là cạm bẫy tâm lý sợ bỏ lỡ cơ hội. Càng sợ lỡ chuyến tàu, trader càng vội vã mua đuổi ở mức giá bất lợi nhất và trở thành thanh khoản rút lui cho kẻ khác. Trong trading, không làm gì cũng là một vị thế. Nếu kiên nhẫn chờ cây nến ngày đóng cửa hoặc chờ nhịp retest kiểm định cản, bạn đã hoàn toàn đứng ngoài cuộc thảm sát. Hãy nhớ rằng: Cắt lỗ âm một R không phải là thất bại, mà là chi phí vận hành bắt buộc của nghề kinh doanh xác suất. Nhờ cắt lỗ nhỏ, bạn bảo toàn trọn vẹn vốn liếng để bình thản nắm bắt các cơ hội thắng lớn phía trước."
    },
    {
        "id": "yt_scene_5",
        "text": "Đó chính là cách chúng tôi minh bạch hóa mọi thương vụ trên gikky chấm nét, từ những deal thắng lớn cho tới những bài học cắt lỗ kỷ luật. Hãy truy cập ngay gikky chấm nét để khám phá chuỗi nhật ký lệnh thực chiến thời gian thực và nâng tầm tư duy giao dịch của bạn. Đừng quên bấm Đăng ký kênh @gikky-net và bật chuông thông báo để không bỏ lỡ những video tiếp theo nhé!"
    }
]

# TikTok / Shorts 9:16 Script (5 Scenes)
SHORT_SEGMENTS = [
    {
        "id": "short_scene_1",
        "text": "Cây nến breakout vượt đỉnh đẹp như mơ này thực chất là một cái bẫy Bull Trap chết người!"
    },
    {
        "id": "short_scene_2",
        "text": "Thấy nến xanh bùng nổ volume, đám đông ồ ạt mua đuổi ở năm mươi hai phẩy năm. Nhưng sự thật là Smart Money đang xả hàng đối ứng để phân phối đỉnh!"
    },
    {
        "id": "short_scene_3",
        "text": "Nến Shooting Star xuất hiện, giá quay đầu lao dốc. Nhờ kỷ luật ba không, lệnh tự động cắt lỗ chuẩn một R tại năm mươi phẩy năm, trước khi giá sập thẳng về bốn mươi bảy phẩy hai."
    },
    {
        "id": "short_scene_4",
        "text": "Thà kiên nhẫn chờ retest kiểm định cản, còn hơn vội vã mua đuổi để rồi ôm khoản lỗ mười phần trăm!"
    },
    {
        "id": "short_scene_5",
        "text": "Xem chi tiết toàn bộ mạch lệnh thực chiến minh bạch tại gikky chấm nét. Link ở bio nhé anh em!"
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
