# Plan con — Phase 0, vòng 5: đổi hàng rào sang ALLOWLIST

> User chốt 2026-08-21: đóng khoản nợ 8/9/10/11 của `plans/2026-08-21-phase-0-va-vong-4.md`
> ngay, thay vì mang sang phase sau. Xong vòng này thì **commit Phase 0** (user đã đồng ý).
> Phạm vi HẸP — chỉ 4 khoản dưới đây, không mở thêm.

## 0. Vì sao

Phản biện vòng 4 chứng minh hai hàng rào của vòng 4 đều là **blocklist**, và blocklist thì luôn
thiếu một hình dạng:

- `scripts/rao-can-exports.mjs` chỉ cấm `*` và đòi mỗi khoá có subpath. **Không cấm subpath thừa
  trỏ vào file nội bộ CÓ THẬT.** Ca tái hiện: dev gõ
  `import { client } from "@gikky/api-client/client.gen"` → `ERR_PACKAGE_PATH_NOT_EXPORTED`
  **in ra đúng tên subpath còn thiếu** → dev thêm `"./client.gen": "./src/client.gen.ts"` →
  `kiemTraExports` qua, `kiemTraIndex` mù (chỉ đọc `src/index.ts`), codegen/check/test/lint
  **xanh hết** → `src/client.gen.ts` `export const client` sống lại. Đây là lỗ **IM LẶNG**, và
  hậu quả ở Phase 3 là request user B đọc dữ liệu bằng session user A, trang vẫn 200.
- Khối MỒ CÔI trong `codegen-check.mjs` dùng regex khớp chính xác (`LA_DO_SINH_RA`), nên
  `src-zz.bak`, `openapi.zz.json.tmp`, `src.old` **vô hình với cả khối mồ côi lẫn phép so hash**.

## 1. Việc

### H1 — `rao-can-exports.mjs`: blocklist → ALLOWLIST
Tập `Object.keys(exports)` phải **BẰNG ĐÚNG** `{"."} ∪ {"./<khoá>" : khoá ≠ "v1"}`. Với mỗi
subpath: đích phải bằng đúng `./<basename(srcDir)>/index.ts` **và tồn tại trên đĩa**.
Thừa một subpath ⇒ chặn. Thiếu ⇒ chặn. Đích sai/treo ⇒ chặn. Wildcard vẫn ⇒ chặn (allowlist
bao luôn, nhưng **giữ thông điệp riêng cho wildcard** vì nó là ca hay gặp nhất và cần giải thích
vì sao cấm).

### H2 — khối MỒ CÔI: regex blocklist → ALLOWLIST
Mọi tên cấp 1 trong `packages/api-client/` **không** thuộc
`{package.json, node_modules} ∪ tenSinhRaHopLe(khoas)` đều bị nêu là rác. Thay cho việc chỉ nêu
những tên khớp `LA_DO_SINH_RA`.
⚠ Cẩn thận báo động giả: nghĩ trước xem còn thứ gì hợp lệ có thể nằm ở đó (vd `README.md`,
`tsconfig.json` nếu sau này thêm) — nếu có thì đưa vào allowlist tường minh, **đừng** nới regex.

### H3 — bốn chỗ "số đo" không đo cái nó nói (khoản 10)
1. `daSoi` đếm vòng lặp, không đếm lượt hàng rào chạy ⇒ cắt đúng dòng `kiemTraIndex` thì vẫn in
   "đã soi 1 index.ts". **Sửa: cho `kiemTraIndex`/`kiemTraExports` trả về cả số đã soi**, in số
   lấy từ đó.
2. `"exports sạch"` là khẳng định, không phải số đo ⇒ in số subpath đã kiểm.
3. `${moCoi.length}` trên đường thành công **luôn** = 0 (vì `moCoi.length > 0` đã `exit 1` trước)
   ⇒ in số tên đã quét thay vì số mồ côi.
4. `daSoi.length !== khoas.length` **không thể sai** (hai vế sinh từ cùng một vòng lặp không
   `break`) ⇒ bỏ hẳn, đừng giữ code chết đội lốt hàng rào.

### H4 — ba chỗ chữ (khoản 11)
- `rao-can-exports.mjs`: thông điệp khi `exports` là **chuỗi** nói sai lý do (chuỗi `exports` xuất
  đúng một đường, không "xuất sạch mọi file"). Từ chối thì vẫn đúng — sửa lý do.
- `CLAUDE.md`: bỏ chữ "**nữa**" trong "cố ý không export subpath `./client` nữa" — repo chưa từng
  có nó (0 commit).
- `api/tests/test_api_registry.py`: biến tên `khoa` thực chất là `id(api)` — đổi tên cho đúng.

## 2. Tiêu chí nghiệm thu (mỗi cái là một lượt THỬ PHÁ, dán output)

| # | Tiêu chí |
|---|---|
| H1a | Thêm `"./client.gen": "./src/client.gen.ts"` → `codegen:check` **exit 1**. **Đây là ca chính của vòng này.** |
| H1b | Thêm subpath thừa trỏ file **không tồn tại** → exit 1 |
| H1c | Xoá subpath `"."` → exit 1 |
| H1d | `"./*": "./src/*"` → vẫn exit 1, **vẫn giữ thông điệp riêng về wildcard** |
| H1e | Trạng thái ĐÚNG hiện tại (chỉ `"."`) → exit 0, **không báo động giả** |
| H2a | `mv src → src.bak` (giữ nguyên phần còn lại) → exit 1 nêu đúng tên rác |
| H2b | Tạo `packages/api-client/openapi.zz.json.tmp` → exit 1 |
| H2c | Trạng thái đúng → exit 0, không báo động giả |
| H3a | Cắt dòng gọi `kiemTraIndex` trong `codegen.mjs` → số in ra phải **lộ** (vd `đã soi 0/1`), không được vẫn in `1` |
| H3b | Cắt dòng gọi `kiemTraExports` → tương tự |
| H4 | 3 chỗ chữ đúng |
| H5 | **Không hồi quy**: A1–A17 · B1–B16 · C1a–C8 · G1–G8 · `pytest` 32 passed 0 warning · `codegen:check` khớp 17 file · `lint`/`build` 0 warning |
| H6 | 0 commit; `packages/api-client` không rác; `api/` không có `packages/` |

## 2b. NỢ MỚI phản biện vòng 5 tìm ra (ghi ra, KHÔNG sửa trước commit đầu)

> Phản biện vòng 5 thử **25 hình dạng `exports`** trong harness biệt lập: 21 chặn, 4 qua, cả 4 ca
> qua đều là hình dạng đúng ⇒ **không có fail-open**. Ba khoản dưới đây là nợ, không chặn commit.
> Khoản #1 của nó (CLAUDE.md dạy lối thoát không tồn tại) **đã sửa** trước commit.

- **N5-1 — Import TƯƠNG ĐỐI hoàn toàn không có rào.** Allowlist chỉ canh cửa `exports`.
  `apps/web/app/bad.ts` viết `import { client } from "../../../packages/api-client/src/client.gen"`
  là singleton sống lại; `next.config.ts` đã `transpilePackages` nên webpack nuốt trôi;
  `lint`/`build`/`codegen:check`/`pytest` **không gì đỏ**. Hai `eslint.config.mjs` không có
  `no-restricted-imports`, không có `rootDir`.
  ⚠ **Vòng 5 làm cửa "thêm subpath" đỏ, nên cửa dễ NHẤT bây giờ chính là cửa này** — allowlist
  đẩy áp lực sang đúng chỗ chưa ai canh. **Hướng đóng (rẻ, chạy trong `pnpm lint` sẵn có):**
  `no-restricted-imports` pattern `**/packages/api-client/src/**` ở cả hai config.
  *(Bằng chứng đọc code, chưa chạy — phản biện bị cấm chạy `pnpm`.)*
- **N5-2 — Hai "số đo" của H3 chỉ được IN, không được KHẲNG ĐỊNH.** `daSoiIndex`/`daSoiSubpath`
  chỉ xuất hiện ở `console.log` cuối. Xoá cả hai khối gọi hàng rào (`codegen.mjs:89-97` +
  `codegen-check.mjs:157-165`) ⇒ cả hai lệnh **exit 0**, dấu vết duy nhất là hai con số trong
  stdout mà không ai diff — và repo **chưa có CI** nên không ai diff thật.
  **Đây là lỗi của plan này:** §H3.4 bảo xoá `daSoi.length !== khoas.length` với lý do "không thể
  sai vì hai vế sinh từ cùng một vòng lặp". Lý do đó đúng với code CŨ và **bị chính H3.1 làm hết
  đúng** — sau H3.1 thì `daSoi` do hàng rào trả về, nên bất đẳng thức đó sai **đúng khi lời gọi
  hàng rào bị cắt**, tức đúng ca H3 sinh ra để chống. Plan gỡ cái chốt ngay lúc nó bắt đầu có
  nghĩa. **Hướng đóng (4 dòng):** khẳng định lại
  `daSoiIndex.length !== khoas.length || daSoiSubpath.length === 0` ⇒ exit 1.
- **N5-3 — `tenXuatRa` vứt diagnostics ⇒ hàng rào singleton MÙ MỘT PHẦN mà vẫn tự khai "đã soi".**
  `rao-can-client.mjs:34-49` không đọc `getSemanticDiagnostics`. `export *` mà TS không resolve
  nổi đóng góp 0 tên, phần còn lại vẫn có tên ⇒ `ten.length > 0` ⇒ trả `{than: [], daSoi: [...]}`.
  Phản biện **chạy thật trong scratchpad**: `export * from './khong-co-file'` ⇒ QUA;
  `export * from '#internal/client.gen'` ⇒ QUA. Mâu thuẫn thẳng với docstring của chính file
  (*"checker hỏng mà trả 'sạch' còn nguy hơn không có checker"*) — nó hiện thực nửa "bề mặt RỖNG",
  không hiện thực nửa "mù một phần". **Hướng đóng:** gom diagnostics mã **TS2307**; có cái nào thì
  trả "không đo được" (than + `daSoi: []`), đừng trả bề mặt cụt.
- **Vặt:** thông điệp chặn `{types, default}` nói sai lý do (`types` là compile-time, không phải
  "hai bản sao module ở runtime") — và đây là hình dạng hợp lệ ĐẦU TIÊN người ta gặp khi package
  cần khai `types` · nhánh `existsSync` ("subpath treo") **không ca nghiệm thu nào chạm tới**
  (H1b rơi vào nhánh THỪA trước) · `CLAUDE.md` chưa ghi hai ràng buộc mới của vòng 5: thêm file
  hợp lệ vào `packages/api-client/` (vd `tsconfig.json` — gần như chắc chắn xảy ra ở Phase 1)
  **bắt buộc phải sửa `TEN_HOP_LE_KHONG_SINH_RA`**, và 3 việc phải làm ĐÚNG THỨ TỰ.

## 3. Ngoài phạm vi — giữ nguyên là nợ
Khoản 1–7 của plan vòng 4 (test JS cho `setup-env`, hàng rào theo declaration file, `codegen:check`
tự chữa lành, danh sách 5 từ khoá, **Docker + CI chưa ai chạy**, `data-testid`, traceback
`NoReverseMatch`). **Không đụng.**
