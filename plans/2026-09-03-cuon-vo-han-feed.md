# Feed trang chủ + chuyên mục: đổi "xem thêm ↓" thành cuộn vô hạn

Chốt 2026-09-03. User: *"phần home page và category, đang sử dụng click Xem thêm để load
thêm bài, thay đổi, sử dụng load vô hạn để load thêm bài"*.

## Hiện trạng

`components/feed.tsx` là **server component**. Phân trang là một `<Link>` tới
`?cursor=…` — tức bấm là **điều hướng sang trang khác**, trang 1 biến mất. Hai chỗ dùng:
`app/page.tsx` (`/`) và `app/s/[sub]/page.tsx` (`/s/<sub>`).

## ⚠ Việc này ĐỤNG một nguyên tắc đã ghi, phải nói ra

Docstring của `Feed` chốt:

> *Toàn bộ trạng thái (tab, khoảng, cursor) nằm trên URL chứ không trong state: feed là
> thứ người ta gửi link cho nhau, và PLAN nguyên tắc 7 cấm "tự đổi sort ngầm dưới tay
> người dùng" — không có state ẩn thì không có chỗ nào để đổi ngầm.*

Cuộn vô hạn **buộc** phải giữ danh sách đã tải trong state client. Đó là một sự lệch thật,
không phải chi tiết bỏ qua được. Lý lẽ để chấp nhận, và nó phải đứng vững:

- Nguyên tắc 7 cấm **đổi ngầm CÁI GÌ được bày** (sort, bộ lọc). Cuộn vô hạn không đụng
  tab/khoảng/sort — nó chỉ đổi **BAO NHIÊU** đã bày ra. URL vẫn nói đúng và đủ về nội
  dung: mở lại link ra đúng feed ấy, chỉ là từ đầu.
- Không có state nào **ẩn**: người dùng thấy rõ danh sách dài ra vì chính họ cuộn.

⇒ Docstring ấy phải được viết lại trong lượt này. Để nguyên là để lại một luật mà chính
file đó vừa phá.

## Ràng buộc kỹ thuật đã khảo sát

1. **`TheMach` là component THUẦN** (không `"use client"`, không async, không API
   server-only). `NoiDungThe` và `Avatar` cũng vậy; `CotVote` vốn đã là client. ⇒ Dùng lại
   được **nguyên xi** ở phía client, không phải viết bản thứ hai. Đây là điều kiện tiên
   quyết: hai bản thẻ feed là hai nguồn sự thật, và bản client sẽ lệch ở lần sửa sau.
2. **Đã có tiền lệ gọi API từ trình duyệt**: `lib/api.ts::docCacSubOTrinhDuyet` dùng
   `baseUrl: GOC_TRINH_DUYET` (chuỗi rỗng, same-origin qua `rewrites`). Bản server dùng
   `CHUNG = { baseUrl: API_ORIGIN }` — **không dùng được trong trình duyệt**.
3. **Hàng rào `type-frontend.spec.ts`**: mọi lời gọi hàm API phải truyền `baseUrl` **theo
   từng lời gọi**, và phải gọi **thẳng theo tên** (cấm qua biến trung gian — hàng rào tìm
   callee theo tên).
4. `feedTho` đã có sẵn `cursor` + `limit` + `khoang` + `sort`; không cần đụng API.

## Thiết kế: TĂNG CƯỜNG DẦN, không thay thế

**Giữ nguyên `<Link>` thật.** Nó là:
- đường đi của **bot** (Google phải bò được hết feed — cuộn vô hạn thuần JS cắt đứt đường ấy);
- đường đi khi **JS hỏng/chưa tải**;
- đường đi khi **fetch lỗi** — lúc đó lùi về hành vi cũ thay vì kẹt.

Cuộn vô hạn là một lớp phủ lên trên: `IntersectionObserver` thấy cái link vào tầm nhìn thì
tự tải trang kế và **nối thêm** vào danh sách. Không có JS thì cái link vẫn là cái link.

## Tiêu chí nghiệm thu

- **N1.** `/` và `/s/<sub>`: cuộn tới cuối ⇒ bài trang 2 tự nối thêm, KHÔNG điều hướng
  (URL không đổi), trang 1 vẫn còn trên màn hình.
- **N2.** HTML server-render **vẫn chứa** `<a href="…cursor=…">` — kiểm bằng `curl`, tức
  kiểm đúng thứ bot đọc.
- **N3.** Hết bài ⇒ không còn link, không còn observer, không gọi thêm request nào.
- **N4.** Nối thêm dùng **đúng `TheMach`**, không có bản sao thứ hai của thẻ feed.
- **N5.** Lời gọi API mới truyền `baseUrl` theo từng lời gọi và gọi thẳng theo tên ⇒
  `type-frontend.spec.ts` xanh.
- **N6.** Trợ năng: vùng nối thêm có `aria-live="polite"` báo "đã tải thêm N bài"; cái
  link vẫn focus được bằng bàn phím và bấm được (người đi bàn phím không cuộn bằng chuột).
- **N7.** Lỗi mạng ⇒ hiện lại link + một dòng nói rõ, KHÔNG thử lại vô hạn.
- **N8.** Docstring `Feed` viết lại phần "toàn bộ trạng thái nằm trên URL".
- **N9.** `tsc` sạch · `lint` 0 warning · `e2e:don-vi` không đỏ thêm bài nào.

## Ngoài phạm vi

- `/tim-kiem` và `/u/<username>` cũng có phân trang — **không đụng** lượt này (user nói
  home + category).
- Khán đài (`khan-dai.tsx`) có "xem thêm" riêng, dùng `?offset=` — không đụng.

---

# Báo cáo thực thi — 2026-09-03

**Tự làm, tự đo, KHÔNG có lượt nghiệm thu/phản biện độc lập.**

## Đã làm

| file | việc |
|---|---|
| `components/cuon-vo-han.tsx` (mới) | client component: `IntersectionObserver` + nối bài, bọc quanh link thật |
| `components/feed.tsx` | thay khối `<Link>` bằng `<CuonVoHan>`; thêm prop `sub`; viết lại docstring "trạng thái nằm trên URL" |
| `lib/api.ts` | thêm `docFeedOTrinhDuyet` — `baseUrl: GOC_TRINH_DUYET`, hai lời gọi trực tiếp theo tên |
| `app/s/[sub]/page.tsx` | truyền `sub={sub}` |
| `components/feed.module.css` | `.het_bai` |

## Chấm tiêu chí

| | kết quả |
|---|---|
| N2 link crawlable còn trong HTML SSR | ĐẠT — `curl` thấy `feed-xem-them` ×1, `href="/?tab=moi&cursor=…"`, 20 thẻ |
| N4 dùng chung `TheMach`, không bản sao | ĐẠT |
| N5 `baseUrl` từng lời gọi, gọi thẳng tên | ĐẠT — `type-frontend.spec.ts` trong 430 bài xanh |
| N8 docstring viết lại | ĐẠT |
| N9 tsc · lint · don-vi | ĐẠT — tsc 0, lint 0 warning, don-vi 430 passed / 0 failed |
| đường API client sẽ gọi | ĐẠT — qua cổng 3000 (`baseUrl=""` + rewrites) trả trang 2: 5 bài, hết cursor |

## CHƯA KIỂM ĐƯỢC — phần chính của tính năng

N1 (cuộn ⇒ tự nối), N3 (hết bài ⇒ dừng), N6 (trợ năng), N7 (lỗi mạng ⇒ hiện lại link)
**đều chưa chạy thử**: quyền dùng công cụ cuộn/chạy JS trong trình duyệt bị từ chối lượt
này, không có cách kích `IntersectionObserver`. Logic mới qua `tsc` + đọc lại.

`gikky_dev` chỉ có 4 mạch (dưới `limit=20`) nên tại chỗ cũng không có trang 2. Phép đo
phân trang ở trên chạy trên DB nháp `gikky_e2e` (531 mạch) bằng một tiến trình Django
riêng, đã tắt sau khi đo. **Không đụng `gikky_dev`.**

## Nợ

- Cuộn vô hạn cần một lượt thử tay hoặc bài e2e thật (`pnpm e2e` vẫn không chạy được).
- `/tim-kiem` và `/u/<username>` vẫn "xem thêm" bấm tay — ngoài phạm vi.
