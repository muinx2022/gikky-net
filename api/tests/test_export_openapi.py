"""`export_openapi` phải ổn định BYTE giữa hai lần chạy — kể cả khác process.

Schema không ổn định (thứ tự khoá đổi, CRLF, BOM) làm bước kiểm drift codegen ở CI
báo giả — PLAN 8.3.

Vì sao phải là hai PROCESS chứ không phải hai lời gọi trong cùng process: nguồn bất
định thật của JSON schema là thứ tự lặp của `set`/`hash`, mà `PYTHONHASHSEED` cố định
suốt vòng đời một process. Hai lời gọi trong cùng process **không thể** đỏ vì lớp lỗi
đó — chúng chỉ chứng minh hàm không tự đổi ý giữa chừng.
"""

import json
import os
import subprocess
import sys
from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from core.management.commands import export_openapi as lenh_export

API_DIR = Path(__file__).resolve().parent.parent
MANAGE = API_DIR / "manage.py"


def _xuat_trong_process_rieng(path: Path, hashseed: str) -> bytes:
    ket_qua = subprocess.run(
        [sys.executable, str(MANAGE), "export_openapi", "--output", str(path)],
        cwd=str(API_DIR),
        env={**os.environ, "PYTHONHASHSEED": hashseed},
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    assert ket_qua.returncode == 0, ket_qua.stderr
    return path.read_bytes()


def _xuat(path: Path) -> bytes:
    call_command("export_openapi", "--output", str(path))
    return path.read_bytes()


def test_hai_process_khac_hashseed_ra_cung_byte(tmp_path):
    lan_1 = _xuat_trong_process_rieng(tmp_path / "seed0.json", "0")
    lan_2 = _xuat_trong_process_rieng(tmp_path / "seed1.json", "1")

    assert lan_1 == lan_2, (
        "Schema đổi byte khi PYTHONHASHSEED đổi — có chỗ thứ tự phụ thuộc `set`/`hash`. "
        "CI kiểm drift sẽ báo giả ngẫu nhiên."
    )


def test_file_la_utf8_khong_bom_newline_lf(tmp_path):
    raw = _xuat(tmp_path / "schema.json")

    assert not raw.startswith(b"\xef\xbb\xbf"), "có BOM — PowerShell redirect lọt vào?"
    assert b"\r" not in raw, "có CRLF — sẽ làm CI kiểm drift báo giả"
    assert raw.endswith(b"\n"), "thiếu newline cuối file"
    raw.decode("utf-8")


def test_schema_chua_endpoint_health(tmp_path):
    schema = json.loads(_xuat(tmp_path / "schema.json"))

    assert "/api/v1/health" in schema["paths"]


class _Obj(list):
    """Một object JSON, giữ NGUYÊN thứ tự khoá như nó nằm trong FILE.

    Không dùng `dict`: `json.loads` mặc định cũng giữ thứ tự chèn, nhưng đi qua `dict` là
    mất khả năng phân biệt "object" với "mảng", mà walker dưới đây cần phân biệt.
    """


def _moi_object(node, duong="$"):
    """Sinh cặp (đường dẫn, danh sách khoá theo đúng thứ tự file) cho MỌI object JSON."""
    if isinstance(node, _Obj):  # phải xét trước `list` — `_Obj` là con của `list`
        yield duong, [khoa for khoa, _ in node]
        for khoa, gia_tri in node:
            yield from _moi_object(gia_tri, f"{duong}.{khoa}")
    elif isinstance(node, list):
        for i, gia_tri in enumerate(node):
            yield from _moi_object(gia_tri, f"{duong}[{i}]")


def test_moi_object_trong_file_deu_co_khoa_da_sap_xep(tmp_path):
    """`sort_keys=True` là điều kiện ổn định byte (plan 3.2) — phải có gì canh nó.

    Trước test này, đổi `sort_keys=True` thành `False` vẫn `4 passed`: bộ test cũ bắt được
    mutant kiểu `set` (hai PYTHONHASHSEED ra cùng byte) nhưng không đụng tới chính cái khoá
    được chốt. `dict` của Python giữ thứ tự CHÈN, nên bỏ `sort_keys` đi thì hai lượt chạy
    vẫn ra cùng byte — chỉ là byte đó phụ thuộc thứ tự django-ninja dựng schema.
    """
    cay = json.loads(_xuat(tmp_path / "schema.json").decode("utf-8"), object_pairs_hook=_Obj)

    da_tham = {}
    for duong, khoa in _moi_object(cay):
        da_tham[duong] = khoa

    # Chốt chính cái thước đo trước: walker mù thì mọi assert dưới đây đều đúng-rỗng.
    assert {"$", "$.paths", "$.components"} <= set(da_tham), (
        f"Walker không tới được cả 3 nhánh gốc — chỉ thấy: {sorted(da_tham)[:20]}. "
        "Thước hỏng, không phải schema sạch."
    )
    assert len(da_tham) >= 10, f"Chỉ duyệt được {len(da_tham)} object JSON — schema rỗng?"

    lech = [f"{duong}: {khoa}" for duong, khoa in da_tham.items() if khoa != sorted(khoa)]
    assert not lech, (
        "Khoá trong file KHÔNG được sắp xếp — `sort_keys=True` của export_openapi bị bỏ? "
        f"Nơi lệch đầu tiên: {lech[0]} (tổng {len(lech)} chỗ)."
    )


def test_list_in_dung_khoa_doc_tu_registry(monkeypatch):
    """`--list` phải ĐỌC `NINJA_APIS`, không được in một danh sách viết cứng.

    Mutant cần giết: `--list` in sẵn `["v1"]`. `scripts/codegen.mjs` lặp theo output này,
    nên một `--list` viết cứng đưa cái lỗ cũ (chỉ sinh client cho `v1`) trở lại nguyên vẹn,
    và lần này còn khoác thêm vẻ ngoài "đã lặp theo registry".
    """
    them = {**lenh_export.NINJA_APIS, "zz_gia_dinh": object()}
    monkeypatch.setattr(lenh_export, "NINJA_APIS", them)

    out = StringIO()
    call_command("export_openapi", "--list", stdout=out)

    assert json.loads(out.getvalue()) == sorted(them)


def test_list_khong_can_output(tmp_path):
    """`--list` là truy vấn: chạy được khi THIẾU `--output`, và KHÔNG ghi file.

    Bản trước của test này assert `not list(tmp_path.iterdir())` mà **không hề đưa
    `tmp_path` cho command** — đúng bất kể `handle` làm gì. Nay mỗi mệnh đề có mutant giết
    được nó:
    - đưa nhánh `--list` xuống SAU khối kiểm `--output` ⇒ lượt đầu ném `CommandError` ⇒ đỏ;
    - để `handle` ghi schema rồi mới xét `--list` ⇒ lượt sau đẻ file trong `tmp_path` ⇒ đỏ.

    Không assert nội dung mảng ở đây: `test_list_in_dung_khoa_doc_tu_registry` đã chốt
    đúng chuyện đó và chốt chặt hơn (nó thêm khoá giả để chứng minh có ĐỌC registry).
    """
    khong_output = StringIO()
    call_command("export_openapi", "--list", stdout=khong_output)
    assert isinstance(json.loads(khong_output.getvalue()), list)

    dich = tmp_path / "khong-duoc-ghi.json"
    co_output = StringIO()
    call_command("export_openapi", "--list", "--output", str(dich), stdout=co_output)

    assert list(tmp_path.iterdir()) == [], (
        f"`--list` ghi file dù nó chỉ là truy vấn: {[p.name for p in tmp_path.iterdir()]}"
    )
    assert json.loads(co_output.getvalue()) == json.loads(khong_output.getvalue()), (
        "`--list` đổi output khi có thêm `--output` — nó phải bỏ qua tham số đó."
    )


def test_output_khong_tu_tao_thu_muc_cha(tmp_path):
    """Thư mục cha không có ⇒ CHẾT, không được lặng lẽ `mkdir(parents=True)`.

    Ca thật: gõ `manage.py export_openapi --output packages/api-client/openapi.json` từ
    thư mục `api/` (đường dẫn trong PLAN mục 7 là tương đối với GỐC repo). Bản cũ tạo
    `api/packages/api-client/` rồi in ra như đã thành công — mà `api/packages/` không nằm
    trong `.gitignore`.
    """
    chua_co = tmp_path / "packages" / "api-client"

    with pytest.raises(CommandError, match="Thư mục cha không tồn tại"):
        call_command("export_openapi", "--output", str(chua_co / "openapi.json"))

    assert not chua_co.exists(), f"vẫn tự tạo {chua_co}"
    assert list(tmp_path.iterdir()) == [], "vẫn đẻ ra thư mục trung gian"


def test_thieu_output_thi_bao_loi_ro_rang():
    """Thông điệp phải chỉ ĐÚNG việc cần làm, không chỉ nói "thiếu tham số".

    Khớp trên chữ "redirect" là cố ý: `required=True` của argparse cũng báo thiếu
    `--output`, nên một assert chung chung sẽ xanh dưới cả hai cách viết và không phân
    biệt được gì. Cái người gõ nhầm cần biết là *vì sao* không được dùng `>`.
    """
    with pytest.raises(CommandError, match="redirect"):
        call_command("export_openapi")


def _moi_mo_ta(node):
    """Mọi giá trị `description`/`summary` trong schema — phần chữ CÔNG KHAI của hợp đồng."""
    if isinstance(node, dict):
        for khoa, gia_tri in node.items():
            if khoa in ("description", "summary") and isinstance(gia_tri, str):
                yield gia_tri
            else:
                yield from _moi_mo_ta(gia_tri)
    elif isinstance(node, list):
        for gia_tri in node:
            yield from _moi_mo_ta(gia_tri)


#: Chữ chỉ có nghĩa với người sửa repo này. Ninja đổ docstring của view vào `description`,
#: nên nó chảy thẳng ra openapi.json, ra JSDoc của sdk.gen.ts và ra `/api/v1/openapi.json`.
GHI_CHU_NOI_BO = ("filterwarnings", "pytest", "deprecate", "KHÔNG SỬA TAY", "monkeypatch")


def test_mo_ta_cong_khai_khong_lan_ghi_chu_noi_bo(tmp_path):
    schema = json.loads(_xuat(tmp_path / "schema.json"))

    mo_ta = list(_moi_mo_ta(schema))
    assert mo_ta, "Không moi được description nào — walker hỏng, không phải schema sạch."

    ro = [
        (dau, chuoi)
        for chuoi in mo_ta
        for dau in GHI_CHU_NOI_BO
        if dau.lower() in chuoi.lower()
    ]
    assert not ro, (
        "Ghi chú nội bộ rò vào hợp đồng API công khai (docstring của view -> `description` "
        f"của OpenAPI): {ro}. Chuyển đoạn đó thành comment `#` bên ngoài docstring."
    )


def test_api_khong_dang_ky_thi_bao_loi_chu_khong_xuat_bua(tmp_path):
    """`--api` sai tên phải CHẾT, không được lặng lẽ xuất `v1` rồi báo thành công."""
    with pytest.raises(CommandError, match="api_registry"):
        call_command(
            "export_openapi",
            "--api",
            "khong-ton-tai",
            "--output",
            str(tmp_path / "x.json"),
        )
