"""Bộ reaction đổi từ 📈📉🔥🧊🎯 sang bộ **phản hồi về bài viết** — user chốt 2026-08-25.

Lý do đầy đủ ở docstring `core/models/tuong_tac.py::Reaction`. Tóm tắt ba vế: bộ cũ trùng
việc của `Vote`; 📈📉 và 🎯 là hai cơ chế PLAN gọi là **cấm tuyệt đối** (bảng đếm hướng
giá dưới vị thế đang mở · đám đông chấm đúng-sai); và cả bốn icon ấy **vô nghĩa trên bài
nhận định**, thứ chiếm một nửa nội dung site.

## Vì sao XOÁ chứ không map

Không có ánh xạ nào trung thực. `len` nghĩa là *"tôi nghĩ giá lên"* — bộ mới không có khái
niệm ấy, và gán nó thành `ro_rang` (*"luận điểm rõ"*) là **bịa ra lời người dùng chưa từng
nói**, rồi in con số bịa ấy lên trang dưới dạng dữ liệu thật.

`AlterField` một mình **không đủ**: `choices` của Django là luật ở tầng ứng dụng, không
phải ràng buộc DB. Bỏ bước xoá thì hàng cũ nằm im với chuỗi `"len"`, và
`api/api/tuong_tac.py::_dem` (lặp theo `Reaction.Emoji.values`) sẽ **âm thầm bỏ qua**
chúng — bảng đếm trả về 4 khoá bằng 0 trong khi DB còn hàng. Không có gì đỏ.

Không viết `reverse`: bộ khoá cũ đã bị bác vì lý do sản phẩm, nên "quay lại" không phải
một trạng thái hợp lệ để đi tới. Ai thật sự cần thì `migrate core 0016` rồi tự dựng lại
dữ liệu — chuyện đó phải là một quyết định có ý thức, không phải một lệnh gõ nhầm.
"""

from django.db import migrations, models


def xoa_reaction_bo_cu(apps, schema_editor):
    Reaction = apps.get_model("core", "Reaction")
    so = Reaction.objects.count()
    Reaction.objects.all().delete()
    if so:
        print(f"  0017: xoá {so} hàng Reaction của bộ khoá cũ (không map được sang bộ mới)")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0016_theosub"),
    ]

    operations = [
        # Xoá TRƯỚC khi đổi `choices`: sau khi đổi, hàng cũ là dữ liệu không còn khoá nào
        # nhận, và mọi phép đọc đi qua `Reaction.Emoji.values` sẽ lặng lẽ không thấy chúng.
        migrations.RunPython(xoa_reaction_bo_cu, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="reaction",
            name="emoji",
            field=models.CharField(
                choices=[
                    ("ro_rang", "🧠 luận điểm rõ"),
                    ("co_nguon", "📎 có dẫn nguồn"),
                    ("can_them", "❓ cần thêm dữ kiện"),
                    ("lieu", "🔥 liều"),
                ],
                max_length=8,
            ),
        ),
    ]
