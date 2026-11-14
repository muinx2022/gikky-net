# Việc 25 — Dải lệnh ở trang chi tiết mạch

**Trạng thái:** ĐÃ LÀM trên `v2` (`9b3ac8c`), đã lên dev.gikky.net (`9b3ac8c`, 2026-11-14 09:28, `api` rồi `web`; cây cũ `~/gikky-dev/src.cu-20261114-092653`), đã lên prod gikky.net (`c9cfbf5`, 2026-11-14 11:50). Nghiệm thu ĐẠT 3 lượt (D1–D9/B1–B4; R1–R7; S1–S6); phản biện 2 lượt; 3 vòng sửa (vòng 3 user duyệt). Sổ: `GHI-CHU.md` việc 25.

## Bối cảnh

Thẻ nhật ký ở feed (`apps/web/components/the-mach.tsx:213-240`) vẽ "dải lệnh" khi `mach.lenh` có: chip MUA/BÁN · mã ·
Entry · SL · TP · Nhồi · R:R (`lib/lenh.ts::cacOLenh`, màu TP/SL/MUA/BÁN từ `con-so.module.css`). Trang chi tiết
`/m/<slug>-<id>` (`components/trang-mach.tsx`, header ~dòng 499-500: `<h1>` rồi `<BienLaiDauBai figures={figuresDau}/>`)
KHÔNG vẽ dải này, dù `GET /machs/{id}` đã trả `lenh` (`MachChiTietOut` dựng từ `model_dump` của tóm tắt,
`api/api/machs.py:233`; `api/api/trinh_bay.py::lenh_ra`). User hỏi vì sao chi tiết không thấy ⇒ thêm vào.

## Phạm vi — LÀM

1. **Component dùng chung** `apps/web/components/dai-lenh.tsx` (server-safe, không hook): nhận `lenh: LenhOut` và
   `tienTo` cho testid. Markup y hệt dải hiện tại của thẻ (`role="group" aria-label="Lệnh"`, chip chiều, `<b>` mã có
   `CHU_NGUOI_DUNG`, các ô từ `cacOLenh`, lớp màu `conSo.mua/ban/gia_tp/gia_sl`). CSS của dải (`.lenh`, `.o_lenh`,
   `.nhan_o`, `.chieu`, `.ma` … trong `the-mach.module.css`) dời sang `dai-lenh.module.css` — MỘT bản, không chép.
   Kiểm hàng rào màu (`e2e/don-vi/mau-token.spec.ts`, `quan-tri-giao-dien`/`trang-chu-giao-dien-moi` danh sách file CSS)
   — nếu chúng ghim file/selector thì cập nhật đúng chỗ, không nới luật.
2. **Thẻ** `the-mach.tsx` dùng `<DaiLenh lenh={lenh} tienTo="the-nhat-ky" />` — **testid trên thẻ GIỮ NGUYÊN**
   (`the-nhat-ky-lenh`, `the-nhat-ky-chieu`, `the-nhat-ky-<khoa>`; ~30 chỗ đo ghim). HTML của thẻ không đổi
   (trừ tên class CSS module).
3. **Trang chi tiết** `trang-mach.tsx`: ngay sau `<h1>`, TRƯỚC `<BienLaiDauBai>`, vẽ
   `{mach.lenh && <DaiLenh lenh={mach.lenh} tienTo="trang-mach" />}` (testid `trang-mach-lenh`, `trang-mach-chieu`,
   `trang-mach-<khoa>`). Có cả `lenh` lẫn `figures` mốc 1 ⇒ hiện cả hai (dải lệnh trước). Không lệnh ⇒ không gì
   (bài viết / chủ đề luôn `lenh = null`). Khoảng cách với h1/khối dưới dùng token sẵn có; trông hài hoà ở cả theme
   sáng/tối và 390px (dải `flex-wrap`, không cuộn ngang).
4. Docstring: `the-mach.tsx` mục 3 và đầu `trang-mach.tsx`/`dai-lenh.tsx` ghi dải nay dùng chung (việc 25).

## Phần B — tooltip tiêu đề ở khối "Bài viết mới" của rail (việc 24 bổ sung, user 2026-11-13)

User (kèm ảnh): "khi di chuột, hover dài quá, có cách nào làm cho nó ngắn lại được không". Tooltip hiện là tooltip NATIVE
của thuộc tính `title` trên `<a>` (`components/khoi-bai-moi.tsx`) — trình duyệt vẽ một dải đen dài tràn khỏi rail,
CSS không chỉnh được. Thay bằng tooltip tự vẽ:

- Bỏ `title` trên `<a>`. Text của `<a>` vẫn là tiêu đề ĐẦY ĐỦ (anchor text, cắt bằng CSS như cũ).
- Tooltip vẽ bằng CSS (pseudo-element của `<li>`, `content: attr(data-tieu-de)`) — KHÔNG thêm bản sao tiêu đề thứ hai
  vào text HTML. Định vị ngay DƯỚI dòng đang trỏ, bề rộng = bề rộng dòng (không tràn khỏi rail), chữ xuống dòng
  (`white-space: normal`), cỡ chữ nhỏ, bo góc, bóng nhẹ, lớp trên các dòng kế; chỉ token màu sẵn có (qua hàng rào màu).
- Chỉ đặt `data-tieu-de` khi tiêu đề có khả năng bị cắt: dài hơn ngưỡng ký tự (hằng có tên, ~40 ký tự ≈ một dòng
  12.5px ở rail 300px — đo rồi chọn, ghi lý do). Ngắn hơn ⇒ không tooltip (lặp lại đúng chữ đang thấy là thừa).
- Hiện khi `:hover` (chỉ trong `@media (hover: hover)`) và `:focus-within` (bàn phím), có trễ ngắn (~300ms) để rê
  ngang qua danh sách không nháy; không bắt chuột (`pointer-events: none`) để không che việc bấm dòng dưới.
- Áp cho mọi trang có khối (`/`, `/luat`, `/m/…`…). Không đổi thứ tự/khoảng cách khối, không đổi ngưỡng rail dính.

Tiêu chí thêm:

| # | Đo | Mong đợi |
|---|---|---|
| B1 | HTML thô `/` | `<a>` trong `sidebar-bai-moi` KHÔNG có thuộc tính `title`; text `<a>` = title API; tiêu đề dài có `data-tieu-de` = title đầy đủ, ngắn thì không |
| B2 | Playwright 1280px, rê chuột lên một dòng có tiêu đề dài | sau trễ, tooltip hiện (đọc computed style của `::before`/`::after`: `content` khớp, `opacity`/`visibility` hiện), hộp tooltip nằm trong bề ngang của rail (`left ≥ rail.left`, `right ≤ rail.right`) và ngay dưới dòng; rời chuột thì ẩn |
| B3 | Thử phá | đặt lại `title=` ⇒ B1 đỏ; bỏ `max-width`/cho `white-space: nowrap` ⇒ B2 (tràn rail) đỏ |
| B4 | Các bài rail cũ (`rail-bai-viet` T4/T6/T7/T10, bấm dòng phụ, focus ring) | vẫn xanh (cập nhật bài nào đang đòi `title` cho khớp yêu cầu mới, ghi lý do) |

## KHÔNG LÀM

Không đổi API/schema/codegen; không đổi `BienLaiDauBai`/`figures`; không parse tiêu đề để suy lệnh; không đổi testid
của thẻ; không sửa `GHI-CHU.md`/`LOI-VA-NO.md`/plan; không commit.

## Tiêu chí nghiệm thu

| # | Đo | Mong đợi |
|---|---|---|
| D1 | `pnpm lint` | 0 warning |
| D2 | `pnpm e2e:don-vi` | xanh; số trước/sau |
| D3 | Build web (bản sao cô lập) | exit 0 |
| D4 | e2e, HTML thô `/m/<nhật ký có lệnh của seed_e2e>` | có `data-testid="trang-mach-lenh"` (SSR, không cần JS); chiều/mã/Entry/SL/TP/Nhồi/R:R khớp `GET /api/v1/machs/{id}` → `lenh` (ô nào `null` thì vắng); dải nằm SAU `<h1>` và TRƯỚC `bien-lai-dau-bai` (nếu có) |
| D5 | e2e, `/m/<bài viết>` và `/m/<nhật ký không lệnh>` | không có `trang-mach-lenh` |
| D6 | e2e thẻ: `the-mach-thong-nhat`, `the-mach-tim-kiem`, `trang-chu-giao-dien-moi` | xanh, testid thẻ không đổi |
| D7 | Đơn vị (đọc nguồn) | `cacOLenh(` chỉ được gọi trong `dai-lenh.tsx`; `the-mach.tsx` và `trang-mach.tsx` đều import `DaiLenh`; không còn markup dải trong `the-mach.tsx` |
| D8 | e2e 390px trên trang chi tiết có lệnh | `scrollWidth ≤ innerWidth`; dải hiện đủ ô (xuống dòng được) |
| D9 | Thử phá | bỏ `DaiLenh` khỏi `trang-mach.tsx` ⇒ D4 đỏ; vẽ dải cả khi `lenh` null (vd luôn render khung) ⇒ D5 đỏ; chép lại markup dải vào `the-mach.tsx` ⇒ D7 đỏ |

## Rủi ro / cách chạy

- Checkout CHUNG với phiên khác: chỉ sửa file của việc này. `GHI-CHU.md`, `AGENTS.md`, `scripts/**` đang có thay đổi
  không phải của việc này.
- e2e: KHÔNG `pnpm e2e` trần (`gikky_dev` có dữ liệu thật), không đụng cổng 3000/8000, không `pnpm build` tại chỗ.
  Lối cô lập đã chạy được: bản sao repo **trên ổ D: và KHÔNG ở gốc ổ** (vd `D:\Projects\.tmp-v25`; ở ổ C: thì
  `next build` lỗi đường dẫn pnpm, ở gốc D:\ thì không xoá được), `node_modules`/`api\.venv` qua junction, `next start`
  :3040 + Django :8040 trên `gikky_e2e` (in `DB=gikky_e2e` trong cùng lệnh), `CI=1`, env origin cho cổng riêng
  **gồm `CSRF_TRUSTED_ORIGINS=http://localhost:3040`** (thiếu thì đăng ký 403), config Playwright riêng không
  `webServer`. Dọn: gỡ junction TRƯỚC rồi xoá thư mục.

## Báo cáo thực thi

### Đã làm
- **A (việc 25):** `components/dai-lenh.tsx` + `.module.css` (dải dùng chung; thẻ giữ testid `the-nhat-ky-*`); trang chi
  tiết vẽ dải ngay dưới `<h1>` (testid `trang-mach-*`). Mạch có lệnh ⇒ `BienLaiDauBai` không lên header, `figures`
  về thẻ mốc 1. CSS dải: `flex-wrap`, ô giãn lấp hàng (hết vệt nền `--line` khi xuống dòng — cả desktop), giá dài
  không bị che.
- **API:** `mach_tom_tat_ra(..., moc_1_bi_mod_an)` bắt buộc; `lenh = null` CHỈ khi mốc 1 bị mod ẩn (`hidden_at`);
  bia mộ do tác giả GIỮ lệnh. 5 chỗ gọi (`feeds`, `ho_so`, `tim_kiem`, `users`, `machs`), không thêm query.
  Docstring `LenhOut` + trường `lenh` viết lại ⇒ `pnpm codegen` (chỉ đổi mô tả trong `openapi.json`, `types.gen.ts`).
  Test mới `api/tests/test_lenh_moc_1_an.py` (4 ca × 5 cửa); `test_lenh.py` giữ nguyên HEAD.
- **B (tooltip rail):** bỏ `title` native; tooltip CSS `li[data-tieu-de]::before` rộng bằng dòng, xuống dòng, trễ,
  `:hover` trong `(hover:hover)` + `:has(:focus-visible)` (bàn phím), alt rỗng `content: attr(...) / ""` (trình đọc
  màn hình không đọc hai lần), ngưỡng `NGUONG_TOOLTIP_TIEU_DE = 28` (chuỗi IN HOA có dấu vừa một dòng ~37 ký tự ở
  268px/12.5px; chữ thường 45–48).

### Đổi hướng giữa chừng (vì sao)
- Phản biện lượt 1: tooltip kẹt sau khi bấm chuột (`:focus-within`), ngưỡng 40 bỏ sót IN HOA, SR đọc hai lần, dải 390px
  có vệt nền/che số ⇒ vòng sửa 1. Bot gửi cả `lenh` lẫn `figures` ⇒ hai khối số trùng, có thể lệch; lệnh vẫn hiện khi
  mốc 1 bị mod ẩn ⇒ hỏi user ⇒ vòng sửa 2.
- **Lỗi của phiên chính:** khi giao vòng 2 đã mở rộng "mod ẩn" thành "mod ẩn hoặc bia mộ" và cho đảo bài
  `test_lenh_song_sot_khi_moc_1_la_bia_mo` ⇒ tác giả tự xoá mốc 1 là giấu được lệnh thua. Phản biện lượt 2 bắt được;
  user chốt "Giữ lệnh" ⇒ vòng sửa 3 khôi phục bài HEAD.
- Mục KHÔNG LÀM "không đổi API" bị thay bởi quyết định 2 (schema không đổi, chỉ hành vi + mô tả).

### Kiểm chứng (nghiệm thu tự chạy, lượt 3)
- `pnpm lint` 0 warning · `pnpm e2e:don-vi` 823 passed (nền 819) · `pnpm codegen:check` khớp 34 file.
- `pnpm test` (DB `test_gikky_e2e`): 2810 passed, 26 skipped, **17 failed = đúng tập đỏ sẵn ở HEAD** `ea1596b` (đã có
  trong sổ, `LOI-VA-NO.md` ~dòng 1827/1968); +4 bài mới xanh.
- e2e trên bản build cô lập (`gikky_e2e`, :3040/:8040, `CI=1`): lượt 3 — `dai-lenh-trang-mach` 11, `the-mach-thong-nhat`
  17, `rail-bai-viet` 11, `trang-chu-v2` 41 ⇒ 80 passed, 0 failed; lượt 2 — 7 file 123 passed, 6 skipped (Meilisearch,
  W-ANH).
- Đo tay ca bia mộ bằng `DELETE /api/v1/mocs/{id}` thật qua phiên tác giả: lệnh còn ở cả 5 cửa API, dải hiện, không biên
  lai; mod ẩn ⇒ null ở cả 5, không dải.
- Thử phá (thợ + nghiệm thu): bỏ `DaiLenh` ⇒ D4 đỏ; vẽ dải khi null ⇒ D5 đỏ; chép markup ⇒ D7 đỏ; đặt lại `title` ⇒ B1
  đỏ; `:focus-within` ⇒ B2 đỏ; bỏ alt ⇒ ariaSnapshot đỏ; ngưỡng 40 ⇒ B1b đỏ; lưới mobile cũ ⇒ D8 đỏ; bỏ điều kiện
  "có lệnh ⇒ không biên lai" ⇒ D10 đỏ; coi bia mộ như ẩn ⇒ 2 pytest đỏ; ép cờ sai ở từng file trong 5 cửa ⇒ pytest đỏ.

### Ghi sổ
`LOI-VA-NO.md`: `P-20261114-1` … `-7`. `GHI-CHU.md` việc 25: hai quyết định + đính chính bia mộ.

## Quyết định giữa chừng (user, 2026-11-14, sau phản biện)

1. Mạch có `lenh` ⇒ không vẽ `BienLaiDauBai` ở header; `figures` mốc 1 về lại `TheMoc` (bot gửi cả hai — trùng và có thể
   lệch vì `figures` sửa được, `lenh` thì không). Mạch không lệnh: như cũ.
2. Mốc 1 bị ẩn/gỡ ⇒ `lenh = null` ngay ở API (`api/api/trinh_bay.py`), nên ẩn ở cả thẻ lẫn trang chi tiết và JSON không
   lộ lệnh. **Việc này đụng `api/` — mục KHÔNG LÀM "không đổi API" ở trên được thay bằng quyết định này** (schema không
   đổi). Deploy dev phải lên cả `api`.
3. Phản biện vòng 1 đã sửa: tooltip kẹt sau khi bấm (`:has(:focus-visible)`), ngưỡng 40 → 28 (chuỗi IN HOA có dấu vừa
   một dòng ~37 ký tự), alt rỗng cho `::before` (trình đọc màn hình không đọc hai lần), dải lệnh 390px/khi xuống dòng
   không còn vệt nền và giá dài không bị che.
4. **Đính chính quyết định 2 (user, 2026-11-14):** chỉ `hidden_at` (mod ẩn) của mốc 1 ⇒ `lenh = null`; bia mộ do tác giả
   (`deleted_at`) ⇒ GIỮ lệnh (khôi phục `test_lenh_song_sot_khi_moc_1_la_bia_mo`). Phiên chính đã giao sai là "hoặc bia
   mộ" — phản biện lượt 2 bắt được (tác giả tự xoá mốc 1 là giấu được lệnh thua, không dấu vết).
