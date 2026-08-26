# Modal đăng nhập · và "cửa" trước ô bình luận

*Chốt 2026-08-26 (user), hai câu, hai việc nhưng KHÓA VÀO NHAU:*

> "phần cmt, không nên show form luôn, show 1 div báo click vào đây để bình luận, click
> vào, nếu chưa đăng nhập thì show form đăng nhập, nếu đăng nhập rồi thì show form cmt"

> "sửa lại phần đăng nhập, không dùng link trỏ tới page đăng nhập nữa, click page đăng
> nhập thì sẽ ra modal chứa form login, modal này chính là page login hiện tại, đang ở
> page nào, đăng nhập xong thì sẽ quay lại page đó"

Khoá vào nhau ở đúng chỗ này: nhánh *"chưa đăng nhập ⇒ show form đăng nhập"* của việc 1
**là** cái modal của việc 2. Làm rời hai việc là dựng hai đường đăng nhập.

## A. Modal đăng nhập

- `components/modal-dang-nhap.tsx`: `ModalDangNhapProvider` + `useModalDangNhap()`.
- Dùng `<dialog>` **gốc của trình duyệt** + `showModal()`. Lý do không tự dựng overlay:
  `<dialog>` cho sẵn bẫy focus, `Esc` để đóng, `::backdrop`, và `inert` cho phần còn lại
  của trang. Tự dựng bằng `<div role="dialog">` là viết lại bốn thứ đó bằng tay và sẽ
  viết thiếu ít nhất một.
- Nội dung modal **chính là `<FormDangNhap />`** — cùng component với `/dang-nhap`, không
  phải bản chép. Một chỗ sửa, hai chỗ hiện.
- **Không điều hướng đi đâu cả** sau khi vào: đóng modal + `router.refresh()`. Đó là cách
  đọc đúng câu *"đang ở page nào… thì sẽ quay lại page đó"* — không đi thì không phải
  quay lại. `router.refresh()` cần thiết vì trang mạch là server component: nút "Trả lời",
  menu `⋯`, khối chủ mạch đều do server quyết theo phiên.

### `/dang-nhap` vẫn TỒN TẠI, và đó không phải nửa vời

Ba `router.replace("/dang-nhap")` đang canh cửa `/cai-dat`, `/sua-ho-so`, `/khu-mod`, và
email đặt lại mật khẩu trỏ vào các route auth thật. Xoá trang là gãy cả ba. Thứ user muốn
bỏ là **cú nhảy khỏi trang đang đọc**, không phải cái route.

⇒ Đổi sang modal: `ThanhTaiKhoan` (header) · `Composer` (cửa bình luận) · `FormDangMach`.
⇒ Giữ nguyên link: các trang auth trỏ chéo nhau (`/dang-ky`, `/quen-mat-khau`,
`/dat-lai-mat-khau`) — người ở đó đã ở trong luồng tài khoản rồi, chồng một modal lên một
trang form là tệ hơn.

## B. "Cửa" trước ô bình luận

`Composer` thêm trạng thái **đóng** (mặc định) — một nút trông như ô nhập, chữ mời. Bấm:

| Ai bấm | Ra gì |
|---|---|
| chưa đăng nhập | modal đăng nhập (A) |
| đã đăng nhập | form bình luận thật, focus sẵn |
| mạch bị khoá | **không vẽ cửa** — vẫn là câu "Mạch đã bị khoá" như cũ |

Gửi xong ⇒ cửa đóng lại. Reply (`hanh-dong-binh-luan.tsx`) truyền `moSan` vì người dùng
**đã bấm "Trả lời"** rồi — bắt bấm hai lần cho một hành động là vô nghĩa.

## Tiêu chí nghiệm thu (đo được)

| # | Tiêu chí |
|---|---|
| 1 | Khách mở `/m/…`: thấy **cửa**, không thấy `<form data-testid="composer">` |
| 2 | Khách bấm cửa ⇒ `<dialog>` mở, trong đó có `form-tai-khoan`; URL **không đổi** |
| 3 | Người đã đăng nhập bấm cửa ⇒ form bình luận hiện, ô gõ nhận focus |
| 4 | Gửi xong ⇒ cửa đóng lại, bình luận mới có trong cây |
| 5 | Reply: bấm "Trả lời" ⇒ form hiện NGAY, không có cửa thứ hai |
| 6 | Header "Đăng nhập" ⇒ modal, URL không đổi |
| 7 | Đăng nhập trong modal ⇒ modal đóng, header đổi sang tên user, **vẫn ở đúng trang** |
| 8 | `Esc` đóng modal; focus quay về nút đã mở nó |
| 9 | L05 vẫn đúng: mỗi mặt đúng MỘT cửa, và mở ra đúng MỘT form |
| 10 | `pnpm lint` 0 warning · `tsc` sạch · `pnpm e2e:don-vi` xanh |

## Rủi ro biết trước, ghi ra để không giấu

`data-testid="composer"` nay **chỉ tồn tại sau một cú bấm**. Có ~15 chỗ trong
`apps/web/e2e/*.spec.ts` đang khẳng định thẳng vào nó hoặc vào `composer-khach`. Chúng
được sửa bằng một helper chung (`moComposer`), **nhưng bộ `pnpm e2e` KHÔNG chạy được ở
máy này lúc này** — nó chiếm cổng 3000/8000 và seed đè `gikky_dev`, nơi đang có bài thật.
⇒ Phần e2e của lượt này là **sửa chưa kiểm chứng**; thứ được kiểm chứng là trình duyệt
thật (cả hai vai: khách và đã đăng nhập).

---

## Kết quả kiểm chứng (2026-08-26)

**⚠ Phiên chính TỰ LÀM và TỰ ĐO — không có nghiệm thu/phản biện độc lập.**

| # | Kết quả | Bằng chứng (DOM trình duyệt thật) |
|---|---|---|
| 1 | ĐẠT | khách mở `/m/…-1`: `composer-cua` = 1 (`data-khach="1"`, chữ *"…cần đăng nhập"*), `composer` = **0**; cả trang **0** link `a[href="/dang-nhap"]` |
| 2 | ĐẠT | bấm cửa ⇒ `<dialog open>` có `form-tai-khoan` + 2 ô `dinh_danh`/`password`; `location.pathname` không đổi |
| 3 | ĐẠT | đã đăng nhập bấm cửa ⇒ 1 `composer`, `document.activeElement` = `composer-o`; 9 cửa còn lại vẫn đóng |
| 4 | ĐẠT | gửi ⇒ bình luận mới đứng đầu cây, `composer` = 0 và `composer-cua` = 1 trở lại (đã xoá bình luận thử) |
| 5 | ĐẠT | `moSan` ở `hanh-dong-binh-luan.tsx` (đọc mã) |
| 6 | ĐẠT | nút header + nút `/dang-mach` ⇒ modal mở, URL giữ nguyên |
| 7 | **KHÔNG ĐO ĐƯỢC** | đòi gõ mật khẩu thật vào form — tôi không làm việc đó. Chỉ đọc mã: `trongModal` ⇒ `onGui` trả `undefined` ⇒ không `location.assign`; `onThanhCong` chạy SAU `await taiLai()` rồi `dong()` + `router.refresh()` |
| 8 | ĐẠT | ✕ · `Escape` · bấm nền — cả ba gỡ `<dialog>` khỏi DOM; **mở lại lần 2, lần 3 đều được**; focus quay đúng về nút đã mở |
| 9 | ĐẠT | mặt BÃO: `composer-mat-bao` 1 cửa, `khan-dai` 0 cửa; mặt CẶN ngược lại; mỗi cửa mở ra đúng 1 form |
| 10 | ĐẠT | `pnpm lint` 0 warning · `tsc --noEmit` sạch · `pnpm e2e:don-vi` **306 passed** (1 đỏ = nợ `/luat` cũ) |

### Một lỗi thật, bắt được nhờ bấm lần thứ HAI

Bản đầu đóng modal bằng sự kiện `close` của `<dialog>`. Hỏng hai tầng:

1. `close` **không bubble**, mà React uỷ nhiệm sự kiện ở gốc cây ⇒ `<dialog onClose>` không
   chạy;
2. sửa sang listener GỐC vẫn hỏng — đo trên chính máy này: một `<dialog>` **trống**, tạo
   bằng `createElement`, `showModal()` rồi `close()`, listener `close` **không nổ lần nào**.

Triệu chứng: DOM đóng thật, React giữ `dangMo === true`, nên **cú bấm "Đăng nhập" thứ hai
không mở được gì**. Lần bấm đầu tiên trông hoàn hảo — đây là lỗi chỉ lộ ra khi thử lại.

Chữa: `<dialog>` bị **gỡ khỏi cây React** khi đóng; không nghe sự kiện nào. `Esc` đi qua
`onKeyDown` (có bubble). Focus trả về phải tự làm (`document.activeElement` lưu lúc mở),
vì phần tử bị gỡ thì trình duyệt không trả focus cho ai.

### CÒN NỢ — nói thẳng

1. **Bộ `pnpm e2e` KHÔNG chạy.** Nó chiếm cổng 3000/8000 và seed đè `gikky_dev`, nơi đang
   có bài thật của user. 6 file spec vừa sửa (`du-lieu.ts` · `mach-can` · `va-v2` ·
   `phase-3` · `tai-khoan-va-ghi`) mới chỉ qua `tsc` + `eslint`, **chưa chạy lần nào**.
2. **Tiêu chí 7 chưa đo** — lý do ở bảng trên.
3. Phiên đăng nhập trong trình duyệt đã bị **đăng xuất** để đo vai khách. User tự vào lại.
4. Ba trang cần đăng nhập (`/cai-dat`, `/sua-ho-so`, `/khu-mod`) vẫn `router.replace` sang
   `/dang-nhap`. Đổi chúng sang modal là một lượt riêng, chưa làm.
