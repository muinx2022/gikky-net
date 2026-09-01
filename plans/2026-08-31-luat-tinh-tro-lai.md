# `/luat` trở lại là route TĨNH — đóng P-20260830-1 (kéo theo P-20260830-7)

Chốt 2026-08-31. User uỷ quyền chọn lối chữa ("cần sửa gì thì làm đi").

## 1. Bối cảnh & quyết định

- Hợp đồng: `/luat` là **đường thoát** của `error.tsx`/`global-error.tsx` — phải sống khi
  Django chết ⇒ phải là route tĩnh, không gọi API. Ghim ở `app/error.tsx:99` và
  `e2e/don-vi/trang-loi.spec.ts` (`ROUTE_TINH`, bài #14 dòng 261).
- 2026-08-25 (`plans/2026-08-25-deploy-vps-docker.md` §"Trang tĩnh vỡ vì KhungHaiCot"):
  `/luat` chuyển sang `KhungHaiCot` — component gọi `GET /subs` phía SERVER — nên phải khai
  `force-dynamic`. Hợp đồng vỡ; bài #14 đỏ từ đó (1 bài đỏ duy nhất còn lại của cả bộ đo).
- Plan cũ nêu 2 lối, user chưa quyết. Nay chọn **(a)**: `/luat` thôi dùng `KhungHaiCot`.
  Lý do: (b) — client-fetch subs trong `KhungHaiCot` — đổi hành vi render của cả 14 trang
  và rút link sub khỏi HTML đầu tiên sitewide; (a) chỉ đụng đúng trang mang hợp đồng.
- **Nhưng không quay về `<main>` trần của bản cũ**: `KhungHaiCot` sinh ra để diệt "nhảy
  nhót" bề rộng giữa các trang (docstring của nó). Thay vào đó: **biến thể TĨNH cùng lưới**.

## 2. Phạm vi — 5 file

1. **MỚI** `apps/web/components/khung-hai-cot-tinh.tsx`: cùng lưới với `KhungHaiCot`
   (import CHUNG `khung-hai-cot.module.css` + `Sidebar`), render `Sidebar cacSub={[]}`,
   **cấm tuyệt đối** import `@/lib/api` / `@gikky/api-client` / `fetch`. Docstring: nó tồn
   tại cho đúng những trang là đường thoát; hàng rào một-bậc ở trang-loi.spec.ts canh nó.
2. `apps/web/components/sidebar.tsx`: khối 3 "Chuyên mục" **không render khi
   `cacSub.length === 0`** — hộp tiêu đề rỗng là một biển chỉ đường chết; đây cũng là điều
   kiện để biến thể tĩnh không phải chế API riêng. Cập nhật docstring "ba khối".
3. `apps/web/app/luat/page.tsx`: dùng `KhungHaiCotTinh`; **xoá** `export const dynamic`
   + khối comment 2026-08-25; thêm chú thích ngắn trỏ hợp đồng + plan này.
4. `apps/web/e2e/don-vi/trang-loi.spec.ts`: vá lỗ hàng rào — #14 hiện chỉ grep CHÍNH file
   trang nên lời gọi API nằm trong component import vào là chuông câm (đúng cách hợp đồng
   đã vỡ 08-25 mà chỉ có vế `force-dynamic` kêu):
   - #14 thêm phép: `/luat` không được import `"@/components/khung-hai-cot"` (regex có
     quote đóng để KHÔNG bắt `khung-hai-cot-tinh`);
   - bài MỚI: đọc `components/khung-hai-cot-tinh.tsx`, áp cùng các phép cấm (lib/api ·
     api-client · `fetch(`) + vế chống rỗng (file phải đọc được, có nội dung). Ghi rõ giới
     hạn: đây là kiểm MỘT BẬC import, không phải phân tích transitive — nửa cái
     type-checker bằng regex là loài repo này cấm.
5. `deploy/prod/README.md`: mục "Nợ biết trước" — bullet "`/luat` không còn là route tĩnh"
   đánh dấu **đã trả 2026-08-31** kèm một câu cách trả.

KHÔNG đụng: 9 trang `force-dynamic` còn lại (ngoài hợp đồng), `khung-hai-cot.tsx`,
`chrome.tsx` (docstring "`/luat` đang là `○`" tự ĐÚNG trở lại — P-20260830-7 đóng theo),
4 file CSS bẩn của phiên khác, `LOI-VA-NO.md`.

## 3. Môi trường

Như plan A10 mục 4 (`DATABASE_URL` → `gikky_e2e` cùng lệnh; cổng 3000/8000 trống; không
`--` trước cờ). ⚠ `pnpm build` phá `next dev` đang chạy cùng app — cổng phải trống trước.

## 4. Tiêu chí nghiệm thu — ĐO ĐƯỢC

| # | Tiêu chí | Cách đo |
|---|---|---|
| 1 | Nền: `pnpm e2e:don-vi` hiện 398 passed / **1 failed** (#14) — chạy TRƯỚC khi sửa để ghim | `pnpm e2e:don-vi` |
| 2 | Sau vá: `pnpm e2e:don-vi` **0 failed** (passed = 399 hoặc 400 tuỳ bài mới đếm 1) | cùng lệnh |
| 3 | `pnpm build`: dòng route `/luat` mang `○` (static), KHÔNG `ƒ` | đọc output build |
| 4 | THỬ PHÁ ba nhát, mỗi nhát khôi phục xong diff sạch: (i) thêm lại `force-dynamic` vào luat ⇒ #14 đỏ; (ii) đổi import luat sang `khung-hai-cot` (bản fetch) ⇒ #14 đỏ ở phép MỚI; (iii) thêm `import { docCacSub } from "@/lib/api"` vào `khung-hai-cot-tinh.tsx` ⇒ bài một-bậc đỏ | `pnpm e2e:don-vi -g` từng bài |
| 5 | Bộ đầy đủ `pnpm e2e`: **0 failed** (lần đầu từ khi có sổ); passed ≥ 569 — trang `/luat` vẫn qua các bài theme/focus/SEO đang goto nó | `pnpm e2e` |
| 6 | `pnpm lint` 0/0 | |
| 7 | Diff đúng 5 file mục 2 (+ 2 file lượt T8/P-14 chưa commit: `giao-dien.spec.ts`, `o-tim-kiem.tsx` — không tính; + file bẩn sẵn) | `git diff HEAD --stat` |

Nền bộ đầy đủ hiện tại: 567 passed / 2 failed, trong đó T8 đã vá chưa commit ⇒ kỳ vọng
trước lượt là 568/1. Số khác ⇒ DỪNG báo.

## 5. Chặng 5

Ghi sổ; đóng trạng thái P-20260830-1 + P-20260830-7; commit (user đã uỷ quyền qua "làm
đi" sau khi được hỏi) — pathspec, né index cũ.

## 6. Cập nhật chặng 5 (sau nghiệm thu + phản biện, cùng ngày)

Nghiệm thu: ĐẠT 12/13 đo được. Phản biện: không lỗi NẶNG, hợp đồng đứng; 2 lỗ hàng rào
thật + mấy chỗ chữ — phiên chính tự vá:

1. **#14 thêm phép DƯƠNG**: `/luat` PHẢI import `khung-hai-cot-tinh` — các phép cấm không
   buộc dùng khung tĩnh, và bài một-bậc có thể thành bài canh một file mã chết.
2. **Trang 404 cùng lỗ**: thêm phép cấm import `khung-hai-cot` cho `not-found.tsx` (quote
   đóng — bản `-tinh` vẫn được phép).
3. **Rail `/luat` hết trống trơ**: `GIOI_THIEU` dời từ `app/page.tsx` sang `lib/site.ts`
   (một nguồn, hai chỗ dùng), khung tĩnh truyền nó cho `Sidebar` — khối giới thiệu hợp
   đúng cảnh người ta rơi vào từ trang lỗi.
4. **`error.tsx` sửa câu hứa quá**: mọi lối đi tiếp từ `/luat` đều là route động — nó là
   chỗ đứng an toàn, không phải cửa vòng qua sự cố.
5. Thử phá 2 phép mới: gỡ import `-tinh` khỏi luat ⇒ #14 đỏ đúng phép dương; chèn import
   `khung-hai-cot` vào not-found ⇒ bài 404 đỏ. Kiểm chứng chốt: don-vi 402/0 · build
   `○ /luat` · bộ đầy đủ 572/0 · lint 0/0.
6. ⚠ Tai nạn giữa chặng: `git checkout --` lấy bản INDEX (cũ) đè mất bản vá `/luat` chưa
   commit — dựng lại tay, đã ghi vào P-20260830-5. Nội dung tương đương bản của thợ
   (KhungHaiCotTinh + bỏ khai dynamic + chú thích hợp đồng), chữ chú thích viết lại.

Số nền mục 4 (398/1 don-vi · 568/1 đầy đủ) là số CŨ — nền thật tại HEAD: 400/1 và 568/1
(phản biện đếm tĩnh xác nhận 401 bài don-vi trước vá, 402 sau).
