"""Sửa / xoá bình luận — PLAN mục 7, 5.3. Toàn bộ file là đường GHI (Phase 2).

Đường ĐỌC của bình luận nằm ở `api/machs.py` (khán đài) và `api/mocs.py` (ngăn kéo), chia
theo tiền tố URL như phần còn lại của tầng API; `/comments/{id}` chỉ có hai method ghi nên
nó ở riêng đây.
"""

from ninja import Router

from core.doc_noi_dung import Nut, trang_thai_noi_dung
from core.ghi import sua_binh_luan, xoa_binh_luan
from core.revalidate import lam_moi_mach

from api.ghi_chung import doi_con_song, nap_binh_luan
from api.loi import LoiOut
from api.quyen import dang_nhap, doi_chu_so_huu, doi_mach_tuong_tac_duoc
from api.schemas import BinhLuanOut, KetQuaXoaOut
from api.schemas_ghi import BinhLuanSuaIn
from api.trinh_bay import nut_ra

router = Router()


@router.patch(
    "/comments/{int:comment_id}",
    response={200: BinhLuanOut, 400: LoiOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="sua_binh_luan",
    tags=["binh-luan"],
    auth=dang_nhap,
)
def sua_binh_luan_api(request, comment_id: int, du_lieu: BinhLuanSuaIn):
    """Sửa bình luận: đổi `body`, hiện dấu `*đã sửa*` (PLAN 5.3).

    **Quyền: CHỈ tác giả của bình luận** — 403 `khong_phai_chu` cho mọi người khác, kể cả
    chủ mạch. Chủ mạch có quyền trên *cuốn sổ*, không có quyền trên *lời của người khác*.
    Mạch bị mod khoá ⇒ 403; bình luận đã là bia mộ hoặc bị ẩn ⇒ 409.

    **Không có cửa sổ sửa im lặng 15 phút** như mốc, và đó là chủ đích: mốc là *bằng
    chứng* nên nó cần lịch sử bản cũ, bình luận là *tán gẫu* nên nó chỉ cần nói ra rằng đã
    sửa. `anchor_moc_seq` **không** sửa được — đổi neo sau khi thread đã có reply là dời
    cả thread sang một ngăn kéo khác dưới chân người đang đọc.

    Trả về nút bình luận **không kèm `replies`** (mảng rỗng): endpoint này sửa đúng một
    dòng, và trả cả nhánh con là mời UI thay nguyên nhánh bằng dữ liệu nó không hỏi.

    **Gọi `lam_moi_mach`** — xem ghi chú chung ở `xoa_binh_luan_api`.
    """
    c = nap_binh_luan(comment_id)
    doi_chu_so_huu(request.user, c.author_id, "bình luận")
    doi_mach_tuong_tac_duoc(c.mach)
    doi_con_song(c, "Bình luận")
    c = sua_binh_luan(comment=c, body=du_lieu.body, dinh_dang=du_lieu.body_dinh_dang)
    lam_moi_mach(c.mach)
    # `hoat_dong_doc_duoc` không có mặc định (xem `Nut`) và phải truyền cả ở đây, nơi
    # `nut_ra` không bao giờ đọc nó: một nút LẺ không cha không con thì hoạt động của nó
    # là chính nó, và `doi_con_song` ngay trên đã chặn bia mộ nên nhánh `None` không tới
    # được. Giá trị đúng, và nó tồn tại để "quên" ở đường CÂY vẫn là `TypeError`.
    nut = Nut(
        binh_luan=c,
        do_sau=c.do_sau,
        trang_thai=trang_thai_noi_dung(c),
        con=[],
        hoat_dong_doc_duoc=c.created_at,
    )
    return nut_ra(nut, chu_mach_id=c.mach.author_id)


@router.delete(
    "/comments/{int:comment_id}",
    response={200: KetQuaXoaOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="xoa_binh_luan",
    tags=["binh-luan"],
    auth=dang_nhap,
)
def xoa_binh_luan_api(request, comment_id: int):
    """Xoá bình luận theo **luật hai vế** của PLAN 5.3 — nợ 1a bàn giao, trả ở đây.

    **Quyền: CHỈ tác giả của bình luận.** Mạch bị mod khoá ⇒ 403; đã xoá rồi ⇒ 409.

    Luật, nguyên văn: giữ chỗ "[đã xoá]" nếu **có reply con** HOẶC **đã TỪNG được trích
    vào sổ (kể cả trích đã gỡ)**; xoá thật chỉ khi không dính cả hai. Chữ "đã TỪNG" khớp
    đúng `Trich.comment = PROTECT` — `PROTECT` chặn theo hàng, nó không biết `removed_at`
    là gì. Đọc thành "đang được trích" là tiền-kiểm `removed_at IS NULL`, quyết "xoá
    thật", rồi ăn `ProtectedError` ⇒ 500 trên một thao tác hợp lệ của chính chủ.

    **Xoá thật thì dọn `Vote` mồ côi trong cùng transaction** — `Vote` cố ý không có FK
    tới đích nên không có `ON DELETE` nào; nợ này ghi sẵn trong docstring của model từ 1a.

    `xoa_that = false` nghĩa là nút ở lại làm bia mộ: UI phải **render lại** nó chứ không
    gỡ khỏi cây, nếu không cả nhánh con mất chỗ bám.

    ### Vì sao HAI cửa này gọi `lam_moi_mach` còn `POST /comments` thì không (L06)

    PLAN 8.4 điểm 2 xếp *"bình luận mới"* vào nhóm **KHÔNG có signal** — nó sống bằng
    vòng revalidate nền, vì ép nó vào on-demand là gọi ngược gần như mỗi request trên một
    mạch đang sôi. Sửa/xoá thì khác hẳn về hạng: đó là **nội dung biến khỏi trang công
    khai**, cùng ranh giới mà `api/quan_tri_kiem_duyet.py` đã công nhận là sự kiện có
    signal khi mod ẩn một bình luận.

    Bỏ sót nó có giá cụ thể và im lặng: khách xem trang mạch nhận bản ISR
    (`revalidate = 3600`); tác giả xoá xong thì hàng biến khỏi Postgres, nhưng tác giả
    đang đăng nhập nên đi nhánh `/m-phien/` (force-dynamic) — **họ thấy nó đã mất và tin
    là xong**, trong khi khách vẫn đọc nguyên văn tới 60 phút.

    Gọi **sau** khi `core.ghi` đóng transaction của nó: `lam_moi_mach` bọc
    `transaction.on_commit`, mà ngoài `atomic()` thì `on_commit` chạy ngay — tức đúng lúc
    dữ liệu đã nằm trong DB. Cùng lối với `api/mocs.py::trich_vao_so_api`.
    """
    c = nap_binh_luan(comment_id)
    doi_chu_so_huu(request.user, c.author_id, "bình luận")
    doi_mach_tuong_tac_duoc(c.mach)
    doi_con_song(c, "Bình luận")
    mach = c.mach
    xoa_that = xoa_binh_luan(comment=c)
    lam_moi_mach(mach)
    return KetQuaXoaOut(id=comment_id, xoa_that=xoa_that)
