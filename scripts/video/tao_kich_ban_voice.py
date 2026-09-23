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
        "text": "Chào mừng anh em đã quay trở lại với Gikky. Về mặt vật lý và hóa học, vàng là một trong những tài sản đồng nhất tuyệt đối nhất trên hành tinh. Dù được đúc thành thỏi tại Thụy Sĩ, London hay dập thành miếng tại Hà Nội, một lượng vàng 24K nguyên chất đều chứa đúng ba mươi bảy phẩy năm gram vàng tinh khiết chín mươi chín phẩy chín mươi chín phần trăm. Thế nhưng tại Việt Nam, có những thời điểm giá một lượng vàng miếng SJC đắt hơn giá vàng thế giới tới gần hai mươi triệu đồng, tương đương mức chênh lệch hơn hai mươi phần trăm. Tại sao lại có nghịch lý kỳ lạ này? Cơ chế nào tạo ra nó và ai là người chịu rủi ro sau cùng?"
    },
    {
        "id": "yt_scene_2",
        "text": "Để hiểu nguồn gốc của khoảng cách này, chúng ta phải quay ngược về giai đoạn 2008 đến 2011. Thời điểm đó, nền kinh tế đối mặt với nạn vàng hóa trầm trọng: Người dân dùng vàng mua bán bất động sản, các ngân hàng ồ ạt huy động vàng, và việc gom USD nhập vàng lậu khiến tỷ giá tiền đồng chao đảo, lạm phát vọt lên hai con số. Năm 2012, Nghị định 24 ra đời, mang lại thành công lịch sử: Nhà nước độc quyền sản xuất vàng miếng, chọn SJC làm thương hiệu quốc gia và cắt đứt hoàn toàn tín dụng vàng. Thế nhưng, nó cũng biến thị trường vàng miếng thành một chiếc bình kín. Hơn mười năm qua, nguồn cung vàng SJC gần như bị đóng băng, trong khi quy mô kinh tế và nhu cầu tích trữ của người dân đã tăng gấp ba lần."
    },
    {
        "id": "yt_scene_3",
        "text": "Nhiều người hỏi: Tại sao Ngân hàng Nhà nước không mở quota nhập khẩu vàng định kỳ để kéo giá trong nước về sát thế giới? Câu trả lời nằm ở bài toán sống còn: Dự trữ ngoại hối. Ở mức giá vàng thế giới hiện nay quanh bốn nghìn ba trăm đô một ounce, để nhập khẩu chỉ một tấn vàng, nền kinh tế phải tiêu tốn khoảng một trăm bốn mươi triệu đô la tiền mặt. Nếu mở toang nhập khẩu theo nhu cầu thị trường, hàng tỷ đô la dự trữ ngoại hối quý giá dùng để nhập khẩu xăng dầu, máy móc công nghiệp và bảo vệ tỷ giá tiền đồng sẽ bị chôn chặt thành những thỏi kim loại nằm bất động trong két sắt. Chấp nhận mức chênh lệch giá vàng chính là cái giá phải trả để bảo vệ tấm khiên ngoại hối quốc gia."
    },
    {
        "id": "yt_scene_4",
        "text": "Tuy nhiên, khi chênh lệch bị kéo giãn quá mức, cơ chế thị trường sẽ tự tìm lối đi ngầm: Nạn xếp hàng đầu cơ bùng nổ, các đường dây buôn lậu vàng qua biên giới hoạt động rầm rộ, kéo theo nhu cầu gom USD chợ đen đẩy tỷ giá tự do tăng vọt. Đối với người mua, khoản chênh lệch mười lăm đến hai mươi triệu đồng mỗi lượng thực chất là một khoản phí bảo hiểm thể chế. Nếu trong tương lai, chính sách được sửa đổi theo hướng xóa bỏ thế độc quyền và cho phép nhiều thương hiệu tham gia dập vàng chuẩn, lớp thặng dư độc quyền này có thể bốc hơi rất nhanh. Người mua gom vàng ở vùng chênh lệch kỷ lục sẽ phải đối mặt với rủi ro đu đỉnh thể chế cực kỳ nặng nề."
    },
    {
        "id": "yt_scene_5",
        "text": "Hiểu rõ bản chất các chính sách tiền tệ và cấu trúc thị trường là chìa khóa giúp bạn đưa ra những quyết định tài chính sáng suốt. Hãy truy cập ngay gikky chấm nét để đón đọc các bài viết phân tích vĩ mô, bóc tách dòng tiền và bài học quản trị rủi ro mỗi ngày. Đừng quên bấm Đăng ký kênh @gikky-net và bật chuông thông báo để không bỏ lỡ những video tiếp theo nhé!"
    }
]

# TikTok / Shorts 9:16 Script (5 Scenes, punchy & fast)
SHORT_SEGMENTS = [
    {
        "id": "short_scene_1",
        "text": "Cùng là ba mươi bảy phẩy năm gram vàng 24K, tại sao vàng miếng ở Việt Nam có lúc đắt hơn thế giới tới hai mươi triệu đồng mỗi lượng?"
    },
    {
        "id": "short_scene_2",
        "text": "Nguyên nhân cốt lõi là Nghị định 24 năm 2012 đã biến thị trường thành chiếc bình kín: Nhà nước độc quyền vàng SJC, nguồn cung bị đóng băng suốt mười bốn năm qua trong khi nhu cầu tích trữ tăng gấp ba lần."
    },
    {
        "id": "short_scene_3",
        "text": "Sao không nhập khẩu vàng về bán? Vì nhập một tấn vàng tốn tới một trăm bốn mươi triệu đô tiền mặt! Nhà nước phải giữ dự trữ ngoại hối để nhập xăng dầu và giữ ổn định tỷ giá tiền đồng."
    },
    {
        "id": "short_scene_4",
        "text": "Khoản chênh lệch hai mươi triệu là phí độc quyền thể chế. Nếu chính sách sửa đổi bỏ độc quyền SJC, lớp thặng dư này sẽ bốc hơi trong tích tắc!"
    },
    {
        "id": "short_scene_5",
        "text": "Đọc bài bóc tách chi tiết cơ chế giá vàng tại gikky chấm nét. Link ở phần tiểu sử nhé anh em!"
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
