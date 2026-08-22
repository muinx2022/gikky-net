"""Danh sách TƯỜNG MINH mọi `NinjaAPI` của dự án.

Vì sao cần: `export_openapi` chỉ xuất được những API nó biết. Phase 4 thêm
`NinjaAPI` thứ hai cho `/api/admin` (PLAN mục 7) mà quên chỗ này thì `pnpm codegen`
vẫn **exit 0** và sinh ra TS client thiếu sạch endpoint admin — lập trình viên admin
sẽ tự khai interface tay, vi phạm thẳng luật "type một chiều" của PLAN 8.3. Hỏng im
lặng, không có gì đỏ.

Thêm một API mới thì làm ĐỦ 3 việc:

1. mount vào `config/urls.py`;
2. thêm vào `NINJA_APIS` dưới đây;
3. thêm một subpath vào `exports` của `packages/api-client/package.json`, trỏ
   `./src-<khoá>/index.ts` (khoá `v1` đã có sẵn, xuất qua `"."`).

Không phải sửa `scripts/codegen.mjs` — nó đọc chính danh sách này qua
`export_openapi --list` rồi lặp.

Việc 3 hay bị bỏ vì nó nằm ở phía JS: thiếu nó thì codegen vẫn exit 0, `src-<khoá>/` nằm
đó đầy đủ, mà `import` ra `ERR_PACKAGE_PATH_NOT_EXPORTED`. Cách chữa nhanh nhất người ta
thật sự gõ khi gặp lỗi đó là `"./*": "./src/*"` — và wildcard mở lại đúng cái cửa mà luật
cấm `client` singleton (CLAUDE.md, PLAN 8.3) dựng lên để đóng.

BA cái chuông, và cần cả ba:
- `tests/test_api_registry.py` — mount mà quên đăng ký (việc 1 có, việc 2 thiếu);
- `pnpm codegen:check` — đã đăng ký nhưng client TS không được sinh ra. Thiếu cái thứ hai
  thì đăng ký xong là chuông thứ nhất XANH TRỞ LẠI, trong khi client vẫn thiếu sạch nhóm
  endpoint đó. Chuông kêu nửa vời còn nguy hơn không kêu, vì màu xanh trấn an người ta;
- `scripts/rao-can-exports.mjs` (chạy trong cả `codegen` lẫn `codegen:check`) — việc 3
  thiếu, hoặc ai đó vá bằng wildcard.
"""

from api.quan_tri import api_admin
from api.v1 import api_v1

#: khoá = tên dùng cho `manage.py export_openapi --api <khoá>`.
#:
#: Khoá `v1` giữ đường dẫn CŨ (`openapi.json` + `src/`, subpath `"."`); mọi khoá khác ra
#: `openapi.<khoá>.json` + `src-<khoá>/` và subpath `"./<khoá>"` — luật ở
#: `scripts/api-registry.mjs::duongDanCho`, không phải ở đây.
NINJA_APIS = {
    "v1": api_v1,
    "admin": api_admin,
}
