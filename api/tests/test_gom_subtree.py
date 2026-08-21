"""`path` phải THẬT SỰ phục vụ được việc gom subtree — plan vá W2, tiêu chí Q2.

PLAN mục 6 nói `path` tồn tại để "gom cả subtree bằng một query". Câu đó chỉ đúng nếu
Postgres dùng được index cho `LIKE 'tiền tố%'`, và nó **chỉ làm vậy khi cột có collation
`C`** (hoặc opclass `*_pattern_ops`). Dưới collation locale — DB dev là
`English_United Kingdom.1252` — cùng truy vấn tụt xuống `Filter:`.

**Vì sao phải đo bằng `EXPLAIN` chứ không phải bằng `pg_indexes`.** Bản trước của Phase
1a khẳng định chỗ này bằng `SELECT indexdef ... LIKE '%(mach_id, path)%'` — index có
tồn tại thật, và bài đo xanh, trong khi truy vấn thì vẫn quét. Sự tồn tại của một cây
b-tree không nói gì về việc planner có dùng được nó cho *phép toán này* hay không; chỉ
`EXPLAIN` nói.

**Vì sao phải tắt `enable_seqscan` VÀ `enable_bitmapscan`.** Bảng test có vài chục hàng,
planner chọn `Seq Scan` vì rẻ hơn — đúng, nhưng không trả lời được câu hỏi. Tắt hai
đường đó là hỏi thẳng: "khi buộc phải đi index, mày có đẩy được điều kiện `path` xuống
index không?". Cáo buộc V3 của phản biện được dựng đúng bằng cách này, và câu trả lời
lúc đó là **không**.
"""

import re

import pytest
from django.db import connection

from core.cay_binh_luan import gom_subtree
from core.ghi import tao_binh_luan

pytestmark = pytest.mark.django_db


#: Index mà PLAN mục 6 (sau khi sửa ngược 2026-08-21) giao nhiệm vụ gom subtree.
INDEX_GOM_SUBTREE = "comment_duy_nhat_path"


def _co_lap_index(giu: str) -> None:
    """Bỏ mọi index khác của `core_comment` để câu hỏi chỉ còn một cách trả lời.

    **Vì sao cần bước này, và vì sao nó không phải mẹo làm đẹp kết quả.** Câu hỏi của W2
    là *"cây `(mach_id, path)` có phục vụ được `LIKE 'tiền tố%'` không"* — chính khẳng
    định vừa được viết ngược vào `PLAN.md` mục 6 để bỏ `INDEX (mach, path)` riêng. Nhưng
    `core_comment` còn ba index khác cũng dẫn đầu bằng `mach_id` (index FK tự sinh,
    `comment_anchor_goc`, `comment_mach_author`). Trên bảng test vài chục hàng, cả bốn
    cùng "đủ rẻ", và planner từng chọn index FK — plan ra `Index Cond: (mach_id = ...)`
    + `Filter: path ~~ ...`, tức bài đo đỏ vì planner chọn cây khác chứ không phải vì
    collation sai. Đó là nhiễu, không phải tín hiệu.

    DDL của Postgres nằm trong transaction, và test này chạy dưới transaction bị rollback
    của pytest-django, nên các index quay lại nguyên vẹn khi test kết thúc.
    """
    with connection.cursor() as cur:
        cur.execute(
            "SELECT indexname FROM pg_indexes WHERE tablename = 'core_comment' "
            "AND indexname NOT IN (%s, 'core_comment_pkey')",
            [giu],
        )
        ten_index = [hang[0] for hang in cur.fetchall()]
        assert ten_index, "không tìm thấy index nào để bỏ — truy vấn catalog sai rồi"
        for ten in ten_index:
            # Tên lấy thẳng từ catalog, không phải đầu vào người dùng.
            cur.execute(f'DROP INDEX "{ten}"')


def _plan(qs) -> str:
    """Kế hoạch thực thi của `qs`, với seq scan và bitmap scan bị tắt."""
    sql, params = qs.query.sql_with_params()
    with connection.cursor() as cur:
        # `SET LOCAL` — chỉ trong transaction của test này, không rò sang test khác.
        cur.execute("SET LOCAL enable_seqscan = off")
        cur.execute("SET LOCAL enable_bitmapscan = off")
        cur.execute("EXPLAIN " + sql, params)
        return "\n".join(hang[0] for hang in cur.fetchall())


def test_cot_path_co_collation_C_o_tang_DB():
    """Đọc catalog: `db_collation="C"` trong model phải thành collation THẬT của cột.

    Bài đo rẻ này bắt đúng một ca mà `EXPLAIN` không bắt: migration bị revert hoặc squash
    làm mất `ALTER COLUMN ... COLLATE`, trong khi model vẫn khai — code nói một đằng, DB
    một nẻo.
    """
    with connection.cursor() as cur:
        cur.execute(
            "SELECT c.collname FROM pg_attribute a "
            "JOIN pg_collation c ON c.oid = a.attcollation "
            "WHERE a.attrelid = 'core_comment'::regclass AND a.attname = 'path'"
        )
        assert cur.fetchone()[0] == "C"


def test_gom_subtree_day_dieu_kien_path_XUONG_INDEX(mach, tac_gia, nguoi_khac):
    """Điều kiện tiền tố phải nằm trong `Index Cond`, không phải trong `Filter`.

    Đây là bài đo giết mutant "trả `path` về collation mặc định": lúc đó `Index Cond` chỉ
    còn `mach_id = ...` và toàn bộ việc lọc `path` rơi xuống `Filter`, tức đọc hết mọi
    bình luận của mạch rồi mới loại — đúng thứ `path` sinh ra để tránh.

    Ghi chú về dòng `Filter: ((path)::text ~~ '...%')` vẫn còn trong plan kể cả khi đã
    đúng: đó là **recheck** của Postgres cho toán tử `~~`. Điều kiện khoảng
    (`path >= 'x' AND path < 'y'`) chỉ là xấp xỉ của `LIKE` về mặt hình thức nên toán tử
    gốc được giữ lại để lọc lần cuối trên đúng những hàng index đã trả về. Nó KHÔNG phải
    dấu hiệu quét bảng; thứ phân biệt "dùng được index" với "không" là `Index Cond` có
    cận `path` hay không.

    (Có thể viết truy vấn thành khoảng `path__gte`/`path__lt` để plan sạch bóng `Filter`.
    Cố ý KHÔNG làm: dạng khoảng dùng được index dưới MỌI collation, nên nó sẽ xanh cả khi
    collation bị trả về mặc định — một bài đo không đo gì. Xem `gom_subtree`.)
    """
    goc = tao_binh_luan(mach=mach, author=tac_gia, body="gốc", anchor_moc_seq=1)
    con = tao_binh_luan(mach=mach, author=nguoi_khac, body="con", parent=goc)
    tao_binh_luan(mach=mach, author=tac_gia, body="cháu", parent=con)

    _co_lap_index(INDEX_GOM_SUBTREE)
    plan = _plan(gom_subtree(goc))

    assert "Seq Scan" not in plan, plan
    assert INDEX_GOM_SUBTREE in plan, plan
    dong_index_cond = [d.strip() for d in plan.splitlines() if "Index Cond:" in d]
    assert dong_index_cond, f"không có Index Cond nào — plan:\n{plan}"
    # Postgres in cột ra dạng `(path)::text` vì Django ép kiểu cho toán tử pattern; khớp
    # lỏng ở chỗ đó, chặt ở chỗ có nghĩa (tên cột + chiều so sánh).
    dieu_kien = " ".join(dong_index_cond)
    assert re.search(r"path\)?(::text)? >=", dieu_kien), (
        "cận dưới của tiền tố KHÔNG được đẩy xuống index — `LIKE 'x%'` đang bị lọc sau "
        f'khi đọc. Nhiều khả năng cột `path` mất collation "C".\nplan:\n{plan}'
    )
    assert re.search(r"path\)?(::text)? <", dieu_kien), (
        f"thiếu cận trên của tiền tố.\nplan:\n{plan}"
    )


def test_gom_subtree_lay_dung_ca_nhanh_va_khong_lan_sang_anh_em(
    mach, sub, tac_gia, nguoi_khac
):
    """Bài đo HÀNH VI, đi kèm bài đo kế hoạch ở trên.

    Một truy vấn có thể dùng index rất đẹp mà trả sai tập hàng. Hai chỗ dễ sai nhất được
    dựng thẳng vào dữ liệu: **anh em cùng tầng** (không được lọt) và **mạch khác cùng
    path** (`UNIQUE (mach, path)` chỉ duy nhất trong phạm vi một mạch, nên path "000001"
    tồn tại ở mọi mạch — thiếu `mach=` là trộn dữ liệu người khác vào, im lặng).
    """
    from core.ghi import tao_mach

    goc = tao_binh_luan(mach=mach, author=tac_gia, body="gốc", anchor_moc_seq=1)
    con = tao_binh_luan(mach=mach, author=nguoi_khac, body="con", parent=goc)
    chau = tao_binh_luan(mach=mach, author=tac_gia, body="cháu", parent=con)
    anh_em = tao_binh_luan(mach=mach, author=tac_gia, body="anh em", anchor_moc_seq=1)

    mach_khac, _ = tao_mach(
        sub=sub, author=tac_gia, title="Mạch khác", body="Mốc 1 của mạch khác."
    )
    trung_path = tao_binh_luan(
        mach=mach_khac, author=tac_gia, body="trùng path, khác mạch", anchor_moc_seq=1
    )
    assert trung_path.path == goc.path, "dựng sai bối cảnh: hai path phải trùng nhau"

    thu_duoc = set(gom_subtree(goc).values_list("pk", flat=True))
    assert thu_duoc == {goc.pk, con.pk, chau.pk}
    assert anh_em.pk not in thu_duoc
    assert trung_path.pk not in thu_duoc
