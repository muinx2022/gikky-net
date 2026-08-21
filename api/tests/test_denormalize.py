"""Cột denormalize — PLAN mục 6, plan con Phase 1a 2.3 và 2.5 (5).

Bốn cột của `Mach` và hai cột đếm của `Comment` phải đúng NGAY khi transaction ghi đóng
lại. Không có job nền nào chữa chúng, và không có gì đỏ khi chúng sai — chỉ có feed sắp
sai thứ tự và banner đếm nhầm.
"""

import threading
from datetime import timedelta

import pytest
from django.db import connection, transaction
from django.utils import timezone

from core.ghi import dat_vote, tao_binh_luan, tao_mach, them_moc
from core.models import Comment, Mach, Moc, Vote

pytestmark = pytest.mark.django_db

#: Thời gian tối đa chờ một luồng — quá ngưỡng này coi như treo, không phải chậm.
CHO_TOI_DA = 15.0
#: Mốc đồng bộ, KHÔNG phải điều kiện đúng/sai: đủ dài để luồng thứ hai kịp chạm tới chỗ
#: nó bị chặn, đủ ngắn để test không lê thê. Máy stall lâu hơn ngần này thì bài đo mất
#: hiệu lực (nó sẽ xanh vì lý do sai) — chưa thấy xảy ra, nhưng đừng hạ xuống.
CHO_CHAM_CHO_BI_CHAN = 1.0


def test_tao_mach_sinh_luon_moc_1_va_dem_dung(sub, tac_gia):
    mach, moc = tao_mach(sub=sub, author=tac_gia, title="Nhật ký HPG", body="Vào lệnh.")
    mach.refresh_from_db()

    assert moc.seq == 1
    assert mach.entry_count == 1
    assert mach.comment_count == 0
    assert mach.last_entry_at == moc.created_at
    assert mach.last_activity_at == moc.created_at
    assert mach.slug == "nhat-ky-hpg"


def test_them_moc_cap_seq_lien_tuc_va_day_last_entry_at(mach, tac_gia):
    for mong_doi in (2, 3, 4):
        moc = them_moc(mach=mach, author=tac_gia, body=f"mốc {mong_doi}")
        mach.refresh_from_db()
        assert moc.seq == mong_doi
        assert mach.entry_count == mong_doi
        assert mach.last_entry_at == moc.created_at
        assert mach.last_activity_at == moc.created_at


def test_binh_luan_day_last_activity_nhung_KHONG_day_last_entry(mach, nguoi_khac):
    """Phân biệt hai cột: bình luận là "hoạt động", không phải "mốc".

    Nếu bình luận cũng đẩy `last_entry_at` thì feed "Đang diễn ra" (PLAN 5.9) biến
    thành feed "có người vừa cãi nhau" — và mục 4 đã loại đúng cơ chế bump đó.
    """
    last_entry_truoc = mach.last_entry_at
    # `created_at` tường minh, không dùng "bây giờ": đồng hồ Windows nhảy ~15ms một
    # nhịp, nên mốc 1 và bình luận tạo liền nhau có thể trùng khít microsecond và phép
    # so `>` cuối bài thành hên xui.
    c = tao_binh_luan(
        mach=mach,
        author=nguoi_khac,
        body="hay đấy",
        anchor_moc_seq=1,
        _created_at_seed=last_entry_truoc + timedelta(minutes=5),
    )
    mach.refresh_from_db()

    assert mach.comment_count == 1
    assert mach.last_entry_at == last_entry_truoc
    assert mach.last_activity_at == c.created_at
    assert mach.last_activity_at > mach.last_entry_at


def test_binh_luan_lui_ngay_khong_keo_last_activity_ve_qua_khu(mach, nguoi_khac):
    """`last_activity_at` là MAX, không phải "cái ghi gần nhất".

    Seed nạp dữ liệu lịch sử không theo thứ tự thời gian; gán thẳng
    `last_activity_at = comment.created_at` sẽ kéo mạch tụt lại quá khứ.
    """
    moi = tao_binh_luan(mach=mach, author=nguoi_khac, body="mới", anchor_moc_seq=1)
    mach.refresh_from_db()
    assert mach.last_activity_at == moi.created_at

    tao_binh_luan(
        mach=mach,
        author=nguoi_khac,
        body="cũ, nạp sau",
        anchor_moc_seq=1,
        _created_at_seed=timezone.now() - timedelta(days=30),
    )
    mach.refresh_from_db()
    assert mach.last_activity_at == moi.created_at


def test_moc_moi_hon_binh_luan_thi_last_activity_theo_MOC(mach, tac_gia, nguoi_khac):
    """`last_activity_at = MAX(mốc, bình luận)` — không phải "cái nào cũng được".

    Lấy nhầm thành "thời điểm bình luận mới nhất" thì mạch vừa được nối mốc hôm nay,
    nhưng bình luận cuối từ tháng trước, sẽ bị luật BÃO/CẶN (PLAN 5.5) xếp là NGUỘI —
    đúng lúc nó sôi nhất.
    """
    goc = mach.last_entry_at
    tao_binh_luan(
        mach=mach,
        author=nguoi_khac,
        body="bình luận cũ",
        anchor_moc_seq=1,
        _created_at_seed=goc + timedelta(minutes=10),
    )
    moc2 = them_moc(
        mach=mach, author=tac_gia, body="mốc 2", _created_at_seed=goc + timedelta(days=3)
    )
    mach.refresh_from_db()

    assert mach.last_entry_at == moc2.created_at
    assert mach.last_activity_at == moc2.created_at


def test_comment_count_khong_dem_binh_luan_da_xoa(mach, nguoi_khac, tac_gia):
    c1 = tao_binh_luan(mach=mach, author=nguoi_khac, body="một", anchor_moc_seq=1)
    tao_binh_luan(mach=mach, author=nguoi_khac, body="hai", anchor_moc_seq=1)
    mach.refresh_from_db()
    assert mach.comment_count == 2

    c1.deleted_at = timezone.now()
    c1.save(update_fields=["deleted_at"])
    # Xoá mềm phải đi qua đường ghi thì cột mới cập nhật — ở đây gọi thẳng hàm đếm.
    # **Phase 2 phải ghi `deleted_at` và gọi hàm này trong CÙNG một `atomic()`**: hàm tự
    # khoá hàng `Mach`, nhưng khoá chỉ sống tới lúc transaction đóng, nên tách làm hai
    # transaction là mở lại đúng cửa mất số mà `test_hai_transaction_...` dưới đây đo.
    # Bài đo này gọi trần được là nhờ fixture `db` đã bọc cả test trong một `atomic`.
    from core.ghi import cap_nhat_dem_mach

    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()
    assert mach.comment_count == 1


def test_entry_count_van_dem_moc_bia_mo(mach, tac_gia):
    """Mốc xoá là bia mộ giữ chỗ trên spine (PLAN nguyên tắc 2) ⇒ vẫn được đếm."""
    from core.ghi import cap_nhat_dem_mach

    moc2 = them_moc(mach=mach, author=tac_gia, body="mốc 2")
    moc2.deleted_at = timezone.now()
    moc2.save(update_fields=["deleted_at"])
    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()
    assert mach.entry_count == 2


def test_comment_count_KHONG_dem_binh_luan_bi_mod_an(mach, nguoi_khac):
    """W7 — "💬 N bình luận" phải khớp với số bình luận người đọc thấy.

    Phase 4 bật moderation là ca này thành thật: `hidden_at` khác `deleted_at` ở chỗ ai
    ẩn và vì sao, nhưng giống nhau ở kết quả người đọc thấy — không thấy gì. Đếm cả hàng
    ẩn nghĩa là banner nói "24 bình luận" trong khi người ta đếm ra 22, **không test nào
    đỏ, không log nào kêu**. Chốt ở 1a, lúc chưa có dữ liệu ẩn nào để phải đi chữa.
    """
    from core.ghi import cap_nhat_dem_mach

    c1 = tao_binh_luan(mach=mach, author=nguoi_khac, body="một", anchor_moc_seq=1)
    tao_binh_luan(mach=mach, author=nguoi_khac, body="hai", anchor_moc_seq=1)
    mach.refresh_from_db()
    assert mach.comment_count == 2

    c1.hidden_at = timezone.now()
    c1.save(update_fields=["hidden_at"])
    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()
    assert mach.comment_count == 1


def test_an_moc_GIUA_mach_khong_lam_doi_entry_count(mach, tac_gia):
    """X1a — `entry_count` đo CẤU TRÚC, không đo "số ô người đọc thấy" (PLAN mục 6).

    Đây là chỗ bản trước sai: nó loại `hidden_at` khỏi `entry_count` để banner khớp mắt
    người đọc, nhưng `seq` thì không co lại theo. Ẩn mốc 2 của mạch 3 mốc ⇒ banner nói
    "2 mốc" trong khi spine vẫn đánh số tới 3, và dải gập của mặt CẶN (PLAN 5.5) —
    `range(2, n-1)` suy từ chính `n` này — gập nhầm ô, đẩy mốc tổng kết vào phần bị gập.
    Bất biến giữ được là `entry_count == max(seq)`, nên bài đo ghim thẳng nó.
    """
    from django.db.models import Max as MaxSeq

    from core.ghi import cap_nhat_dem_mach

    them_moc(mach=mach, author=tac_gia, body="mốc 2")
    them_moc(mach=mach, author=tac_gia, body="mốc 3")
    mach.refresh_from_db()
    assert mach.entry_count == 3

    moc_giua = Moc.objects.get(mach=mach, seq=2)
    moc_giua.hidden_at = timezone.now()
    moc_giua.save(update_fields=["hidden_at"])
    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()

    seq_lon_nhat = Moc.objects.filter(mach=mach).aggregate(MaxSeq("seq"))["seq__max"]
    assert mach.entry_count == 3, "mốc bị ẩn vẫn chiếm một ô trên spine"
    assert mach.entry_count == seq_lon_nhat


def test_an_moc_MOI_NHAT_khong_lam_last_entry_at_lui(mach, tac_gia):
    """X1b — ẩn mốc không làm `last_entry_at` lùi (PLAN mục 6, hệ quả cố ý).

    Nói đúng phạm vi bài đo: nó ghim vế **moderation** (ẩn / xoá mềm), không phải một
    bất biến tuyệt đối — xoá CỨNG mốc mới nhất vẫn kéo cột này lùi được, xem docstring
    `cap_nhat_dem_mach`.

    Cột này là ngưỡng của hệ số tươi trong `hay_nhat` (PLAN 5.3:
    `c.created_at > mach.last_entry_at`). Cho nó lùi khi mod ẩn mốc mới nhất nghĩa là
    một loạt bình luận cũ — viết trước mốc đó, cố ý KHÔNG được bonus — bỗng dưng thoả
    điều kiện và nhảy lên đầu khán đài. Xếp hạng đổi mà không ai ghi gì, không có gì đỏ.
    """
    from core.ghi import cap_nhat_dem_mach

    goc = mach.last_entry_at
    moc2 = them_moc(
        mach=mach, author=tac_gia, body="mốc 2", _created_at_seed=goc + timedelta(days=3)
    )
    mach.refresh_from_db()
    assert mach.last_entry_at == moc2.created_at

    moc2.hidden_at = timezone.now()
    moc2.save(update_fields=["hidden_at"])
    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()

    assert mach.last_entry_at == moc2.created_at, "ẩn mốc không được kéo ngưỡng về quá khứ"
    assert mach.last_entry_at > goc


def test_an_moc_moi_nhat_VAN_keo_last_activity_at_ve_noi_dung_doc_duoc(
    mach, tac_gia, nguoi_khac
):
    """Hai cột tách hẳn nhau: `last_entry_at` đứng yên, `last_activity_at` thì tụt.

    Không có bài này thì `last_activity_at = max(last_entry_at, bình luận)` — bản trước
    đợt vá — vẫn xanh, vì `last_entry_at` nay giữ cả mốc bị ẩn. Nghĩa là mạch bị mod dọn
    mốc spam vẫn nằm mặt BÃO thêm 72 giờ (PLAN 5.5) nhờ đúng cái mốc vừa bị ẩn: cùng một
    lỗi đã loại được ở bảng `Comment`, chỉ đổi sang bảng `Moc`.
    """
    from core.ghi import cap_nhat_dem_mach

    goc = mach.last_entry_at
    c = tao_binh_luan(
        mach=mach,
        author=nguoi_khac,
        body="bình luận",
        anchor_moc_seq=1,
        _created_at_seed=goc + timedelta(days=1),
    )
    moc2 = them_moc(
        mach=mach, author=tac_gia, body="mốc spam", _created_at_seed=goc + timedelta(days=3)
    )
    mach.refresh_from_db()
    assert mach.last_activity_at == moc2.created_at

    moc2.hidden_at = timezone.now()
    moc2.save(update_fields=["hidden_at"])
    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()

    assert mach.last_entry_at == moc2.created_at, "cấu trúc: không lùi"
    assert mach.last_activity_at == c.created_at, "nội dung đọc được: tụt về bình luận"
    assert mach.last_activity_at < mach.last_entry_at


def test_entry_count_LUON_bang_so_hang_Moc_du_an_hay_bia_mo(mach, tac_gia):
    """Bất biến trần trụi, không qua trung gian: `entry_count == COUNT(*) trên Moc`.

    Hai bài trên đo từng vế một; bài này ghim cái mà cả hai vế phải cùng thoả, kể cả khi
    `deleted_at` và `hidden_at` chồng lên nhau trên cùng một hàng — ca mà một cài đặt
    kiểu `exclude(deleted_at=..., hidden_at=...)` sẽ đếm sai mà hai bài kia không thấy.
    """
    from core.ghi import cap_nhat_dem_mach

    moc2 = them_moc(mach=mach, author=tac_gia, body="mốc 2")
    moc3 = them_moc(mach=mach, author=tac_gia, body="mốc 3")
    moc4 = them_moc(mach=mach, author=tac_gia, body="mốc 4")

    khi = timezone.now()
    moc2.deleted_at = khi
    moc2.save(update_fields=["deleted_at"])
    moc3.hidden_at = khi
    moc3.save(update_fields=["hidden_at"])
    moc4.deleted_at = khi
    moc4.hidden_at = khi
    moc4.save(update_fields=["deleted_at", "hidden_at"])

    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()

    assert mach.entry_count == Moc.objects.filter(mach=mach).count() == 4


def test_last_activity_khong_tinh_binh_luan_vua_bi_an(mach, tac_gia, nguoi_khac):
    """Một bình luận vừa bị mod ẩn không được tính là "mạch đang sôi động".

    `last_activity_at` là đầu vào của luật BÃO/CẶN (PLAN 5.5). Nếu hàng ẩn vẫn đẩy cột
    này thì một mạch bị dọn spam sẽ ở mặt BÃO thêm 72 giờ nhờ đúng cái spam vừa bị xoá.
    """
    from core.ghi import cap_nhat_dem_mach

    goc = mach.last_entry_at
    c = tao_binh_luan(
        mach=mach,
        author=nguoi_khac,
        body="spam",
        anchor_moc_seq=1,
        _created_at_seed=goc + timedelta(days=2),
    )
    mach.refresh_from_db()
    assert mach.last_activity_at == c.created_at

    c.hidden_at = timezone.now()
    c.save(update_fields=["hidden_at"])
    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()
    assert mach.last_activity_at == goc


def test_XOA_moc_moi_nhat_cung_keo_last_activity_at_ve_noi_dung_doc_duoc(
    mach, tac_gia, nguoi_khac
):
    """Y3b — vế `Moc` của `last_activity_at` loại **cả bia mộ**, không chỉ mốc bị ẩn.

    Bài `test_an_moc_moi_nhat_VAN_keo_last_activity_at_...` ở trên chỉ chạm `hidden_at`,
    nên một cài đặt lọc thiếu (`filter(hidden_at__isnull=True)` mà quên `deleted_at`)
    vẫn xanh trọn bộ. Bia mộ là nội dung **không đọc được** y như mốc bị ẩn (PLAN mục 6,
    "nội dung đọc được"), nên tác giả tự xoá mốc mới nhất cũng không được giữ mạch ở mặt
    BÃO thêm 72 giờ nhờ chính cái mốc vừa xoá.

    Vế CẤU TRÚC thì ngược lại và bài này ghim luôn cả hai cùng lúc: `last_entry_at` vẫn
    đứng ở mốc bia mộ, vì bia mộ giữ chỗ trên spine (PLAN nguyên tắc 2).
    """
    from core.ghi import cap_nhat_dem_mach

    goc = mach.last_entry_at
    c = tao_binh_luan(
        mach=mach,
        author=nguoi_khac,
        body="bình luận",
        anchor_moc_seq=1,
        _created_at_seed=goc + timedelta(days=1),
    )
    moc2 = them_moc(
        mach=mach, author=tac_gia, body="mốc rồi xoá", _created_at_seed=goc + timedelta(days=3)
    )
    mach.refresh_from_db()
    assert mach.last_activity_at == moc2.created_at

    moc2.deleted_at = timezone.now()
    moc2.save(update_fields=["deleted_at"])
    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()

    assert mach.last_entry_at == moc2.created_at, "cấu trúc: bia mộ vẫn giữ chỗ"
    assert mach.last_activity_at == c.created_at, "nội dung đọc được: tụt về bình luận"
    assert mach.last_activity_at < mach.last_entry_at


def test_an_sach_noi_dung_thi_last_activity_at_ve_created_at_cua_mach(
    sub, tac_gia, nguoi_khac
):
    """Y2b — nhánh `else` của `last_activity_at`: không còn gì đọc được thì lấy gì.

    Ghim đúng hai thứ nhánh đó làm được: **không giữ giá trị cũ** và **không lấy giờ
    hiện tại**. Cả hai cách kia đều đóng dấu "vừa hoạt động" lên một mạch chẳng còn gì
    đọc được — mạch bị dọn sạch lúc bấm nút lại thành mạch sôi động nhất feed.

    Bài này KHÔNG chứng minh mạch spam bị dọn sẽ rời mặt BÃO — nó không rời (mạch đăng
    hôm nay vẫn còn `created_at` của hôm nay). Đó là việc của `Mach.hidden_at`/`locked_at`
    ở Phase 4; xem comment tại chỗ trong `core/ghi.py`.

    Mạch dựng lùi 30 ngày chứ không dùng fixture `mach`: fixture đóng dấu "bây giờ", mà
    mutant nguy hiểm nhất ở đây chính là `timezone.now()` — hai giá trị cách nhau vài
    micro giây thì phép so trở thành hên xui.
    """
    from core.ghi import cap_nhat_dem_mach

    xua = timezone.now() - timedelta(days=30)
    mach, moc1 = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Mạch bị dọn sạch",
        body="Mốc 1.",
        _created_at_seed=xua,
    )
    c = tao_binh_luan(
        mach=mach,
        author=nguoi_khac,
        body="spam",
        anchor_moc_seq=1,
        _created_at_seed=xua + timedelta(hours=1),
    )
    mach.refresh_from_db()
    assert mach.created_at == xua
    assert mach.last_activity_at == c.created_at > mach.created_at

    khi_an = timezone.now()
    moc1.hidden_at = khi_an
    moc1.save(update_fields=["hidden_at"])
    c.hidden_at = khi_an
    c.save(update_fields=["hidden_at"])
    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()

    assert mach.last_activity_at == mach.created_at == xua, (
        "ẩn sạch nội dung thì rơi về lúc mạch ra đời, không giữ dấu của nội dung vừa ẩn"
    )
    # Ghim riêng vế "không phải bây giờ": nếu ai đó đổi nhánh else thành `timezone.now()`
    # thì dòng trên đã đỏ, nhưng dòng này nói thẳng lý do cho người đọc log.
    assert mach.last_activity_at < khi_an - timedelta(days=29)
    # Cấu trúc không đổi theo: ẩn không phải xoá hàng.
    assert mach.entry_count == 1
    assert mach.last_entry_at == moc1.created_at
    assert mach.comment_count == 0


def test_mach_khong_con_hang_Moc_thi_last_entry_at_giu_nguyen(mach, tac_gia):
    """Y3a — guard `if moc_moi_nhat is not None` giữ cột `NOT NULL` khỏi bị ghi `None`.

    Hôm nay không đường sản phẩm nào xoá CỨNG một `Moc` (xoá = bia mộ, PLAN nguyên tắc
    2), nên trạng thái "mạch không còn hàng `Moc` nào" chỉ tới từ admin Django hoặc một
    câu SQL tay — đúng cửa PLAN mục 6 đã ghi là "Phase 4 mở admin xoá `Moc` lẻ là bất
    biến gãy im lặng". Bỏ guard thì cửa đó không gãy im lặng nữa mà nổ `NOT NULL` giữa
    một transaction ghi hoàn toàn khác, ở một chỗ không ai ngờ.

    Ghim hành vi: `last_entry_at` **giữ nguyên giá trị cũ**. Không có mốc nào thì không
    có thông tin mới về cấu trúc; bịa ra "bây giờ" là đẩy mạch rỗng lên đầu feed "Đang
    diễn ra" (PLAN 5.9 sort theo chính cột này).
    """
    from core.ghi import cap_nhat_dem_mach

    moc1 = Moc.objects.get(mach=mach, seq=1)
    truoc = moc1.created_at
    Moc.objects.filter(mach=mach).delete()
    assert not Moc.objects.filter(mach=mach).exists()

    cap_nhat_dem_mach(Mach.objects.get(pk=mach.pk))
    mach.refresh_from_db()

    assert mach.last_entry_at == truoc, "không có mốc thì không có gì để cập nhật"
    assert mach.entry_count == 0
    assert mach.last_activity_at == mach.created_at


@pytest.mark.django_db(transaction=True)
def test_hai_transaction_dong_thoi_khong_lam_mat_comment_count():
    """Y1a — `cap_nhat_dem_mach` phải TỰ khoá hàng `Mach`, không trông vào người gọi.

    Ca mất số vĩnh viễn dưới READ COMMITTED, dựng đúng theo kịch bản phản biện:

    1. Luồng A viết bình luận thứ ba, đếm lại ra 3, **chưa commit** (vẫn giữ khoá hàng
       `Mach` do `cap_phat_path` lấy).
    2. Luồng B (mod ẩn bình luận 1) đếm lại. Nếu `cap_nhat_dem_mach` không tự khoá, B
       đếm ngay được: nó chưa thấy hàng của A ⇒ ra 1.
    3. B chạy `UPDATE core_mach` → chờ ở khoá của A. A commit. **B ghi đè 1.**
    4. Thực tế còn 2 bình luận đọc được. `comment_count = 1` vĩnh viễn — không log,
       không exception, không job đối soát.

    Có khoá thì B bị chặn ngay ở bước 2, nên nó đếm SAU khi A commit và ra đúng 2.
    Với code ĐÚNG, kết quả tất định: cả hai kịch bản B đều bị chặn tới khi A commit, chỉ
    khác nhau ở chỗ **con số được tính trước hay sau** hàng rào đó.

    Nhưng SỨC GIẾT MUTANT thì có phụ thuộc lịch luồng — xem `CHO_CHAM_CHO_BI_CHAN` ở đầu
    file. Nếu luồng B chậm quá ngưỡng đó (máy stall, chưa kịp mở connection riêng), main
    thả A commit trước khi B đếm ⇒ B thấy đủ hàng ⇒ **bài đo xanh dù code hỏng**. Không có
    event nào báo "B đã tới chỗ bị chặn", nên đừng đọc bài này mạnh hơn thế.

    `transaction=True` là bắt buộc: dưới fixture `db` thường, transaction bọc ngoài giấu
    sạch dữ liệu khỏi luồng con và hai luồng sẽ thao tác trên hai mạch rỗng khác nhau.
    """
    from core.ghi import cap_nhat_dem_mach
    from tests.conftest import dung_mach, dung_user

    mach, _ = dung_mach(hau_to="_dua")
    nguoi = dung_user("nguoi_dua")
    c1 = tao_binh_luan(mach=mach, author=nguoi, body="một", anchor_moc_seq=1)
    tao_binh_luan(mach=mach, author=nguoi, body="hai", anchor_moc_seq=1)
    mach.refresh_from_db()
    assert mach.comment_count == 2

    mach_pk, c1_pk = mach.pk, c1.pk
    a_da_ghi = threading.Event()
    cho_a_commit = threading.Event()
    b_xong = threading.Event()
    loi: list[BaseException] = []

    def luong_viet():
        """A: viết bình luận thứ ba rồi GIỮ transaction mở."""
        try:
            with transaction.atomic():
                tao_binh_luan(
                    mach=Mach.objects.get(pk=mach_pk),
                    author=nguoi,
                    body="ba",
                    anchor_moc_seq=1,
                )
                a_da_ghi.set()
                cho_a_commit.wait(timeout=CHO_TOI_DA)
        except BaseException as e:  # noqa: BLE001 - thu hết để báo lại ở luồng chính
            loi.append(e)
        finally:
            connection.close()

    def luong_an():
        """B: mod ẩn bình luận 1 rồi đếm lại — đúng hình dạng đường ghi Phase 2."""
        try:
            with transaction.atomic():
                Comment.objects.filter(pk=c1_pk).update(hidden_at=timezone.now())
                cap_nhat_dem_mach(Mach.objects.get(pk=mach_pk))
            b_xong.set()
        except BaseException as e:  # noqa: BLE001
            loi.append(e)
        finally:
            connection.close()

    t_a = threading.Thread(target=luong_viet)
    t_b = threading.Thread(target=luong_an)
    t_a.start()
    assert a_da_ghi.wait(timeout=CHO_TOI_DA), "luồng A không ghi được bình luận thứ ba"
    t_b.start()
    # Chờ B chạm tới chỗ nó bị chặn (SELECT FOR UPDATE nếu có khoá, UPDATE nếu không)
    # rồi mới thả A. Không assert gì ở đây: B bị chặn trong CẢ HAI kịch bản, nên "bị
    # chặn" không phân biệt được đúng/sai — thứ phân biệt là con số ở cuối bài.
    b_xong.wait(timeout=CHO_CHAM_CHO_BI_CHAN)
    cho_a_commit.set()

    t_a.join(timeout=CHO_TOI_DA)
    t_b.join(timeout=CHO_TOI_DA)
    assert not t_a.is_alive() and not t_b.is_alive(), "luồng không kết thúc — deadlock?"
    assert loi == [], f"có lỗi lọt ra ngoài: {loi!r}"
    assert b_xong.is_set(), "luồng B không hoàn tất"

    mach.refresh_from_db()
    doc_duoc = Comment.objects.filter(
        mach_id=mach_pk, deleted_at__isnull=True, hidden_at__isnull=True
    ).count()
    assert doc_duoc == 2, "dựng sai ca: phải còn đúng 2 bình luận đọc được"
    assert mach.comment_count == doc_duoc, (
        f"mất số: comment_count = {mach.comment_count} trong khi còn {doc_duoc} bình "
        "luận đọc được — luồng B đếm khi chưa thấy hàng của A rồi ghi đè"
    )
    assert Comment.objects.filter(mach_id=mach_pk).count() == 3


def test_cap_nhat_dem_nam_trong_cung_transaction_voi_ghi(mach, tac_gia):
    """Rollback transaction ngoài thì cả mốc lẫn cột đếm cùng biến mất.

    Đây là cách duy nhất đo được chữ "trong CÙNG transaction" của PLAN mục 6: nếu
    `cap_nhat_dem_mach` tự commit riêng (vd chạy trong `on_commit` hay một connection
    khác) thì `entry_count` sẽ sống sót qua rollback và lệch khỏi số mốc thật.
    """
    with pytest.raises(RuntimeError):
        with transaction.atomic():
            them_moc(mach=mach, author=tac_gia, body="mốc 2")
            assert Mach.objects.get(pk=mach.pk).entry_count == 2
            raise RuntimeError("hỏng giữa chừng")

    sau = Mach.objects.get(pk=mach.pk)
    assert sau.entry_count == 1
    assert Moc.objects.filter(mach=mach).count() == 1


# --- Vote → up_count / down_count / score ----------------------------------


def test_vote_len_xuong_va_rut_cap_nhat_dung_ca_ba_so(mach, tac_gia, nguoi_khac):
    c = tao_binh_luan(mach=mach, author=tac_gia, body="bình luận", anchor_moc_seq=1)

    dat_vote(user=nguoi_khac, target=c, value=1)
    c.refresh_from_db()
    assert (c.up_count, c.down_count, c.score) == (1, 0, 1)

    # Đổi phiếu: KHÔNG được cộng thêm hàng, và phải trừ lại vế cũ.
    dat_vote(user=nguoi_khac, target=c, value=-1)
    c.refresh_from_db()
    assert (c.up_count, c.down_count, c.score) == (0, 1, -1)
    assert Vote.objects.filter(target_type="comment", target_id=c.pk).count() == 1

    dat_vote(user=nguoi_khac, target=c, value=0)
    c.refresh_from_db()
    assert (c.up_count, c.down_count, c.score) == (0, 0, 0)
    assert not Vote.objects.filter(target_type="comment", target_id=c.pk).exists()


def test_vote_moc_chi_doi_score(mach, nguoi_khac):
    moc = Moc.objects.get(mach=mach, seq=1)
    dat_vote(user=nguoi_khac, target=moc, value=1)
    moc.refresh_from_db()
    assert moc.score == 1
    dat_vote(user=nguoi_khac, target=moc, value=-1)
    moc.refresh_from_db()
    assert moc.score == -1


def test_dem_vote_khop_so_hang_vote_that(mach, tac_gia):
    """Chốt chặn chống trôi: đếm lại từ bảng `Vote` phải ra đúng cột denormalize."""
    from tests.conftest import dung_user

    c = tao_binh_luan(mach=mach, author=tac_gia, body="bình luận", anchor_moc_seq=1)
    nguoi = [dung_user(f"u{i}") for i in range(7)]
    for u in nguoi[:5]:
        dat_vote(user=u, target=c, value=1)
    for u in nguoi[5:]:
        dat_vote(user=u, target=c, value=-1)

    c.refresh_from_db()
    phieu = Vote.objects.filter(target_type="comment", target_id=c.pk)
    assert c.up_count == phieu.filter(value=1).count() == 5
    assert c.down_count == phieu.filter(value=-1).count() == 2
    assert c.score == 3


def test_vote_gia_tri_la_bi_tu_choi(mach, nguoi_khac):
    from django.core.exceptions import ValidationError

    moc = Moc.objects.get(mach=mach, seq=1)
    with pytest.raises(ValidationError):
        dat_vote(user=nguoi_khac, target=moc, value=5)


def test_comment_score_la_cot_sinh_ra_khong_ghi_tay_duoc(mach, tac_gia):
    """P7: `score` là `GENERATED ALWAYS ... STORED` — Postgres từ chối ghi thẳng.

    Kiểm bằng SQL trần chứ không qua ORM: ORM tự loại `score` khỏi câu UPDATE, nên đi
    qua ORM thì "không ghi được" là công của Django, chưa chứng minh được cột ở DB đúng
    là cột sinh ra. Chỉ SQL trần mới phân biệt hai chuyện đó.
    """
    from django.db import connection as conn
    from django.db.utils import ProgrammingError

    c = tao_binh_luan(mach=mach, author=tac_gia, body="bình luận", anchor_moc_seq=1)

    # ĐỐI CHỨNG: cùng câu SQL, cột thường thì ghi được. Không có hai dòng này thì bài đo
    # trên vẫn "xanh" cả khi nó ném lỗi vì lý do khác (gõ sai tên bảng, thiếu quyền, cột
    # không tồn tại) — tức là không chứng minh được `score` đặc biệt ở chỗ nào.
    with conn.cursor() as cur:
        cur.execute("UPDATE core_comment SET up_count = 7 WHERE id = %s", [c.pk])
    assert Comment.objects.get(pk=c.pk).up_count == 7

    with pytest.raises(ProgrammingError, match="score"):
        with transaction.atomic():
            with conn.cursor() as cur:
                cur.execute("UPDATE core_comment SET score = 999 WHERE id = %s", [c.pk])

    c.refresh_from_db()
    assert c.score == 7


def test_comment_score_tu_theo_up_count(mach, tac_gia):
    c = tao_binh_luan(mach=mach, author=tac_gia, body="bình luận", anchor_moc_seq=1)
    Comment.objects.filter(pk=c.pk).update(up_count=12, down_count=4)
    c.refresh_from_db()
    assert c.score == 8


def test_them_moc_tra_ve_Moc_mang_Mach_DA_TUOI(mach, tac_gia):
    """`them_moc(...).mach` phải là bản SAU khi đếm lại, không phải bản trước.

    `Moc.objects.create(mach=mach_khoa, ...)` cache `mach_khoa` vào `_state.fields_cache`,
    mà `cap_nhat_dem_mach` nay đọc lại hàng thay vì sửa tại chỗ. Không gán lại thì handler
    `POST /machs/{id}/mocs` của Phase 2 trả `moc.mach.entry_count` = số CŨ: báo "8 mốc"
    ngay sau khi vừa tạo mốc 9, HTTP 200, không gì đỏ.
    """
    truoc = mach.entry_count
    moc = them_moc(mach=mach, author=tac_gia, body="mốc nối thêm")

    assert moc.mach.entry_count == truoc + 1, "Mach cache trong Moc trả về là bản CŨ"
    assert moc.mach.entry_count == Moc.objects.filter(mach=mach).count()
    assert moc.mach.last_entry_at == moc.created_at


@pytest.mark.django_db(transaction=True)
def test_cap_nhat_dem_mach_goi_NGOAI_transaction_thi_NO():
    """Hàm hứa "tự khoá hàng `Mach`" — hứa đó chỉ có nghĩa BÊN TRONG một transaction.

    Bọc thân hàm bằng `transaction.atomic()` cho "tiện" biến lời hứa thành: âm thầm mở
    transaction riêng, khoá xong NHẢ NGAY — mở lại đúng cửa trôi số mà docstring khẳng
    định đã đóng, mà cả bộ test vẫn xanh (mutant đó sống qua 173 bài). Bài này ghim cửa
    đó: ngoài transaction thì phải NỔ, không được im lặng làm việc.

    Cần `transaction=True` vì `django_db` thường bọc sẵn mọi test trong một `atomic`.
    """
    from django.db.transaction import TransactionManagementError

    from core.ghi import cap_nhat_dem_mach
    from core.models import Sub, User

    tac_gia = User.objects.create_user(username="ngoai_txn", password="x")
    sub = Sub.objects.create(slug="ngoai-txn", ten="Ngoài txn")
    mach, _ = tao_mach(sub=sub, author=tac_gia, title="Mạch thử", body="thân bài")

    with pytest.raises(TransactionManagementError, match="select_for_update"):
        cap_nhat_dem_mach(mach)
