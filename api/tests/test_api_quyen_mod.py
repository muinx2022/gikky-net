"""Cấp / thu quyền mod + khu "Quản trị viên" — `plans/2026-08-26-khu-quan-tri-vien.md`.

Hai nhóm bài đo nằm chung một file vì chúng là **hai nửa của một quyết định**: staff biến
khỏi bảng Người dùng (§2.1) chỉ chấp nhận được khi có một khu riêng để quản họ (§2.3), và
khu riêng ấy chỉ an toàn khi cửa cấp quyền có đủ năm lời từ chối.

⚠ **Cái đắt nhất ở đây không phải endpoint mới, mà là hệ quả của nó.** `ban_nguoi_dung`
trả 409 khi đích là `is_staff`, nên **cấp quyền mod cho ai = làm người đó miễn nhiễm ban**.
Trước lượt này thao tác ấy chỉ làm được ở Django admin; nay superuser làm được từ web. Đó
là cái giá user đã chấp nhận có ý thức — và một cái giá đã chấp nhận vẫn phải có bài đo
ghim lại, nếu không nó sẽ bị "sửa" trong một lượt dọn dẹp nào đó mà không ai nhận ra mình
đang đổi một luật bảo mật. Đó là
`test_B10_cap_quyen_mod_lam_tai_khoan_mien_nhiem_ban`.

## Vì sao B11/B13 seed cả staff LẪN thường, và assert cả hai tập khác rỗng

Đây là chỗ file này dễ thành **bài đo rỗng** nhất. "Tập `tat_ca` không chứa staff" đúng
một cách vô nghĩa khi seed không có staff nào — và nó sẽ vẫn xanh kể cả khi ai đó gỡ sạch
phép lọc. Nên hai bài ấy đòi cả hai tập **khác rỗng** trước khi so; thiếu phép đòi đó thì
chúng không đo gì cả.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from core.ghi import AUDIT_DOI_QUYEN_MOD, ban_user
from core.models import AuditLog, ModSub, Sub, User

from api.quan_tri_schemas import DoiQuyenModIn

from tests._quan_tri import dang_nhap, dung_mod, dung_thuong, goi

DUONG = "/api/admin/users/{}/quyen-mod"


def _quyen(client, username: str, bat: bool):
    return goi(client, "post", DUONG.format(username), {"bat": bat})


@pytest.fixture
def canh(db):
    """Một superuser đang đăng nhập, một mod thường, một người thường.

    Superuser **cũng phải `is_staff`** — `ChiMod` (cổng của cả khu quản trị) chỉ nhìn
    `is_staff`, nên một superuser không staff sẽ ăn 403 ở cổng và mọi bài dưới đây đo
    nhầm cái cổng thay vì đo `_chan_neu_khong_phai_superuser`.
    """
    sếp = User.objects.create(
        username="sep_lon", display_name="Sếp", is_staff=True, is_superuser=True
    )
    return {
        "sep": sếp,
        "sep_client": dang_nhap(sếp),
        "mod": dung_mod("mod_thuong"),
        "thuong": dung_thuong("nguoi_thuong"),
    }


# --- B1..B2: hai chiều của công tắc ------------------------------------------


def test_B1_superuser_cap_quyen_mod(canh):
    """`bat=true` ⇒ 200, `is_staff` bật, nhãn `vai_tro` đổi, và có dòng nhật ký.

    Nhãn `vai_tro` bị đo cùng lúc chứ không phải riêng: nó là lý do endpoint trả **cả
    hàng** thay vì 204. Trả 204 thì frontend phải tự suy nhãn từ `bat`, tức dựng bản thứ
    hai của `vai_tro_cua` — và bản thứ hai lệch ngay khi hàm ấy mọc thêm một nhánh.
    """
    r = _quyen(canh["sep_client"], "nguoi_thuong", True)
    assert r.status_code == 200, r.content
    assert r.json()["is_staff"] is True
    assert r.json()["vai_tro"] == "Mod"
    # `is_superuser` KHÔNG được đi theo — cửa này chỉ chạm một cờ.
    assert r.json()["is_superuser"] is False

    canh["thuong"].refresh_from_db()
    assert canh["thuong"].is_staff is True

    dong = AuditLog.objects.filter(action=AUDIT_DOI_QUYEN_MOD).get()
    assert dong.actor_id == canh["sep"].pk
    assert dong.target_id == canh["thuong"].pk
    assert dong.meta["username"] == "nguoi_thuong"
    assert dong.meta["bat"] is True


def test_B2_superuser_thu_quyen_mod(canh):
    r = _quyen(canh["sep_client"], "mod_thuong", False)
    assert r.status_code == 200, r.content
    assert r.json()["is_staff"] is False
    assert r.json()["vai_tro"] == "Thành viên"

    canh["mod"].refresh_from_db()
    assert canh["mod"].is_staff is False
    assert AuditLog.objects.filter(action=AUDIT_DOI_QUYEN_MOD).count() == 1


def test_dat_trung_gia_tri_dang_co_la_200_khong_phai_409(canh):
    """Idempotent — và **không** đẻ dòng nhật ký cho một lượt bấm không đổi gì.

    Một công tắc báo lỗi khi bị gạt về đúng vị trí nó đang đứng là một công tắc hỏng. Còn
    sổ nhật ký thì trả lời câu "ai cho người này làm mod"; một dòng cho lượt không đổi gì
    chỉ làm loãng đúng câu trả lời đó.
    """
    r = _quyen(canh["sep_client"], "mod_thuong", True)
    assert r.status_code == 200, r.content
    assert r.json()["is_staff"] is True
    assert AuditLog.objects.filter(action=AUDIT_DOI_QUYEN_MOD).count() == 0

    r = _quyen(canh["sep_client"], "nguoi_thuong", False)
    assert r.status_code == 200, r.content
    assert r.json()["is_staff"] is False
    assert AuditLog.objects.filter(action=AUDIT_DOI_QUYEN_MOD).count() == 0


# --- B3..B8: năm lời từ chối --------------------------------------------------


def test_B3_mod_thuong_bi_chan_CA_HAI_CHIEU(canh):
    """T1. Đo cả hai chiều: chặn được đường cấp mà quên đường thu là vẫn mở.

    Một mod thường thu được quyền của mod khác thì "mọi mod ngang quyền nhau" biến thành
    một cuộc chiến ai bấm trước — đúng thứ luật "không ban mod khác" ở
    `quan_tri_nguoi_dung.py` đang chặn ở đường ban.
    """
    mod_client = dang_nhap(canh["mod"])

    r = _quyen(mod_client, "nguoi_thuong", True)
    assert r.status_code == 403, r.content
    canh["thuong"].refresh_from_db()
    assert canh["thuong"].is_staff is False

    khac = dung_thuong("mod_khac")
    User.objects.filter(pk=khac.pk).update(is_staff=True)
    r = _quyen(mod_client, "mod_khac", False)
    assert r.status_code == 403, r.content
    khac.refresh_from_db()
    assert khac.is_staff is True

    assert AuditLog.objects.filter(action=AUDIT_DOI_QUYEN_MOD).count() == 0


def test_B4_khong_tu_doi_quyen_cua_minh(canh):
    """T2. Thu quyền của chính mình = tự khoá khỏi khu quản trị.

    ⚠ **Bài này phải chấm CÂU CHỮ, không chấm mã 409** — và đó không phải cầu kỳ. Người
    gọi đã qua `_chan_neu_khong_phai_superuser`, nên "đích là chính mình" luôn kéo theo
    "đích là superuser": nhánh T3 ngay dưới cũng trả 409 cho đúng ca này. Một phép chấm
    `status_code == 409` vì thế vẫn xanh **kể cả khi nhánh T2 bị gỡ sạch** — đã thử phá
    đúng như vậy và nó không đỏ. Câu chữ là thứ duy nhất phân biệt được hai nhánh, nên
    câu chữ là thứ phải chấm.
    """
    r = _quyen(canh["sep_client"], "sep_lon", False)
    assert r.status_code == 409, r.content
    assert "chính mình" in r.json()["detail"], r.json()["detail"]
    assert "Django admin" not in r.json()["detail"], (
        "rơi vào nhánh T3 (đích là superuser) thay vì T2 (đích là chính mình) — "
        "hai nhánh bị đảo, hoặc T2 đã bị gỡ"
    )
    canh["sep"].refresh_from_db()
    assert canh["sep"].is_staff is True


def test_B5_dich_la_superuser_thi_tu_choi(canh):
    """T3. `ChiMod` đòi `is_staff`; thu `is_staff` của một superuser là làm hỏng một nửa
    họ — còn `is_superuser` nhưng hết đường vào."""
    sep2 = User.objects.create(
        username="sep_hai", display_name="Sếp Hai", is_staff=True, is_superuser=True
    )
    r = _quyen(canh["sep_client"], "sep_hai", False)
    assert r.status_code == 409, r.content
    assert "sep_hai" in r.json()["detail"]
    sep2.refresh_from_db()
    assert sep2.is_staff is True


def test_B6_khong_cap_quyen_cho_tai_khoan_dang_bi_ban(canh):
    """T4. `ChiMod` từ chối tài khoản bị ban ở cổng ⇒ hàng cấp ra vô nghĩa ngay khi tạo;
    và một cái tên bị ban nằm trong bảng "Quản trị viên" là thông tin sai trên màn hình."""
    ban_user(user=canh["thuong"], boi=canh["sep"], vinh_vien=True, ly_do="phím hàng")

    r = _quyen(canh["sep_client"], "nguoi_thuong", True)
    assert r.status_code == 409, r.content
    canh["thuong"].refresh_from_db()
    assert canh["thuong"].is_staff is False


def test_B7_khong_cap_quyen_cho_tai_khoan_da_vo_hieu_hoa(canh):
    """T4, nửa còn lại. `is_active=False` là "xoá tài khoản" kiểu GDPR-lite — phân công
    cho một tài khoản đã ẩn danh hoá là dựng lại một cái tên người ta vừa rời bỏ."""
    User.objects.filter(pk=canh["thuong"].pk).update(is_active=False)

    r = _quyen(canh["sep_client"], "nguoi_thuong", True)
    assert r.status_code == 409, r.content
    canh["thuong"].refresh_from_db()
    assert canh["thuong"].is_staff is False


def test_B8_thu_quyen_khi_con_ModSub_thi_409_va_neu_ten_sub(canh):
    """T5. 409 phải **liệt kê tên sub**, nếu không superuser phải đi dò từng chuyên mục.

    Và `ModSub` phải còn nguyên: lối chữa bị loại là *cascade xoá* — mất dữ liệu ngầm mà
    người bấm không yêu cầu, và mất luôn câu trả lời "ai từng phụ trách sub này".
    """
    ck = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    bds = Sub.objects.create(slug="bat-dong-san", ten="Bất động sản")
    ModSub.objects.create(sub=ck, user=canh["mod"], assigned_by=canh["sep"])
    ModSub.objects.create(sub=bds, user=canh["mod"], assigned_by=canh["sep"])

    r = _quyen(canh["sep_client"], "mod_thuong", False)
    assert r.status_code == 409, r.content
    chi_tiet = r.json()["detail"]
    assert "s/chung-khoan" in chi_tiet
    assert "s/bat-dong-san" in chi_tiet

    canh["mod"].refresh_from_db()
    assert canh["mod"].is_staff is True
    assert ModSub.objects.filter(user=canh["mod"]).count() == 2

    # Gỡ hết phân công rồi thì thu được — 409 kia là "làm việc này trước", không phải
    # một cánh cửa đóng vĩnh viễn.
    ModSub.objects.filter(user=canh["mod"]).delete()
    r = _quyen(canh["sep_client"], "mod_thuong", False)
    assert r.status_code == 200, r.content
    assert r.json()["is_staff"] is False


# --- B9: hình dạng schema là hàng rào -----------------------------------------


def test_B9_gui_kem_is_superuser_trong_body_thi_co_ay_KHONG_doi(canh):
    """`DoiQuyenModIn` chỉ khai `bat`; Ninja loại mọi khoá lạ trước khi handler thấy.

    ⚠ **Hai phép chấm, và bản đầu chỉ có phép thứ hai — nó là bài đo rỗng một nửa.**

    Phần "gửi kèm khoá lạ ⇒ cờ không đổi" *không* canh được hình dạng schema, dù docstring
    cũ nói thế: handler chỉ đọc `du_lieu.bat`, nên thêm `is_superuser` vào `DoiQuyenModIn`
    **vẫn để bài này XANH**. Lời khẳng định ấy còn được chép sang docstring của
    `DoiQuyenModIn` và sang plan §2.3, nên nó sẽ được tin — đúng loài lỗi "một bài đo đứng
    làm chứng cho một luật nó không kiểm". Lượt phản biện 2026-08-26 bắt được.

    ⇒ Phép chấm **hình dạng schema** phải viết thẳng ra, và nó là phép chấm rẻ nhất ở đây.
    """
    # Hàng rào thật: thêm bất kỳ trường nào vào `DoiQuyenModIn` là đỏ ngay tại đây. Đó là
    # cái chặn "mở một đường tự phong superuser từ web", không phải phần gửi khoá lạ dưới.
    assert set(DoiQuyenModIn.model_fields) == {"bat"}, (
        "`DoiQuyenModIn` mọc thêm trường — mỗi trường ở đây là một cột người gọi ghi "
        "được. `is_staff`/`is_superuser` tuyệt đối không được có mặt."
    )

    r = goi(
        canh["sep_client"],
        "post",
        DUONG.format("nguoi_thuong"),
        {"bat": True, "is_superuser": True, "is_staff": False},
    )
    assert r.status_code == 200, r.content
    assert r.json()["is_superuser"] is False
    assert r.json()["is_staff"] is True

    canh["thuong"].refresh_from_db()
    assert canh["thuong"].is_superuser is False
    # `is_staff` theo `bat`, KHÔNG theo khoá lạ `is_staff: false` gửi kèm.
    assert canh["thuong"].is_staff is True


# --- B10: hệ quả bảo mật đã chấp nhận, ghim lại -------------------------------


def test_B10_cap_quyen_mod_lam_tai_khoan_mien_nhiem_ban(canh):
    """**Cấp quyền mod = làm người đó miễn nhiễm ban.** Ghim, không phải chúc mừng.

    `ban_nguoi_dung` trả 409 khi đích là `is_staff`. Ghép hai luật lại thì một superuser
    bấm "Cấp quyền mod" vừa lấy mất khả năng ban tài khoản ấy — kể cả của chính mình. User
    đã chấp nhận cái giá đó khi chọn "có, nhưng chỉ superuser"; bài đo ở đây để ngày mai
    không ai đổi nó mà tưởng mình đang dọn dẹp.

    Đường thoát vẫn còn và cũng bị đo: thu quyền xong thì ban lại được.
    """
    ban = {"ly_do": "phím hàng", "vinh_vien": True}

    # Trước khi cấp quyền: ban được.
    r = goi(canh["sep_client"], "post", "/api/admin/users/nguoi_thuong/ban", ban)
    assert r.status_code == 200, r.content
    r = goi(canh["sep_client"], "post", "/api/admin/users/nguoi_thuong/go-ban", {})
    assert r.status_code == 200, r.content

    assert _quyen(canh["sep_client"], "nguoi_thuong", True).status_code == 200

    # Sau khi cấp quyền: **409**. Đây là dòng mang toàn bộ nội dung của bài đo.
    r = goi(canh["sep_client"], "post", "/api/admin/users/nguoi_thuong/ban", ban)
    assert r.status_code == 409, r.content
    canh["thuong"].refresh_from_db()
    assert canh["thuong"].dang_bi_ban() is False

    # Và đường thoát: thu quyền rồi ban lại được.
    assert _quyen(canh["sep_client"], "nguoi_thuong", False).status_code == 200
    r = goi(canh["sep_client"], "post", "/api/admin/users/nguoi_thuong/ban", ban)
    assert r.status_code == 200, r.content


# --- B11..B13: staff biến khỏi bảng Người dùng --------------------------------


def _tap(client, truy_van: str) -> set[str]:
    r = client.get(f"/api/admin/users{truy_van}")
    assert r.status_code == 200, r.content
    return {u["username"] for u in r.json()["items"]}


def test_moi_nguoi_tim_duoc_ca_staff(canh):
    """Hồi quy 2026-08-26 — ô gợi ý user bảo "không có tài khoản nào khớp" cho người có thật.

    §2.1 làm `tat_ca` loại `is_staff`, và `tat_ca` là **mặc định của server**. Ô gợi ý
    (`apps/admin/components/o-goi-y-user.tsx`) gọi list mà không khai `trang_thai`, nên nó
    thừa hưởng mặc định ấy — kể cả ở `/subs`, nơi nó là **đường nhập duy nhất** để gán mod
    chuyên mục. Hệ quả: mọi tài khoản staff biến khỏi ô gợi ý, và màn hình nói *"Không có
    tài khoản nào khớp."*

    Nó tệ hơn một hồi quy thường vì hai lẽ:

    1. `ChiMod` đòi `is_staff`, nên **tập người thật sự moderate được một sub gần như
       chính là tập vừa biến mất** — thao tác hỏng là thao tác hay dùng nhất.
    2. Backend vẫn nhận (`gan_mod_sub` không kiểm `is_staff`), nên không có lỗi nào nổ.
       Chỉ có một câu nói dối trên màn hình.

    Lượt đầu của §2.2 kê thuốc cho đúng bệnh này ở `/users` (`so_staff_an` + dòng gợi ý)
    rồi bỏ quên bệnh nhân thứ hai dùng chung endpoint. `moi_nguoi` là lối thoát, và bài
    này ghim rằng nó thật sự không lọc gì.
    """
    moi_nguoi = _tap(canh["sep_client"], "?trang_thai=moi_nguoi")
    tat_ca = _tap(canh["sep_client"], "?trang_thai=tat_ca")

    # Chống rỗng: cả hai vế phải có người, nếu không phép so dưới đúng một cách vô nghĩa.
    assert {"sep_lon", "mod_thuong"} <= moi_nguoi, moi_nguoi
    assert "nguoi_thuong" in moi_nguoi
    assert moi_nguoi == {u.username for u in User.objects.all()}
    assert moi_nguoi - tat_ca == {"sep_lon", "mod_thuong"}, (
        "`moi_nguoi` phải là tập cha thật sự của `tat_ca` — đúng phần staff bị giấu"
    )

    # Tìm theo `q` vẫn ra staff. Đây mới là đường ô gợi ý đi.
    r = canh["sep_client"].get("/api/admin/users?trang_thai=moi_nguoi&q=mod_thuong")
    assert r.status_code == 200, r.content
    assert [u["username"] for u in r.json()["items"]] == ["mod_thuong"]
    # Không giấu ai thì không có gì để báo là đã giấu.
    assert r.json()["so_staff_an"] == 0


def test_B11_tat_ca_khong_chua_staff_va_staff_chi_chua_staff(canh):
    """Ba phép, và phép thứ ba là phép giữ cho hai phép đầu không rỗng nghĩa.

    "`tat_ca` không chứa staff" đúng một cách vô nghĩa nếu seed không có staff nào — nó
    sẽ vẫn xanh kể cả khi phép lọc bị gỡ sạch. Nên: cả hai tập phải **khác rỗng**, và hợp
    của chúng phải bằng **toàn bộ** tài khoản. Vế cuối là thứ bắt được một bản cài "loại
    staff" mà lỡ tay loại luôn ai đó khác.
    """
    dung_thuong("thuong_hai")
    tat_ca = _tap(canh["sep_client"], "?trang_thai=tat_ca")
    staff = _tap(canh["sep_client"], "?trang_thai=staff")

    assert tat_ca, "tập `tat_ca` rỗng — bài đo này không đo gì cả"
    assert staff, "tập `staff` rỗng — bài đo này không đo gì cả"

    tu_db_staff = {u.username for u in User.objects.filter(is_staff=True)}
    tu_db_thuong = {u.username for u in User.objects.filter(is_staff=False)}
    assert tu_db_staff and tu_db_thuong

    assert staff == tu_db_staff
    assert tat_ca == tu_db_thuong
    assert tat_ca & staff == set()
    assert tat_ca | staff == {u.username for u in User.objects.all()}

    # `bi_ban` và `moi` cũng loại staff — cùng một luật, ba đường vào.
    ban_user(user=canh["mod"], boi=canh["sep"], vinh_vien=True, ly_do="thử")
    ban_user(user=canh["thuong"], boi=canh["sep"], vinh_vien=True, ly_do="thử")
    bi_ban = _tap(canh["sep_client"], "?trang_thai=bi_ban")
    assert bi_ban == {"nguoi_thuong"}, bi_ban

    # `moi`: mọi tài khoản của fixture đều vừa tạo, nên nhóm này khác rỗng sẵn.
    moi = _tap(canh["sep_client"], "?trang_thai=moi")
    assert moi, "tập `moi` rỗng — phép so dưới đây sẽ không đo gì"
    assert "mod_thuong" not in moi and "sep_lon" not in moi


def test_B12_so_staff_an_dung_ke_ca_khi_co_q(canh):
    """`so_staff_an` đếm **cùng `q`, cùng `trang_thai`** — không phải tổng staff hệ thống.

    Hai con số ấy khác nhau ngay khi có `q`, và đó là toàn bộ lý do trường này tồn tại:
    gõ `mod_gikky` vào ô lọc ra bảng rỗng, mà một bảng rỗng không phân biệt được "không
    có ai tên vậy" với "có, nhưng ở trang khác".
    """
    client = canh["sep_client"]

    # Không `q`: 2 staff (`sep_lon` + `mod_thuong`) bị loại khỏi `tat_ca`.
    r = client.get("/api/admin/users?trang_thai=tat_ca")
    assert r.json()["so_staff_an"] == 2
    assert r.json()["tong"] == 1

    # Có `q` khớp ĐÚNG một staff ⇒ 1, không phải 2. Đây là phép phân biệt "đếm theo bộ
    # lọc" với "đếm toàn hệ thống" — bản cài sai sẽ ra 2 ở dòng này.
    r = client.get("/api/admin/users?q=mod_thuong&trang_thai=tat_ca")
    assert r.json()["so_staff_an"] == 1
    assert r.json()["tong"] == 0
    assert r.json()["items"] == []

    # `q` không khớp staff nào ⇒ 0, dù hệ thống vẫn có 2 staff.
    r = client.get("/api/admin/users?q=nguoi_thuong&trang_thai=tat_ca")
    assert r.json()["so_staff_an"] == 0
    assert r.json()["tong"] == 1

    # `trang_thai=staff` KHÔNG loại gì ⇒ luôn 0.
    r = client.get("/api/admin/users?trang_thai=staff")
    assert r.json()["so_staff_an"] == 0
    assert r.json()["tong"] == 2


def test_B13_tong_cua_tat_ca_khop_so_hang_khong_staff(canh):
    """`tong` phải đếm SAU phép loại staff.

    Đếm trước rồi mới loại là `tong` kể cả staff còn bảng thì không — đúng cái bẫy
    `phan_trang.py::dem_tong` cảnh báo, và nó im lặng: chỉ là một con số lớn hơn số hàng,
    thứ không ai kiểm. Bài đo đòi thêm rằng **có staff trong DB**, nếu không hai vế bằng
    nhau bất kể code làm gì.
    """
    for i in range(5):
        dung_thuong(f"them_{i}")

    so_staff = User.objects.filter(is_staff=True).count()
    so_thuong = User.objects.filter(is_staff=False).count()
    assert so_staff and so_thuong, "seed thiếu một trong hai loại — bài đo sẽ rỗng"

    r = canh["sep_client"].get("/api/admin/users?trang_thai=tat_ca&limit=50")
    than = r.json()
    assert than["tong"] == so_thuong
    assert than["tong"] == len(than["items"])
    assert than["tong"] != User.objects.count()
    assert than["so_staff_an"] == so_staff


def test_khu_quan_tri_vien_va_bang_nguoi_dung_khong_bo_sot_ai(canh):
    """Bất biến của cả lượt việc: **không tài khoản nào rơi khỏi CẢ HAI màn hình.**

    Đây là thứ B11 đo trên một seed cụ thể, còn bài này đo trên một seed có đủ mọi tổ
    hợp trạng thái — bị ban, vô hiệu hoá, cũ, mới, superuser. "Ẩn hẳn quản trị viên khỏi
    danh sách Người dùng" chỉ chấp nhận được khi họ chắc chắn hiện ra ở đúng một chỗ
    khác; một tài khoản không xuất hiện ở màn hình nào là một tài khoản không ai quản
    được, và không có gì báo.
    """
    bi_ban = dung_thuong("bi_ban_roi")
    ban_user(user=bi_ban, boi=canh["sep"], vinh_vien=True, ly_do="thử")
    tat = dung_thuong("da_tat")
    User.objects.filter(pk=tat.pk).update(is_active=False)
    cu = dung_thuong("tai_khoan_cu")
    User.objects.filter(pk=cu.pk).update(
        date_joined=timezone.now() - timedelta(days=300)
    )
    staff_bi_ban = dung_thuong("staff_bi_ban")
    User.objects.filter(pk=staff_bi_ban.pk).update(is_staff=True)
    ban_user(user=staff_bi_ban, boi=canh["sep"], vinh_vien=True, ly_do="thử")

    client = canh["sep_client"]
    nguoi_dung = _tap(client, "?trang_thai=tat_ca&limit=50")
    quan_tri = _tap(client, "?trang_thai=staff&limit=50")

    assert nguoi_dung and quan_tri
    assert nguoi_dung | quan_tri == {u.username for u in User.objects.all()}
    assert nguoi_dung & quan_tri == set()
    # Kể cả một staff đang bị ban cũng phải hiện ở khu quản trị viên — nếu không, thu
    # quyền của họ là việc không có màn hình nào làm được.
    assert "staff_bi_ban" in quan_tri
