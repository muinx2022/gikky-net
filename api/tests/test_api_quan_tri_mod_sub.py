"""Phân công mod chuyên mục — `ModSub`, PLAN 9.3 + `plans/2026-08-24-mod-chuyen-muc.md`.

## Bài đo QUAN TRỌNG NHẤT ở đây không phải đường thuận

`test_gan_mod_KHONG_cap_them_quyen_gi` là tiêu chí §0 của plan: lượt này dựng **vai trò**,
chưa nối **quyền**. Một người được gán làm mod chuyên mục mà không có `is_staff` vẫn phải
nhận 403 ở mọi cửa quản trị.

Nó là bài dễ bị phá nhất, vì "nối quyền cho xong" trông như hoàn thiện nốt một tính năng
dở dang. Nối quyền nghĩa là nới `ChiMod` — cổng chặn TOÀN khu quản trị — và đó là thay đổi
bảo mật cần plan riêng, không phải một dòng tiện tay.

## Số query: ghim ở HAI cỡ, không phải một

`test_so_query_khong_tang_theo_so_sub` chạy cùng phép đo ở 1 sub và ở 3 sub rồi đòi hai
con số BẰNG NHAU. Ghim một con số tuyệt đối thì mọi bản cài N+1 vẫn xanh miễn người viết
cập nhật con số cho khớp — mà đó đúng là việc người ta sẽ làm khi thấy bài đo đỏ.
"""

from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.ghi import AUDIT_GAN_MOD_SUB, AUDIT_GO_MOD_SUB
from core.models import AuditLog, ModSub, Sub, User

from tests._quan_tri import dang_nhap, dung_mod, dung_thuong, goi

pytestmark = pytest.mark.django_db


@pytest.fixture
def canh(db):
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    ai_do = dung_thuong("nguoi_se_lam_mod")
    mod_user = dung_mod()
    return {
        "sub": sub,
        "ai_do": ai_do,
        "mod_user": mod_user,
        "mod": dang_nhap(mod_user),
    }


def gan(client, slug: str, username: str):
    return goi(client, "post", f"/api/admin/subs/{slug}/mods", {"username": username})


# --- Đường thuận -------------------------------------------------------------------


def test_gan_roi_go_di_tron_mot_vong(canh):
    r = gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod")
    assert r.status_code == 200, r.content
    assert r.json()["mods"] == [
        {"username": "nguoi_se_lam_mod", "display_name": "Người Thường"}
    ]

    # Cột phải thấy được từ đường LIỆT KÊ, không chỉ từ response của lệnh ghi: hai đường
    # dựng `SubQuanTriOut` bằng hai queryset khác nhau.
    ds = canh["mod"].get("/api/admin/subs").json()
    assert [m["username"] for m in ds[0]["mods"]] == ["nguoi_se_lam_mod"]

    r = canh["mod"].delete("/api/admin/subs/chung-khoan/mods/nguoi_se_lam_mod")
    assert r.status_code == 200, r.content
    assert r.json()["mods"] == []
    assert ModSub.objects.count() == 0


def test_nhieu_mod_mot_sub_va_sap_theo_username(canh):
    """User chốt "nhiều mod". Thứ tự phải ỔN ĐỊNH, nếu không cột nhảy mỗi lần tải lại."""
    for u in ["zulu", "alpha", "mike"]:
        dung_thuong(u)
        assert gan(canh["mod"], "chung-khoan", u).status_code == 200

    ds = canh["mod"].get("/api/admin/subs").json()
    assert [m["username"] for m in ds[0]["mods"]] == ["alpha", "mike", "zulu"]


# --- Tiêu chí §0: vai trò CHƯA cấp quyền ---------------------------------------------


def test_gan_mod_KHONG_cap_them_quyen_gi(canh):
    """Sub-mod không `is_staff` vẫn bị `ChiMod` chặn ở MỌI cửa quản trị.

    Đây là ranh giới của lượt này, viết thành bài đo vì nó là thứ dễ bị "hoàn thiện nốt"
    nhất. Nối quyền = nới `ChiMod` = thay đổi bảo mật, có plan riêng.
    """
    assert gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod").status_code == 200
    assert ModSub.objects.filter(user__username="nguoi_se_lam_mod").exists()

    duoc_gan = dang_nhap(canh["ai_do"])
    for duong in ["/api/admin/me", "/api/admin/subs", "/api/admin/machs"]:
        assert duoc_gan.get(duong).status_code == 403, duong

    # Và họ cũng không gán được người khác — cửa gán chính nó vẫn nằm sau `ChiMod`.
    assert gan(duoc_gan, "chung-khoan", "nguoi_se_lam_mod").status_code == 403


# --- Từ chối -------------------------------------------------------------------------


def test_gan_trung_tra_409_chu_khong_500(canh):
    """`UniqueConstraint(sub, user)` ở tầng DB là chỗ chặn thật; handler phải dịch nó."""
    assert gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod").status_code == 200
    r = gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod")
    assert r.status_code == 409, r.content
    assert r.json()["code"] == "xung_dot"
    assert ModSub.objects.count() == 1


def test_gan_user_khong_co_tra_404(canh):
    assert gan(canh["mod"], "chung-khoan", "khong-ton-tai").status_code == 404


def test_gan_vao_sub_khong_co_tra_404(canh):
    assert gan(canh["mod"], "khong-co-sub-nay", "nguoi_se_lam_mod").status_code == 404


def test_gan_user_dang_bi_ban_tra_409(canh):
    """`ChiMod` từ chối tài khoản bị ban ở cổng ⇒ hàng phân công vô nghĩa ngay khi tạo."""
    canh["ai_do"].banned_until = timezone.now() + timedelta(days=7)
    canh["ai_do"].save(update_fields=["banned_until"])

    r = gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod")
    assert r.status_code == 409, r.content
    assert "ban" in r.json()["detail"].lower()
    assert ModSub.objects.count() == 0


def test_gan_user_da_vo_hieu_hoa_tra_409(canh):
    """`is_active=False` là cờ "xoá tài khoản GDPR-lite" — đừng dựng lại tên người đã rời."""
    canh["ai_do"].is_active = False
    canh["ai_do"].save(update_fields=["is_active"])

    r = gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod")
    assert r.status_code == 409, r.content
    assert ModSub.objects.count() == 0


def test_go_nguoi_KHONG_phai_mod_tra_404_chu_khong_im_lang(canh):
    """200 cho lệnh gỡ không gỡ gì là cách nhanh nhất để lỗi chính tả trông như thành công."""
    r = canh["mod"].delete("/api/admin/subs/chung-khoan/mods/nguoi_se_lam_mod")
    assert r.status_code == 404, r.content


# --- Nhật ký -------------------------------------------------------------------------


def test_gan_va_go_deu_ghi_dung_MOT_dong_nhat_ky(canh):
    assert gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod").status_code == 200
    canh["mod"].delete("/api/admin/subs/chung-khoan/mods/nguoi_se_lam_mod")

    dong = list(AuditLog.objects.order_by("pk"))
    assert [d.action for d in dong] == [AUDIT_GAN_MOD_SUB, AUDIT_GO_MOD_SUB]
    for d in dong:
        assert d.actor == canh["mod_user"]
        assert d.meta["slug"] == "chung-khoan"
        assert d.meta["username"] == "nguoi_se_lam_mod"


def test_gan_hong_thi_KHONG_de_lai_dong_nhat_ky_nao(canh):
    """Gán trùng ⇒ 409 ⇒ nhật ký phải sạch.

    Một dòng "đã gán" cho lượt không gán được là một dòng nói dối, và nhật ký nói dối thì
    không dùng làm bằng chứng được nữa — đó là toàn bộ lý do nó tồn tại.
    """
    assert gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod").status_code == 200
    AuditLog.objects.all().delete()

    assert gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod").status_code == 409
    assert AuditLog.objects.count() == 0


# --- Số query ------------------------------------------------------------------------


def test_so_query_khong_tang_theo_so_sub(canh):
    """Ghim ở HAI cỡ và đòi bằng nhau — xem docstring đầu file."""

    def dem() -> int:
        with CaptureQueriesContext(connection) as bat:
            canh["mod"].get("/api/admin/subs")
        return len(bat)

    assert gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod").status_code == 200
    mot = dem()

    for i in range(2):
        s = Sub.objects.create(slug=f"them-{i}", ten=f"Thêm {i}")
        ModSub.objects.create(sub=s, user=dung_thuong(f"mod_them_{i}"))
    assert Sub.objects.count() == 3

    ba = dem()
    assert ba == mot, (
        f"số query đổi theo số sub ({mot} → {ba}) — prefetch_related đã mất tác dụng"
    )


# --- Xoá sub -------------------------------------------------------------------------


def test_xoa_sub_keo_theo_phan_cong(canh):
    assert gan(canh["mod"], "chung-khoan", "nguoi_se_lam_mod").status_code == 200
    assert canh["mod"].delete("/api/admin/subs/chung-khoan").status_code == 200
    assert ModSub.objects.count() == 0
    assert User.objects.filter(username="nguoi_se_lam_mod").exists(), (
        "xoá sub không được đụng tới tài khoản"
    )
