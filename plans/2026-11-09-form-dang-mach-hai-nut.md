# Plan — Form đăng mạch: hai nút "Lưu riêng tư" / "Đăng công khai" thay cho ô tick

> **2026-11-09.** Sinh từ việc 9 của `GHI-CHU.md` (user chọn **hướng "hai nút"**) và quyết định "công khai là một
> chiều" (việc 7).
> **Nền (đo lúc lập plan):** `HEAD` = `748f95f` · `pnpm e2e:don-vi` = **559 bài / 57 file** (không phải 516 như
> `CLAUDE.md` còn ghi) · không file nào dưới `apps/` đang sửa dở · mobile kiểm bằng `tsc --noEmit`
> (`apps/mobile/package.json`, script `lint`). Agent nhận việc kiểm lại ba con số này **trước khi làm** (mục "Worktree
> có thể đứng ở commit cũ" của `CLAUDE.md`).
>
> **Thứ tự với plan vá rò** (`plans/2026-11-09-va-ro-mach-rieng-tu.md`): hai plan **không chung file** (plan kia chỉ
> chạm `api/`, plan này chỉ chạm `apps/`), nên làm song song được. Nhưng **không deploy plan này trước plan vá rò**:
> làm riêng tư thành lựa chọn dễ thấy sẽ đẩy người dùng vào đúng chỗ mạch riêng tư đang lọt vào tìm kiếm, theo dõi
> và bình luận (sổ `P-20261109-3`).

---

## 1. Vì sao

Hôm nay lựa chọn công khai / riêng tư chỉ là một **ô tick** ngang hàng với "Tắt bình luận", mặc định **công khai**
nếu không tick (xem việc 9 của `GHI-CHU.md`, mục "Hiện trạng"). Công khai là **một chiều**, nên một lần bỏ qua ô tick
là một bài đăng không rút lại được. Ở mobile ô này còn nằm trong khối "Nâng cao" mặc định gập.

**Mục tiêu:** mỗi lần tạo mạch, người dùng **phải đưa ra một quyết định rõ ràng**, và nút họ bấm tự nói kết quả. Không
còn ô tick, không còn trạng thái mặc định, không còn đường nào gửi form mà chưa chọn.

## 2. Phạm vi

**Làm:** ba chỗ tạo mạch.

| Chỗ | File |
|---|---|
| Web — trang đăng bài | `apps/web/components/form-dang-mach.tsx` (+ `form-dang-mach.module.css` nếu có) |
| Web — ngăn đăng nhanh | `apps/web/components/drawer-dang-nhanh.tsx` (+ css) |
| Mobile | `apps/mobile/app/mach/new.tsx` |

Cộng một dòng chữ ở `apps/web/components/khoi-chu-mach.tsx:171` (hộp xác nhận "Công khai mạch này?" **đã có**, chỉ
thiếu câu "không rút lại được").

**Ngoài phạm vi — chỉ ghi, KHÔNG làm** (subagent nêu ở mục `## NGOÀI PHẠM VI` của báo cáo):

- **Tầng API.** `MachMoiIn.rieng_tu: bool = False` (`api/api/schemas_ghi.py:92`) **giữ nguyên**. Có bắt buộc trường
  này hay không là quyết định riêng (việc 9, mục "Tầng API"). Hai nút vẫn gửi `rieng_tu` **tường minh** (`true` hoặc
  `false`), không bao giờ bỏ trường.
- Đổi luật `luu-tru` theo "một chiều" (việc 7): plan riêng.
- Bot Trader dùng `rieng_tu` (việc 1): plan riêng.
- Nối mốc: **không có** công khai / riêng tư (mốc kế thừa mạch), nên không đổi.
- Không đổi `api/`, `packages/api-client/src`, `apps/admin`. Không codegen.

## 3. Thiết kế đã chốt

**D1 — Hai nút, không ô tick, không mặc định.** Nhãn **chính xác**, mỗi nút kèm **một dòng mô tả luôn hiện** (không
tooltip, không nằm trong khối gập):

| Nút | Dòng mô tả |
|---|---|
| **Lưu riêng tư** | Chỉ mình bạn thấy. Công khai sau được. |
| **Đăng công khai** | Mọi người thấy ngay. Không rút lại được. |

Hai nút **cùng kích thước, cùng độ nổi**: không nút nào trông như "nút mặc định". Khác nhau ở nhãn và dòng mô tả. Màu
dùng **token có sẵn**. Từ 480px trở lên xếp ngang, hẹp hơn xếp dọc; dòng mô tả nằm ngay dưới nút của nó.

**D2 — Không có đường gửi ngầm.** Hai nút là `type="button"`, mỗi nút gọi thẳng hàm gửi. `<form onSubmit>` chỉ
`preventDefault()` và **không** gọi API. Hệ quả cần có bài đo: nhấn Enter trong ô tiêu đề **không** tạo bài. (Hôm nay
Enter trong ô tiêu đề, khi form đã đủ, đăng công khai ngay.)

**D3 — Một hàm gửi nhận tham số tường minh:** `gui(riengTu: boolean)`. State `riengTu` **xoá hẳn** khỏi component, cũng
như `datRiengTu` / `setRiengTu`. Không còn biến nào giữ lựa chọn.

**D4 — Đang gửi.** Cả hai nút tắt khi `dangGui`; nút vừa bấm đổi chữ ("Đang lưu…" / "Đang đăng…"), nút kia chỉ tắt. Giữ
nguyên nguyên tắc cũ của file: **không mở khoá nút ở nhánh thành công** (chống hai bài khi bấm lần hai lúc trang chưa
kịp chuyển).

**D5 — Điều kiện đủ giữ nguyên cho cả hai nút** (`du` ở form web, `duDieuKien` ở ngăn đăng nhanh). Nút tắt thì **nói
vì sao** theo khuôn đã có: `disabled` + `title` + `aria-label` (`LY_DO_THIEU`, `form-dang-mach.tsx:288–297`).

**D6 — Bản nháp.** `sessionStorage` (`gikky_draft_dang_mach`, `form-dang-mach.tsx:53–61`) **không lưu và không khôi
phục** lựa chọn. Khoá `riengTu` còn sót trong nháp cũ bị **bỏ qua**. Người dùng quay lại từ trang đăng nhập phải chọn
lại.

**D7 — Ngăn đăng nhanh.** Chân ngăn (`css.chan`) chứa hai nút ở chế độ đăng bài; nút gọi thẳng hàm gửi. **Bỏ** kiểu
`form?.requestSubmit()` từ một nút nằm ngoài form (`drawer-dang-nhanh.tsx:578–582`) cho nhánh đăng bài. Chế độ **nối
mốc** giữ một nút "Nối mốc" như hiện tại. Bỏ `setRiengTu(false)` sau khi gửi (`:329`).

**D8 — Mobile.** Gỡ `Switch` "Bài viết riêng tư" khỏi khối "Nâng cao" (`new.tsx:320–337`). Thay nút gửi duy nhất
(`styles.submitBtn`) bằng hai nút cùng mẫu D1, dòng mô tả **luôn hiện**, không nằm trong phần gập. Xoá state `riengTu`.

**D9 — `data-testid`.** Giữ **`dang-mach-gui` cho nút "Đăng công khai"** để 11 chỗ e2e hiện có (7 file, xem mục 4) vẫn
bấm đúng nút và vẫn đăng công khai như trước, **không phải sửa chỗ nào**. Thêm `dang-mach-gui-rieng-tu` cho nút riêng
tư. Ngăn đăng nhanh: `dang-nhanh-gui` (công khai, **giữ**, và vẫn là `noi-moc-gui` khi nối mốc) và
`dang-nhanh-gui-rieng-tu`. **Xoá** `dang-mach-rieng-tu` và `dang-nhanh-rieng-tu`. Ghi một dòng comment ở code nói vì
sao `dang-mach-gui` là nút công khai.

**D10 — Hộp xác nhận ở trang mạch** (`khoi-chu-mach.tsx:171`): thêm câu **"Không rút lại được."** Chỉ đổi chữ.

**D11 — Sau khi gửi** giữ nguyên: `window.location.assign(...)`. Mạch riêng tư mở ra với `banner_rieng_tu`
(`trang-mach.tsx:448`) và nút "Công khai mạch". Không thêm bước xác nhận ở lúc **tạo** công khai: nhãn và dòng mô tả của
nút đã nói đủ; thêm hộp thoại ở đây là phạt mọi bài đăng công khai hợp lệ.

## 4. Chỗ dễ vỡ đã tìm ra khi khảo sát

- **11 chỗ e2e** bấm `getByTestId("dang-mach-gui")` để đăng công khai: `anh.spec.ts` (:54, :96, :120, :142),
  `binh-luan-chung.spec.ts` (:350), `form-ghi.spec.ts` (:33, :67), `mach-can.spec.ts` (:750), `phase-3.spec.ts` (:103,
  :414), `va-v2.spec.ts` (:72). D9 giữ chúng nguyên.
- `apps/web/e2e/don-vi/type-frontend.spec.ts` có nhắc `form-dang-mach` và là **hàng rào đọc nguồn**: lời gọi API phải kèm
  `baseUrl`, và **cấm gọi hàm API qua biến trung gian**. Gọi `taoMach({ baseUrl, … })` trực tiếp với `rieng_tu:
  riengTu` là đúng; **đừng** viết `const ham = x ? a : b`.
- Hàng rào màu (`apps/web/e2e/don-vi/mau-token.spec.ts`, `PLAN.md` mục 9.1): chỉ dùng token, không màu ứng biến.
- `pnpm lint` chạy `--max-warnings=0`.
- Ngăn đăng nhanh hiện gửi bằng nút **ngoài** form qua `requestSubmit()`; D7 bỏ kiểu đó cho nhánh đăng bài.

## 5. Các bước (chặng 2 — `opus-dev`)

- **B0 — Kiểm nền.** `git log --oneline -1`; `pnpm e2e:don-vi --list` phải ra **559**; các file ở mục 2 tồn tại và
  `riengTu` còn ở đúng các dòng đã nêu. Lệch thì **DỪNG và báo**.
- **B1 — Trang đăng bài** theo D1–D6, D9. **B2 — Ngăn đăng nhanh** theo D1–D5, D7, D9. **B3 — Mobile** theo D1, D8.
  **B4 — Chữ xác nhận** theo D10.
- **B5 — Hàng rào đọc nguồn mới** (`apps/web/e2e/don-vi/`, an toàn, không server): đọc ba file nguồn và đòi cả hai nhãn
  cùng hai dòng mô tả của D1 có mặt; không còn `type="checkbox"` / `Switch` gắn với riêng tư; không còn `riengTu` /
  `datRiengTu` / `setRiengTu` làm state. **Phải biết nói KHÔNG:** thêm một phép thử đưa vào nguồn giả có lại ô tick và
  khẳng định hàng rào đỏ (cùng khuôn `vung-bam-cum-phai.spec.ts` "chống hàng rào rỗng").
- **B6 — Bài đo hành vi Playwright** (cần server; mục 6, A4). Viết, **không** tự chạy `pnpm e2e` trần.

## 6. Tiêu chí nghiệm thu — ĐO ĐƯỢC

- **A1 · Tĩnh.** `pnpm lint` sạch (0 warning) · `pnpm build` cả hai app xanh · `pnpm --filter @gikky/mobile lint` (tức
  `tsc --noEmit`) sạch · `pnpm codegen:check` sạch · `pnpm e2e:don-vi`: số bài **≥ 559 + số bài mới**, không bài nào
  đỏ mới.
- **A2 · Không còn ô tick.** `grep -rn -E "riengTu|datRiengTu|setRiengTu|dang-mach-rieng-tu|dang-nhanh-rieng-tu"` trên ba
  file mục 2 ra **0 dòng**, ngoại trừ chỗ truyền tham số `rieng_tu` vào request.
- **A3 · Hàng rào B5** xanh, **và đỏ** khi đưa lại ô tick (chứng minh bằng phép thử, không chỉ nói).
- **A4 · Hành vi** (Playwright, **chạy theo quy trình an toàn bên dưới**), cho cả trang đăng bài lẫn ngăn đăng nhanh:
  1. điền đủ, bấm "Lưu riêng tư" ⇒ request `POST /machs` mang `rieng_tu: true`, trang mạch có `banner-rieng-tu`;
  2. bấm "Đăng công khai" ⇒ `rieng_tu: false`, **không** có banner;
  3. thiếu trường bắt buộc ⇒ cả hai nút tắt và mỗi nút có lý do;
  4. nhấn Enter trong ô tiêu đề khi form đã đủ ⇒ **không** có request `POST /machs` nào;
  5. bấm đúp một nút ⇒ **một** bài, và hai nút cùng tắt trong lúc gửi;
  6. mở trang đăng bài sau khi lưu nháp có `riengTu: true` ⇒ **không** nút nào được chọn sẵn / không tự gửi.
- **A5 · Hồi quy.** Bảy file e2e ở mục 4 **không sửa dòng nào** mà vẫn xanh (chạy theo quy trình an toàn).
- **A6 · Mobile.** `tsc --noEmit` sạch; đọc nguồn thấy hai nút, dòng mô tả hiện luôn, `Switch` riêng tư đã gỡ. **Chưa
  thử trên máy thật hay Expo**: báo cáo phải nói thẳng điều này, không viết "đã kiểm".
- **A7 · Chữ.** Nhãn và dòng mô tả khớp D1 từng chữ; hộp xác nhận ở trang mạch có "Không rút lại được."
- **A8 · Truy cập.** Mỗi nút có `aria-describedby` trỏ tới dòng mô tả của nó; nút tắt có `title` + `aria-label` lý do.
- **A9 · Phạm vi.** `git diff --stat` chỉ chạm: ba file ở mục 2 (+ css đi kèm), `khoi-chu-mach.tsx`, file test mới.
  **Không** chạm `api/`, `packages/api-client/src`, `apps/admin`.

**Quy trình an toàn cho A4 và A5** (`pnpm e2e` chiếm cổng 3000 và 8000 và **ghi vào DB**; `gikky_dev` chứa bài thật của
user — xem ghi nhớ `gikky-dev-chua-du-lieu-that`): **cấm** `pnpm e2e` trần. Phải trỏ `DATABASE_URL` sang `gikky_e2e`,
in tên DB rồi mới chạy, chạy với `CI=1`, kiểm hai cổng trống trước và giữ độc quyền suốt lượt. Subagent **không tự chạy**
nếu chưa được user cho phép đích danh; khi đó viết bài đo, chạy tĩnh (A1–A3, A7–A9) và ghi rõ A4–A5 **chưa chạy**.

## 7. Chặng 3 và 4

- **Nghiệm thu** (`nghiem-thu`): chạy lại lệnh A1–A3, A7–A9; **tự làm phép thử A3**; đọc mobile cho A6. A4–A5 chạy nếu
  user cho phép theo quy trình trên, nếu không thì báo "chưa chạy".
- **Phản biện** (`phan-bien`): giả định bản vá còn lỗi. Tìm: **đường nào còn gửi được form mà chưa chọn** (Enter trong
  ô khác, nút trên bàn phím ảo của mobile, ô nhập ảnh, trình soạn thảo có phím tắt); **chỗ thứ tư tạo mạch** ngoài ba chỗ
  này (`grep` `taoMach(`, `POST /machs`, mọi component gọi `tao_mach`, kể cả `apps/admin`); lựa chọn bị **rò giữa hai lần
  mở** ngăn đăng nhanh; mobile có nhánh nào còn truyền `rieng_tu` mặc định không; dòng mô tả có bị cắt hoặc ẩn ở màn hẹp
  không.

## 8. Rủi ro

- Hai nút ngang nhau có thể làm người mới phân vân. Chấp nhận có chủ đích: sự phân vân đó **chính là** mục tiêu.
- Người đã quen "Đăng bài = công khai" sẽ thấy khác. Chưa quyết có báo trước không (việc 9, câu hỏi mở cuối).
- Mobile chưa thể thử trên máy thật trong chặng này; app mobile phát hành thế nào là việc ngoài plan.
- Hai phiên song song cùng sửa `GHI-CHU.md` đã xảy ra một lần trong ngày: dev **không** sửa `GHI-CHU.md`; phiên chính ghi.
