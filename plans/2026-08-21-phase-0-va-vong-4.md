# Plan con — Phase 0, vòng 4 (dọn nốt, VÒNG CUỐI)

> Nguồn: phản biện vòng 3 (F1–F10), phiên chính đã tự kiểm F1/F2/F3. Ngày 2026-08-21.
> **Đây là vòng cuối của Phase 0.** Thứ gì không nằm trong mục 1 thì thành **nợ có tên** ở
> mục 3 — không mở vòng 5.

## 0. Vì sao có vòng này

Nghiệm thu vòng 3 chấm ĐẠT 12/12 C + 17/17 A + 16/16 B. Phản biện vòng 3 vẫn tìm ra **ba thứ
trấn an mà không đo** — đúng lớp lỗi mà cả ba vòng trước đi diệt. Phiên chính tự kiểm:

| Mã | Cáo buộc | Phiên chính kiểm | Kết |
|---|---|---|---|
| F3 | `test_list_khong_can_output` có assert RỖNG | `test_export_openapi.py:141` `assert not list(tmp_path.iterdir())` — `tmp_path` **không hề được truyền cho command** ⇒ đúng bất kể code làm gì | **ĐÚNG** |
| F1 | comment `codegen-check.mjs` hứa năng lực code không có | `:25-26` hứa bắt thư mục mồ côi ở nhánh `-`; `:100-102` nhánh đó chỉ kêu khi file biến mất GIỮA hai lượt chụp, mà mồ côi nằm ở CẢ HAI ⇒ `exit 0` | **ĐÚNG** |
| F2 | bằng chứng C3 không chứng minh cái nó tự nhận | `codegen.mjs:64` `rmSync(srcDir)` chạy trước `:74` gọi hàng rào ⇒ công thức thử phá trong plan vòng 3 bất khả thi; và dây nối `:74` không có gì canh | **ĐÚNG** |

## 1. Việc của vòng này

### G1 — `codegen-check` phải bắt được thư mục/schema MỒ CÔI (F1)
Đối chiếu tập quét được với `danhSachApi()`: bất kỳ `openapi.X.json` / `src-X` nào có `X` không
nằm trong registry ⇒ **exit 1**, thông điệp bảo xoá.
**Hậu quả nếu không làm:** Phase 4 đổi tên khoá thì client cũ **đóng băng vĩnh viễn** mà
`codegen:check` — cái cổng tồn tại đúng để chặn client lệch schema — nói "khớp".
**Thử phá:** thêm khoá `zz` → codegen → gỡ khoá `zz` → `codegen:check` phải **exit 1** nêu đúng
tên rác. Dọn sạch sau khi kiểm.

### G2 — mỗi khoá registry phải có subpath trong `package.json`, và CẤM wildcard (F5)
`codegen`/`codegen:check` kiểm `exports` của `packages/api-client/package.json`: mỗi khoá phải có
đúng một subpath trỏ `src-<khoá>/index.ts` (khoá `v1` giữ `"."` như hiện tại), và **không subpath
nào được là wildcard** (`"./*"`).
**Vì sao đây là việc chặn, không phải việc đẹp:** chuỗi rất tự nhiên ở Phase 4 — codegen sinh
`src-admin/` (exit 0) → dev `import` → `ERR_PACKAGE_PATH_NOT_EXPORTED` → cách chữa nhanh nhất mà
người ta thật sự gõ là `"./*": "./src/*"` → từ giây đó `import { client } from
"@gikky/api-client/client.gen"` **chạy được**, và luật cấm singleton (N3) trở lại thành văn xuôi.
Mọi lệnh đều xanh.
**Thử phá:** thêm `"./*": "./src/*"` vào `exports` → `codegen:check` phải **exit 1**.

### G3 — sửa assert rỗng (F3)
`test_list_khong_can_output`: bỏ `assert not list(tmp_path.iterdir())` hoặc làm cho nó đo thật
(chứng minh `--list` không ghi file vào nơi command CÓ THỂ ghi). Và đổi `== ["v1"]` viết cứng
thành đọc registry — nếu sau khi sửa nó trùng hoàn toàn với `test_list_in_dung_khoa_doc_tu_registry`
thì **xoá hẳn**, đừng giữ test trùng cho đủ số.

### G4 — dây nối hàng rào (F2)
Thử phá dây nối: xoá dòng gọi `kiemTraIndex` trong `codegen.mjs` → chạy `pnpm codegen`,
`codegen:check`, `pnpm test`, `pnpm lint`. **Dán kết quả thật.**
- Nếu xanh hết ⇒ đúng như phản biện nói, dây nối không có chuông. Làm cho `codegen-check.mjs`
  gọi hàng rào **độc lập** (không qua `codegen.mjs`), để xoá dòng kia vẫn bị bắt.
- Báo cáo phải nói rõ **lệnh nào** đã cho ra exit ≠ 0 ở C3 vòng trước — cách plan vòng 3 kê là
  bất khả thi, đừng chép lại bằng chứng cũ.

### G5 — tài liệu nói đúng số việc (F6, F7)
- `api/config/api_registry.py` docstring: "2 việc" → **3 việc** (mount · `NINJA_APIS` · subpath
  trong `package.json`), khớp `CLAUDE.md`. Đây là file lập trình viên Phase 4 mở ra ĐẦU TIÊN vì
  test bắt đỏ ở đó — nó đang nói thiếu đúng việc dẫn tới G2.
- `PLAN.md` mục 7: bỏ chữ "lỗi argparse" (vòng 3 đã bỏ `required=True`, nay là `CommandError`);
  ghi rõ lệnh mẫu chạy từ **gốc repo**.
- `export_openapi`: cân nhắc bỏ `mkdir(parents=True)` — gõ từ `api/` hiện **lặng lẽ tạo
  `api/packages/api-client/`** rồi in như thành công, mà `api/packages/` không nằm trong
  `.gitignore`.

### G6 — comment `urls.py` còn cặn (nghiệm thu vòng 3 nêu)
Docstring đầu `api/config/urls.py` còn câu "mount SAU dòng `django/` bên dưới", đá nhau với
comment nội tuyến nói "đặt đâu cũng chạy". Dọn.

## 2. Tiêu chí nghiệm thu

| # | Tiêu chí | Cách đo |
|---|---|---|
| G1 | mồ côi → `codegen:check` exit 1, nêu đúng tên | thử phá, dán output, dọn sạch |
| G2a | thiếu subpath cho khoá mới → exit 1 | thử phá |
| G2b | có wildcard `"./*"` → exit 1 | thử phá |
| G3 | không còn assert rỗng; không còn test trùng | đọc code; nêu mutant nào giết được test còn lại |
| G4 | xoá dây nối → **năng lực sống sót**: cắt dây bên `codegen.mjs` thì một VI PHẠM THẬT vẫn phải bị bên kia (`codegen:check`) bắt, exit ≠ 0 | thử phá, dán output kèm **lệnh chính xác** |
| G5 | 3 chỗ tài liệu đúng; gõ lệnh mẫu từ `api/` không đẻ `api/packages/` | đọc + chạy thử |
| G6 | docstring `urls.py` không còn mâu thuẫn | đọc |
| G7 | **không hồi quy**: A1–A17, B1–B16, C1a–C8 | chạy lại |
| G8 | 0 commit · 0 warning · `ls packages/api-client` không rác `src-*`/`openapi.*.json` · `ls api` không có `packages/` | chạy |

## 3. NỢ CÓ TÊN — chấp nhận mang sang phase sau, KHÔNG làm ở vòng này

Ghi ra để không ai tưởng đã phủ:

1. **F4 — `SECRET_KEY` ngẫu nhiên không có chuông tự động.** `scripts/setup-env.mjs` viết đúng
   (fail closed, không đè, LF, không log khoá — phản biện đã kiểm cả parser dotenv). Nhưng
   `test_secret_key_khong_phai_gia_tri_nam_san_trong_repo` đọc `api/.env` **của máy đang chạy**,
   nên trả script về "chép nguyên xi" thì test **vẫn xanh** ở mọi máy đã có `.env`. Chuông thật
   cần bộ chạy test JS ⇒ **nợ tới Phase 2** (Playwright/vitest).
2. **F8 — hàng rào N3 khoá TÊN, không khoá vật.** `export { client as apiClient }` sẽ lọt. Xác
   suất openapi-ts đổi tên thấp. Muốn chắc thì kiểm theo declaration file của symbol.
3. **F9 — `codegen:check` tự chữa lành.** Nó chạy `codegen.mjs` ghi đè repo, nên sau một lần
   `LỆCH → exit 1`, lượt hai luôn xanh. **Đừng lấy "codegen:check xanh trên máy dev" làm bằng
   chứng "không ai quên chạy codegen"** — chỉ CI (chưa có remote) mới nói được điều đó.
4. **F10 — `test_mo_ta_cong_khai_khong_lan_ghi_chu_noi_bo` là danh sách 5 từ khoá.** Nó chống hồi
   quy đúng đoạn văn hiện tại, không chống lớp lỗi. Viết ghi chú nội bộ bằng chữ khác là lọt.
5. **`docker compose up` và CI kiểm drift: HOÃN, CHƯA AI CHẠY.** Không được tính là đã nghiệm thu.
   Lần đầu có Docker phải `docker pull` xác minh tag minio/mc (đang ghim theo phỏng đoán).
6. **Hai `data-testid` chưa ai đọc** — chưa có bộ test JS. Phase 2.
7. **Khoá đã đăng ký nhưng CHƯA mount ⇒ traceback trần.** `export_openapi` chết bằng
   `NoReverseMatch: 'zz' is not a registered namespace` (ninja `get_root_path` gọi `reverse`),
   không phải `CommandError` có chỉ dẫn. `test_khong_dang_ky_thua_api_khong_mount` bắt được ở
   tầng test, nhưng người Phase 4 gõ `pnpm codegen` giữa chừng ăn nguyên traceback Django.
   Phát hiện ở vòng 4, **không sửa** — đây là hỏng ỒN ÀO (không phải lớp hỏng-im-lặng mà các vòng
   này đi diệt), và sửa nó là mở scope ở đúng vòng đã chốt là vòng cuối.
8. **`rao-can-exports.mjs` là BLOCKLIST, không phải allowlist — và đây là lỗ IM LẶNG.**
   *(Bản đầu của mục này viết "subpath thừa hỏng ồn ào lúc `import`, không im lặng" — **SAI**,
   phản biện vòng 4 bác đúng. Lý lẽ đó chỉ đúng khi đích KHÔNG tồn tại. Ghi lại cho đúng:)*
   Hàng rào chỉ có 2 mệnh đề: cấm `*`, và mỗi khoá registry phải có subpath trỏ `index.ts` của nó.
   **Không có gì cấm subpath thừa trỏ vào một file nội bộ CÓ THẬT.** Ca tái hiện, không cần
   wildcard, không cần đợi Phase 4: dev gõ `import { client } from "@gikky/api-client/client.gen"`
   → `ERR_PACKAGE_PATH_NOT_EXPORTED` **in ra đúng tên subpath còn thiếu** → dev thêm một dòng
   `"./client.gen": "./src/client.gen.ts"` → `kiemTraExports` qua (không `*`, khoá `v1` vẫn đúng),
   `kiemTraIndex` mù (nó chỉ đọc `src/index.ts`), `codegen` + `codegen:check` + `test` + `lint`
   **xanh hết** → `src/client.gen.ts:16` `export const client` sống lại. Singleton N3 quay về,
   im lặng hoàn toàn.
   **Hướng đóng (~10 dòng):** đổi sang **allowlist** — `Object.keys(exports)` phải BẰNG ĐÚNG
   `{"."} ∪ {"./<khoá>" : khoá ≠ v1}`, mỗi đích bằng đúng `./<basename(srcDir)>/index.ts` và
   tồn tại trên đĩa. Một luật đóng cùng lúc: wildcard · subpath nội bộ · subpath treo · đích gõ
   nhầm · và cả khoản 9 dưới đây.
9. **Rác có hậu tố lách được CẢ hàng rào mồ côi lẫn phép so hash.** `LA_DO_SINH_RA`
   (`codegen-check.mjs:49`) là regex khớp chính xác, nên `src-zz.bak`, `openapi.zz.json.tmp`,
   `src.old` vô hình với cả hai khối. Ca: gỡ khoá `zz` nhưng đổi tên `src-zz` → `src-zz.bak`
   "để dành", giữ `"./zz": "./src-zz.bak/index.ts"` ⇒ `codegen:check` **exit 0 in "khớp"**, mà
   `import` vẫn chạy và trả về client **đóng băng vĩnh viễn, lệch schema** — đúng nguyên văn hậu
   quả mà G1 dựng lên để diệt. Allowlist ở khoản 8 giết nhánh nguy hiểm.
10. **Bốn chỗ "số đo" mới vẫn không đo cái nó nói** — `daSoi` đếm vòng lặp chứ không đếm lượt
   hàng rào chạy (cắt đúng dòng `kiemTraIndex` thì vẫn in "đã soi 1 index.ts"); `"exports sạch"`
   là khẳng định không phải số đo; `${moCoi.length}` trên đường thành công **luôn** là 0 vì
   `moCoi.length > 0` đã `exit 1` trước đó; `daSoi.length !== khoas.length` không thể sai vì hai
   vế sinh từ cùng một vòng lặp không `break`.
   **Năng lực phát hiện vi phạm THẬT vẫn nguyên** (G4 chứng minh hai đầu chuông độc lập đều
   sống), nhưng **báo cáo Phase 0 KHÔNG được tuyên bố đã diệt xong lớp "trấn an mà không đo"** —
   bốn chỗ trên vẫn đúng lớp đó.
11. **Vặt:** thông điệp của `rao-can-exports.mjs` khi `exports` là chuỗi nói sai lý do (chuỗi
   `exports` xuất đúng một đường, không "xuất sạch mọi file"); `CLAUDE.md` viết "không export
   subpath `./client` **nữa**" trong khi repo chưa từng có nó; biến `khoa` trong
   `test_api_registry.py` thực chất là `id(api)`.
