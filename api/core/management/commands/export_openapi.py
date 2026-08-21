"""Xuất OpenAPI schema ra file — nguồn cho codegen TS (PLAN 8.3).

Command TỰ GHI FILE, không dùng redirect `>` của shell: PowerShell 5.1 ghi ra
UTF-16/BOM làm openapi-ts và bước kiểm drift vỡ.

Ràng buộc output (để 2 lần chạy ra CÙNG byte): UTF-8 không BOM, newline LF,
`sort_keys=True`, `ensure_ascii=False`, `indent=2`, có newline cuối file.

API nào xuất được là do `config/api_registry.py` quyết định — đọc docstring ở đó
trước khi thêm `NinjaAPI` mới.

`--list` in mảng JSON mọi khoá đã đăng ký. Nó tồn tại để `scripts/codegen.mjs` LẶP theo
registry thay vì viết cứng `v1`: viết cứng thì Phase 4 đăng ký `api_admin` xong là chuông
`tests/test_api_registry.py` xanh trở lại, trong khi client TS vẫn thiếu sạch nhóm admin.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from config.api_registry import NINJA_APIS


class Command(BaseCommand):
    help = "Xuất OpenAPI schema của một API đã đăng ký ra file JSON (UTF-8, LF, ổn định byte)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            help="Đường dẫn file JSON sẽ được ghi đè. Bắt buộc, trừ khi dùng --list.",
        )
        parser.add_argument(
            "--api",
            default="v1",
            help=f"Khoá trong config.api_registry.NINJA_APIS. Đang có: {', '.join(sorted(NINJA_APIS))}.",
        )
        parser.add_argument(
            "--list",
            dest="liet_ke",
            action="store_true",
            help=(
                "In mảng JSON mọi khoá của NINJA_APIS rồi thoát. `scripts/codegen.mjs` lặp "
                "theo danh sách này để không bỏ sót API nào."
            ),
        )

    def handle(self, *args, **options):
        if options["liet_ke"]:
            # In ĐÚNG một mảng JSON, không thêm chữ nào: đây là dữ liệu cho
            # `scripts/api-registry.mjs` parse, không phải log cho người đọc.
            self.stdout.write(json.dumps(sorted(NINJA_APIS), ensure_ascii=False))
            return

        if not options["output"]:
            raise CommandError(
                "Thiếu --output. Command TỰ GHI FILE — không dùng redirect `>` của shell "
                "(PowerShell 5.1 ghi ra UTF-16/BOM, làm codegen và bước kiểm drift vỡ)."
            )

        ten = options["api"]
        try:
            api = NINJA_APIS[ten]
        except KeyError as loi:
            raise CommandError(
                f"Không có API tên {ten!r} trong config.api_registry.NINJA_APIS "
                f"(đang có: {', '.join(sorted(NINJA_APIS))}). "
                "Mount một NinjaAPI mới thì phải đăng ký nó vào đó."
            ) from loi

        schema = json.loads(json.dumps(api.get_openapi_schema()))
        text = json.dumps(schema, sort_keys=True, ensure_ascii=False, indent=2) + "\n"

        output = Path(options["output"]).resolve()
        # KHÔNG `mkdir(parents=True)`. `codegen.mjs` luôn truyền đường dẫn TUYỆT ĐỐI vào
        # `packages/api-client/` — thư mục đó có sẵn trong repo. Tự tạo cây thư mục chỉ phục
        # vụ đúng một ca: đường dẫn tương đối gõ nhầm, và ca đó thì đẻ ra `api/packages/...`
        # rồi in như đã thành công. `api/packages/` không nằm trong `.gitignore`, nên rác đó
        # đi thẳng vào commit kế tiếp.
        if not output.parent.is_dir():
            raise CommandError(
                f"Thư mục cha không tồn tại: {output.parent}. Command KHÔNG tự tạo thư mục. "
                "Đường dẫn tương đối tính từ `api/` (scripts/py.mjs chạy manage.py với "
                "cwd=api/), KHÔNG phải từ gốc repo — dùng `--output "
                "../packages/api-client/openapi.json`, đường dẫn tuyệt đối, hoặc `pnpm codegen`."
            )
        output.write_text(text, encoding="utf-8", newline="\n")

        self.stdout.write(f"OpenAPI schema ({ten}) -> {output}")
