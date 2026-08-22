"""Đổi hàng `Site` mặc định `example.com` thành gikky.net — Phase 2.

`django.contrib.sites` là phụ thuộc cứng của `allauth.socialaccount`, và migration của nó
tạo sẵn `Site(id=1, domain="example.com", name="example.com")`. Con số đó không nằm im:
allauth chèn `{{ site_name }}` vào **tiêu đề và thân** những email nó gửi. Template email
của gikky (`api/templates/account/email/`) không dùng biến ấy, nhưng mọi email allauth
**chưa** được đè thì có — và không ai để ý cho tới lúc một người dùng thật nhận được thư
đề "[example.com]".

Sửa bằng migration dữ liệu chứ không bằng lệnh chạy tay: máy nào dựng repo cũng phải có
giá trị đúng, và một bước "nhớ vào admin sửa Site" là bước sẽ bị quên.
"""

from django.db import migrations

TEN = "gikky.net"


def dat_ten_site(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.update_or_create(pk=1, defaults={"domain": TEN, "name": TEN})


def tra_lai_example(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.filter(pk=1).update(domain="example.com", name="example.com")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_phase_1d_diem_bai_goc"),
        ("sites", "0002_alter_domain_unique"),
    ]

    operations = [migrations.RunPython(dat_ten_site, tra_lai_example)]
