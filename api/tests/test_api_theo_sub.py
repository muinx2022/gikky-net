"""Theo dõi **chuyên mục** — `POST`/`DELETE /subs/{slug}/theo`, `GET /subs/{slug}/me`,
`GET /me/subs`. User chốt 2026-08-24; plan: `plans/2026-08-24-theo-doi-chuyen-muc.md`.

Bốn nhóm câu hỏi, xếp theo thứ tự "hỏng thì đau tới đâu":

1. **Rò dữ liệu per-user** — B không nhìn thấy và không đụng được danh sách của A, và
   `GET /subs/{slug}` (đường CACHE ĐƯỢC) không mọc thêm trường nào theo người xem.
2. **Idempotency** — bấm hai lần không dựng hàng thứ hai, bỏ thứ vốn không theo vẫn 200.
3. **Cửa ghi có khoá** — khách ăn 401, slug lạ ăn 404.
4. **Thứ tự "mới theo trước"** — cái dễ hỏng im lặng nhất ở đây: nội dung vẫn đúng, chỉ
   thứ tự sai, nên không có bài đo nào tự nhiên nghi ngờ.
"""

import pytest

from core.models.dien_dan import Sub
from core.models.tuong_tac import TheoSub

from .conftest import dat, lay


def _theo(client, slug: str, *, status: int = 200):
    return dat(client, f"/api/v1/subs/{slug}/theo", status=status)


def _bo(client, slug: str, *, status: int = 200):
    return dat(client, f"/api/v1/subs/{slug}/theo", status=status, method="delete")


@pytest.fixture
def sub_hai(db) -> Sub:
    return Sub.objects.create(slug="crypto", ten="Crypto")


# --- (1) rò dữ liệu per-user -------------------------------------------------


@pytest.mark.django_db
def test_khach_nhan_200_rong_khong_phai_401(client, sub):
    """`GET /subs/{slug}/me` chạy ở MỌI lượt tải trang chuyên mục, kể cả của bot.

    401 ở đây là trả lỗi cho trạng thái bình thường nhất của hệ thống — cùng lý lẽ
    `GET /machs/{id}/me` và `GET /me`.
    """
    d = lay(client, f"/api/v1/subs/{sub.slug}/me")
    assert d == {"dang_nhap": False, "following": False}


@pytest.mark.django_db
def test_B_khong_thay_va_khong_doi_duoc_danh_sach_cua_A(client, sub, sub_hai, nguoi_a, nguoi_b):
    """**Bài đo lõi phân quyền.**

    Không cửa nào ở đây nhận tham số trỏ tới người khác — chủ suy ra từ phiên. Nên vế "B
    không đụng được của A" không đo bằng một mã 403; nó đo bằng chuyện B gọi hết cả ba cửa
    mà hàng của A không nhúc nhích, và B không nhìn thấy gì của A.
    """
    client.force_login(nguoi_a)
    _theo(client, sub.slug)
    assert TheoSub.objects.filter(user=nguoi_a).count() == 1

    client.force_login(nguoi_b)
    assert lay(client, f"/api/v1/subs/{sub.slug}/me") == {"dang_nhap": True, "following": False}
    assert lay(client, "/api/v1/me/subs") == []
    _theo(client, sub_hai.slug)
    _bo(client, sub.slug)  # B bỏ theo cái A đang theo — không được chạm hàng của A

    assert TheoSub.objects.filter(user=nguoi_a, sub=sub).exists()
    client.force_login(nguoi_a)
    assert [s["slug"] for s in lay(client, "/api/v1/me/subs")] == [sub.slug]


@pytest.mark.django_db
def test_GET_subs_slug_khong_moc_them_truong_nao_theo_nguoi_xem(client, sub, nguoi_a):
    """Đường **cache được** phải giữ nguyên hình dạng — PLAN 8.4.

    Đây là cách hỏng đã được ghi sẵn cho trang mạch: nhét `following` vào response bên kia
    cho tiện, rồi người thứ hai mở cùng URL nhận trạng thái của người thứ nhất. HTTP 200,
    không có gì đỏ.
    """
    khach = lay(client, f"/api/v1/subs/{sub.slug}")
    client.force_login(nguoi_a)
    _theo(client, sub.slug)
    da_theo = lay(client, f"/api/v1/subs/{sub.slug}")
    assert set(khach) == set(da_theo)
    assert "following" not in da_theo


@pytest.mark.django_db
def test_me_subs_khong_cache_duoc(client, sub, nguoi_a):
    """`Cache-Control: no-store` — response per-user đi qua một URL cố định.

    Thiếu header này thì bất kỳ proxy nào ở giữa cũng có quyền phát lại câu trả lời của
    người này cho người kế tiếp.
    """
    client.force_login(nguoi_a)
    assert client.get("/api/v1/me/subs")["Cache-Control"] == "no-store"
    assert client.get(f"/api/v1/subs/{sub.slug}/me")["Cache-Control"] == "no-store"


# --- (2) idempotency ---------------------------------------------------------


@pytest.mark.django_db
def test_theo_hai_lan_khong_dung_hang_thu_hai(client, sub, nguoi_a):
    """Hàng rào thật là `UniqueConstraint(user, sub)`; `get_or_create` chỉ là cửa trước."""
    client.force_login(nguoi_a)
    assert _theo(client, sub.slug) == {"slug": sub.slug, "following": True}
    assert _theo(client, sub.slug) == {"slug": sub.slug, "following": True}
    assert TheoSub.objects.filter(user=nguoi_a, sub=sub).count() == 1


@pytest.mark.django_db
def test_bo_theo_thu_von_khong_theo_van_200(client, sub, nguoi_a):
    """Nút "Hủy" có ở HAI chỗ (header chuyên mục + tab hồ sơ), hai tab trình duyệt cùng mở
    là chuyện thường. Bắt cái bấm sau ăn 404 là báo lỗi cho đúng trạng thái người dùng vốn
    đã muốn có."""
    client.force_login(nguoi_a)
    assert _bo(client, sub.slug) == {"slug": sub.slug, "following": False}
    assert TheoSub.objects.filter(user=nguoi_a).count() == 0


@pytest.mark.django_db
def test_vong_theo_bo_theo_ve_dung_trang_thai(client, sub, nguoi_a):
    client.force_login(nguoi_a)
    _theo(client, sub.slug)
    assert lay(client, f"/api/v1/subs/{sub.slug}/me")["following"] is True
    _bo(client, sub.slug)
    assert lay(client, f"/api/v1/subs/{sub.slug}/me")["following"] is False
    _theo(client, sub.slug)
    assert lay(client, f"/api/v1/subs/{sub.slug}/me")["following"] is True


# --- (3) cửa ghi có khoá -----------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["post", "delete"])
def test_khach_khong_ghi_duoc(client, sub, method):
    """`auth=dang_nhap` ở hai cửa ghi cũng chính là lớp kiểm CSRF — xem chú thích
    `NinjaAPI` ở `api/v1.py`. Mất 401 ở đây là mất cả hai thứ cùng lúc."""
    dat(client, f"/api/v1/subs/{sub.slug}/theo", status=401, method=method)
    assert TheoSub.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "duong"),
    [("post", "/theo"), ("delete", "/theo"), ("get", "/me")],
)
def test_slug_la_tra_404(client, nguoi_a, method, duong):
    """Kể cả `GET /me`: với một chuyên mục không tồn tại thì "bạn không theo nó" là câu
    trả lời sai, không phải câu trả lời rỗng."""
    client.force_login(nguoi_a)
    r = getattr(client, method)(f"/api/v1/subs/khong-co-that{duong}")
    assert r.status_code == 404


@pytest.mark.django_db
def test_khach_goi_me_cua_slug_la_van_404(client):
    lay(client, "/api/v1/subs/khong-co-that/me", status=404)


# --- (4) thứ tự "mới theo trước" ---------------------------------------------


@pytest.mark.django_db
def test_me_subs_moi_theo_dung_truoc(client, sub, sub_hai, nguoi_a):
    """Thứ tự là **`-created_at` trên `TheoSub`**, không phải `slug`.

    Đây là chỗ hỏng im lặng: bỏ bước sắp lại trong `liet_ke_sub_dang_theo` thì danh sách
    vẫn đủ và vẫn đúng nội dung, chỉ rơi về thứ tự tuỳ ý của `IN (...)`. Hai slug ở đây cố
    ý ngược nhau theo bảng chữ cái (`chung-khoan` trước `crypto`) so với thứ tự theo dõi.
    """
    client.force_login(nguoi_a)
    _theo(client, sub.slug)  # chung-khoan trước
    _theo(client, sub_hai.slug)  # crypto sau
    assert [s["slug"] for s in lay(client, "/api/v1/me/subs")] == [sub_hai.slug, sub.slug]


@pytest.mark.django_db
def test_me_subs_tra_du_truong_nhu_GET_subs(client, sub, nguoi_a):
    """Cùng schema `SubChiTietOut` với `GET /subs` — tab hồ sơ vẽ cùng loại thẻ."""
    client.force_login(nguoi_a)
    _theo(client, sub.slug)
    mot = lay(client, "/api/v1/me/subs")[0]
    cong_khai = lay(client, f"/api/v1/subs/{sub.slug}")
    assert set(mot) == set(cong_khai)
    assert mot == cong_khai


@pytest.mark.django_db
def test_khach_khong_xem_duoc_me_subs(client):
    lay(client, "/api/v1/me/subs", status=401)


# --- (5) `/me/subs-mod` — chuyên mục TÔI làm mod ------------------------------
#
# Nằm cùng file vì cùng hình dạng response (`SubChiTietOut`) và cùng loài bẫy: một danh
# sách `/me/*` mà lọc sai là rò dữ liệu người khác. Nhưng nó **khác ý nghĩa** — xem
# `test_danh_sach_mod_KHONG_phai_danh_sach_quyen`.


@pytest.mark.django_db
def test_subs_mod_chi_tra_chuyen_muc_duoc_phan_cong(client, sub, sub_hai, nguoi_a, nguoi_b):
    from core.models.dien_dan import ModSub

    ModSub.objects.create(sub=sub, user=nguoi_a)
    ModSub.objects.create(sub=sub_hai, user=nguoi_b)

    client.force_login(nguoi_a)
    assert [s["slug"] for s in lay(client, "/api/v1/me/subs-mod")] == [sub.slug]
    client.force_login(nguoi_b)
    assert [s["slug"] for s in lay(client, "/api/v1/me/subs-mod")] == [sub_hai.slug]


@pytest.mark.django_db
def test_subs_mod_rong_khi_chua_duoc_phan_cong(client, sub, nguoi_a):
    """Kể cả `is_staff`: danh sách này trả lời "tôi được phân công ở đâu", không phải
    "tôi mở được cửa nào"."""
    nguoi_a.is_staff = True
    nguoi_a.save(update_fields=["is_staff"])
    client.force_login(nguoi_a)
    assert lay(client, "/api/v1/me/subs-mod") == []


@pytest.mark.django_db
def test_danh_sach_mod_KHONG_phai_danh_sach_quyen(client, sub, mach, nguoi_a):
    """**Bài đo ghim một sự thật khó chịu**, để nó không bị hiểu nhầm thành lỗi.

    `ModSub` chưa cho thêm quyền gì (xem docstring model). Người có tên trong danh sách mà
    **không** `is_staff` vẫn bị bốn cửa `/api/v1/mod/*` từ chối. Ngày ai đó nối quyền
    theo-sub, bài này ĐỎ — và đó đúng là lúc cần một lượt review bảo mật, không phải lúc
    sửa bài đo cho xanh.
    """
    from core.models.dien_dan import ModSub

    ModSub.objects.create(sub=sub, user=nguoi_a)
    client.force_login(nguoi_a)
    assert [s["slug"] for s in lay(client, "/api/v1/me/subs-mod")] == [sub.slug]

    # Fixture `mach` dựng trong chính `sub` này — **không** `skip` nếu thiếu: một bài đo
    # tự bỏ qua mình là một bài đo rỗng đội lốt bài đo xanh, và vế 403 dưới đây là toàn bộ
    # nội dung của bài này.
    assert mach.sub_id == sub.pk
    r = client.post(
        f"/api/v1/mod/machs/{mach.pk}/an",
        data='{"an": true, "ly_do": "thu"}',
        content_type="application/json",
    )
    assert r.status_code == 403, "ModSub KHÔNG được tự nhiên cho quyền mod trên v1"


@pytest.mark.django_db
def test_khach_khong_xem_duoc_subs_mod(client):
    lay(client, "/api/v1/me/subs-mod", status=401)
