# Plan — Gỡ địa chỉ email khỏi username (sổ `P-20261109-2`)

> **2026-11-09.** Sinh từ `LOI-VA-NO.md` `P-20261109-2` và `GHI-CHU.md` việc 6 (mục "dùng nick `muinx2022`").
> **Nền (đo lúc lập plan):** `HEAD` = `748f95f` · `pytest --collect-only` = **2381 test** trên cây làm việc hiện tại.
> Con số này **đã gồm test chưa commit của agent "mạch riêng tư"** nên sẽ trôi cho tới khi họ xong: agent nhận việc
> đo lại ngay trước khi làm và báo bằng **hiệu số** (số test mới của plan này), không báo số tuyệt đối.
> Agent nhận việc kiểm theo mục "Worktree có thể đứng ở commit cũ" của `CLAUDE.md`: nêu đích danh
> `api/core/allauth_adapter.py::populate_username` (bước 2 giữ nguyên email làm username) **đã tồn tại**, còn
> `api/core/management/commands/doi_username.py` **chưa tồn tại**.

## 0. Không đụng agent đang chạy

Một agent khác đang sửa **mạch riêng tư / công khai**. Tại thời điểm lập plan, các file họ đang dở trong cây:
`api/api/{anh,bao_cao,binh_luan,ghi_chung,ho_so,machs,mocs,theo_doi,tim_kiem,tuong_tac}.py`,
`api/core/{thong_bao,tim_kiem}.py`, `api/core/management/commands/reindex_tim_kiem.py`, `api/core/rieng_tu.py` (mới),
`api/tests/*rieng_tu*`. Ngoài ra `plans/2026-11-09-form-dang-mach-hai-nut.md` (form đăng mạch) đã có plan nhưng
**chưa chạy** (theo `GHI-CHU.md` việc 9); khi nó chạy sẽ sửa code web, không chồng với plan này.

**Plan này chỉ THÊM file mới**: `api/core/management/commands/doi_username.py` và `api/tests/test_doi_username.py`.
Tuyệt đối không sửa file nào trong danh sách trên, kể cả "một dòng cho tiện". Cần **đọc** `thong_bao.py` / `tim_kiem.py`
thì được. Chạy trong worktree riêng từ `HEAD` là an toàn nhất (chỉ file mới nên gộp lại không xung đột). Cuối báo cáo
phải có `git diff --stat` chứng minh không file nào ngoài hai file trên bị đổi (V9).

**Chặn thứ tự (quan trọng):** bước đồng bộ chỉ mục tìm kiếm của plan này **chỉ được chạy trên prod SAU KHI bản vá rò
mạch riêng tư đã lên prod**. Lý do: `hien_cong_khai` (`core/tim_kiem.py`) hôm nay chưa lọc `rieng_tu`; đẩy lại mạch của
một tài khoản vào chỉ mục lúc đó có thể đưa **mạch riêng tư** vào Meilisearch. Nên lệnh mới để đồng bộ tìm kiếm sau một
cờ **tắt mặc định** (xem D1).

## 1. Vì sao

Username của tài khoản `muinx2022@gmail.com` là chính địa chỉ email. Nó lộ qua mọi chỗ in `author.username`:
`GET /api/v1/users/muinx2022@gmail.com` trả 200, URL hồ sơ `/u/muinx2022@gmail.com`, mọi bình luận, chỉ mục tìm kiếm
(`core/tim_kiem.py:339, :450`), và **cả thông báo gửi cho người khác**: `Notification.payload["boi"]` chứa username
(`core/thong_bao.py:259, 299, 331, 361, 414, 477`) và API thông báo trả `payload` nguyên văn (`api/api/thong_bao.py:102`).
Tài khoản tạo 2026-08-27, **đang hoạt động** (4 mạch, 7 mốc, 9 bình luận), user xác nhận đây là nick thật của họ và họ
đang dùng.

**Phát hiện thêm khi lập plan — lỗi này CÓ THỂ tái diễn.** Sổ `P-20261109-2` nói "tài khoản Google mới không còn lộ".
Chưa đúng hoàn toàn: `populate_username` (`api/core/allauth_adapter.py:159–162`) có **bước 2: nếu tiền tố email đã
bị chiếm thì giữ nguyên cả email làm username** (theo yêu cầu của user ngày 2026-09-13, docstring dòng 127). Người
đăng ký sau mà tiền tố trùng người đi trước sẽ bị lộ email theo đúng cách này. Xem quyết định (c) ở mục 2.

Đăng nhập nhận **cả email lẫn username** (`ACCOUNT_LOGIN_METHODS = {"email", "username"}`, `api/config/settings.py:291`;
*bản đầu plan viết "chỉ email" là sai, phản biện sửa lại 2026-11-09 theo `seed_dev.py:43` đã lỗi thời*). Với tài khoản này
đổi username vẫn không làm ai mất đường đăng nhập: email giữ nguyên nên vẫn vào được bằng email; tên cũ (dạng email)
cũng không còn là username nên không ai đăng nhập bằng nó như một username được nữa. Không đổi email, không đăng xuất
phiên đang mở.

## 2. Quyết định phải có trước khi chạy trên prod — CHƯA chốt, việc của user

| # | Câu hỏi | Khuyên |
|---|---|---|
| a | Tên đích cho `muinx2022@gmail.com`: `muinx2022`? Có thể **đã bị tài khoản khác chiếm** (chính vì thế bước 2 của adapter mới cho ra username là email). Phải kiểm bằng `--tim-email` / truy vấn prod (D1, bước 0). | `muinx2022` nếu còn trống |
| b | URL cũ `/u/muinx2022@gmail.com`: để **404** hay làm bí danh 308 sang tên mới? Bí danh = thêm code + giữ email trong header redirect/log ⇒ đi ngược mục đích. | **404**. Link đã chia sẻ chết; nhờ user gửi Google Search Console gỡ URL cũ |
| c | Sửa luôn bước 2 của `populate_username` (đổi sang hậu tố số, vd `muinx20221`) để hết tái diễn? Đó là hành vi user từng yêu cầu, và là file không thuộc agent kia. | Có, nhưng là **việc riêng, plan riêng** — không gộp vào plan này nếu user chưa nói |
| d | Có tài khoản nào khác bị cùng lỗi không (docstring nhắc `thuydtb86@gmail.com`)? Đổi hết một lượt hay từng cái? | Xem kết quả bước 0, rồi quyết |
| e | Giờ chạy: sau khi bản vá rò lên prod (xem mục 0). | Sau |

**Cập nhật quyết định (a) — ĐÃ CHỐT (user, 2026-11-09): tên đích là `muinx2022`.** Kiểm trên prod cùng ngày bằng
trình duyệt (Cloudflare chặn `curl`): `GET /api/v1/users/muinx2022` = **404** `khong_tim_thay`, nên tra chính xác thì tên
còn trống; tài khoản nguồn `GET /api/v1/users/muinx2022%40gmail.com` = 200, và `display_name` của nó đã là `muinx2022`.
Phép tra của API là khớp chính xác, nên **dry-run vẫn phải khẳng định lại bằng `username__iexact`** (có thể tồn tại
`Muinx2022` viết hoa). Nếu dry-run báo trùng thì dừng, không tự đặt tên khác; hỏi lại user. Các quyết định b, c, d, e
vẫn mở. Không cái nào chặn việc viết code (D1 không phụ thuộc chúng), chỉ chặn việc chạy trên prod.

## 3. Phạm vi

**Làm:** một lệnh quản trị mới đổi username an toàn + bài đo. Không migration, không đổi `settings.py`, không đổi
TypeScript, không đổi model.

**Ngoài phạm vi — chỉ ghi lại, KHÔNG làm** (nêu ở mục `## NGOÀI PHẠM VI` của báo cáo):

- Cho người dùng **tự đổi username** (hôm nay chỉ tự đổi được `display_name`, tối đa 2 lần — `SO_LAN_DOI_TEN_TOI_DA`).
- Bí danh / redirect cho username cũ (quyết định b khuyên không làm).
- Sửa `populate_username` bước 2 (quyết định c — plan riêng).
- Viết lại `AuditLog.meta["tac_gia"]` (`core/ghi.py:2139`): nhật ký là append-only và chỉ staff đọc; **để nguyên**, ghi
  lại trong báo cáo rằng email cũ còn nằm đó.
- Gỡ email khỏi cache Google / Wayback / Cloudflare / ảnh OG đã sinh: ngoài tầm với của code.
- Bất kỳ file nào ở mục 0.

## 4. Thiết kế

**D1 — Lệnh `doi_username`** (file mới `api/core/management/commands/doi_username.py`):

```
node scripts/py.mjs doi_username --tim-email
node scripts/py.mjs doi_username --tu "muinx2022@gmail.com" --thanh "muinx2022"                 # dry-run (mặc định)
node scripts/py.mjs doi_username --tu "muinx2022@gmail.com" --thanh "muinx2022" --ap-dung
node scripts/py.mjs doi_username ... --ap-dung --dong-bo-tim-kiem    # chỉ sau khi bản vá rò đã lên prod
```

- `--tim-email`: **chỉ đọc**, liệt kê mọi `User` có `@` trong `username` (id, username, ngày tạo, số mạch / mốc /
  bình luận). Đây là bước 0, trả lời quyết định (d).
- **Mặc định là dry-run**: in ra việc SẼ làm (số hàng thông báo sẽ sửa, số mạch sẽ làm mới cache, số tài liệu sẽ đồng bộ
  tìm kiếm) và thoát, không ghi gì. Chỉ `--ap-dung` mới ghi.
- Kiểm tên đích bằng **cùng bộ kiểm với form đăng ký** (`clean_username` của allauth, `UnicodeUsernameValidator`,
  danh sách tên dành riêng nếu có) **và** từ chối chữ `@` trong tên đích: không được tạo ra tên mà đường đăng ký sẽ
  từ chối, hay lại một tên chứa email. Trùng tên **không phân biệt hoa thường** (`username__iexact`) ⇒ từ chối.
- Trong **một `transaction.atomic()`**: khoá hàng `User` (`select_for_update`) → đổi `username` → sửa
  `Notification.payload["boi"]` từ tên cũ sang tên mới (theo lô, không `UPDATE` cả bảng bằng một lệnh dài giữ khoá) →
  gom tập mạch bị ảnh hưởng.
- **Tập mạch bị ảnh hưởng = mạch của tài khoản + mọi mạch mà tài khoản có mốc hoặc bình luận.** Tập thứ hai là chỗ dễ
  quên: trang `/m/<slug>-<id>` của người khác đang nhúng `author.username` của các bình luận này trong bản ISR.
  Với mỗi mạch: `core.revalidate.lam_moi_mach(mach)` (xếp vào `on_commit`, chạy sau khi transaction đóng).
- `--dong-bo-tim-kiem` (tắt mặc định): sau commit gọi `core.tim_kiem.dong_bo_mach` cho mạch của tài khoản và
  `dong_bo_binh_luan_theo_mach` cho các mạch có bình luận của tài khoản. **Không gọi** `reindex_tim_kiem` (file đó
  đang được agent kia sửa). Nếu cờ này tắt, dry-run và báo cáo phải in rõ dòng "chỉ mục tìm kiếm CHƯA đồng bộ".
- **Idempotent:** chạy lại khi tài khoản đã mang tên đích ⇒ in "đã là tên mới", thoát 0, không ghi gì. Tên cũ không còn
  ⇒ báo lỗi rõ ràng, thoát khác 0 (**ném, không nuốt**, cùng tinh thần `reindex_tim_kiem.py`).
- Ghi `AuditLog` **chỉ khi** hàm `ghi_audit` nhận được một `action` mới mà không cần thêm hằng vào `core/ghi.py` (file
  nằm gần vùng agent kia) và không cần migration (kiểm `choices` của cột). Nếu không làm được sạch thì bỏ qua, và in
  một dòng log + ghi vào báo cáo; **không** sửa `ghi.py` để lấy chỗ.

## 5. Tiêu chí nghiệm thu — ĐO ĐƯỢC

| # | Tiêu chí | Đo bằng |
|---|---|---|
| V1 | Dry-run (mặc định) không ghi: sau lệnh, `username`, `Notification.payload` và số lời gọi revalidate/đồng bộ đều không đổi | test |
| V2 | `--ap-dung`: `User.username` thành tên đích; email, mật khẩu, `is_staff`, các FK không đổi | test |
| V3 | Tên đích trùng (kể cả khác hoa thường), chứa `@`, không hợp lệ, hoặc tài khoản nguồn không tồn tại ⇒ lỗi, **không** đổi gì | test, mỗi ca một bài |
| V4 | Sau đổi: `GET /users/<tên mới>` = 200; `GET /users/<email cũ>` = 404; `author.username` trong response mạch và bình luận của tài khoản = tên mới | test API |
| V5 | Không còn hàng `Notification` nào có `payload["boi"]` bằng tên cũ; hàng của người khác không bị đụng | test |
| V6 | `lam_moi_mach` được xếp cho **cả** mạch của tài khoản **và** mạch người khác mà tài khoản đã bình luận | test (mock `_xep_hang`) |
| V7 | Có cờ `--dong-bo-tim-kiem`: tài liệu `author` trong chỉ mục = tên mới; không có cờ: **không gọi** Meilisearch | test (theo cách các test tìm kiếm hiện có mock Meili) |
| V8 | Lỗi giữa chừng (vd giả `dong_bo` ném) ⇒ phần ghi trong transaction được hoàn tác, username vẫn là tên cũ; chạy lại lần hai (idempotent) thoát 0 không ghi | test |
| V9 | `git diff --stat` so với lúc bắt đầu chỉ có **hai file mới** đã nêu ở mục 0; không file nào trong danh sách của agent kia bị đổi | báo cáo |
| V10 | `pnpm test` xanh toàn bộ với `filterwarnings = ["error"]`; số test tăng đúng bằng số test mới của plan này | báo cáo (hiệu số, không số tuyệt đối) |
| V11 | `--tim-email` chỉ đọc: chạy trước và sau, số hàng `User` và checksum cột `username` như nhau | test |

## 5b. Trạng thái (cập nhật 2026-11-09)

Chặng 2 (code), 3 (nghiệm thu: ĐẠT CÓ ĐIỀU KIỆN), 4 (phản biện: không lỗi NẶNG, 2 VỪA + 4 NHỎ) đã chạy; chặng 2 chạy lại
để sửa các lỗi phản biện (F1–F6). Hiện `tests/test_doi_username.py` = **51 test xanh** (phiên chính chạy lại sau khi sửa).
Chưa commit, **chưa chạy trên prod**. Thay đổi so với thiết kế gốc ở mục 4:

- Lệnh KHÔNG dùng `lam_moi_mach` nữa: sau commit nó gọi đồng bộ `revalidate._gui` và **đếm lỗi thật** (lý do: `_gui_nen`
  là luồng `daemon` nên lệnh thoát là rơi lời gọi; đo 3–7 trên 9 lời gọi tới nơi). Có lỗi ⇒ thoát khác 0, DB không hoàn tác.
- `--dong-bo-tim-kiem` **đọc ngược chỉ mục** (`GET /indexes/<uid>/documents?fields=id,author`) và chỉ viết "ĐÃ XÁC NHẬN"
  khi khớp; không đọc được ⇒ "CHƯA xác nhận" và thoát khác 0. Chữ "đã đồng bộ" không còn.
- Chạy lại (`--tu` là email của chủ tên đích) **tự chữa nốt**: sửa `payload["boi"]` còn tên cũ, gửi lại revalidate.
- Lô thông báo lấy bằng `select_for_update()`.

## 6. Việc của phiên chính và user trên prod — KHÔNG phải của subagent

Subagent **không** chạm prod, không SSH, không deploy. Sau nghiệm thu:

1. Hỏi phiên khác trước khi deploy (xem `gikky-net-nhieu-phien-chung-checkout`): checkout chung, agent mạch riêng tư đang dở.
2. Sao lưu DB prod. Chạy `--tim-email` (bước 0), chốt quyết định a và d.
3. Chạy dry-run, đọc kết quả. Rồi `--ap-dung` (chưa kèm `--dong-bo-tim-kiem` nếu bản vá rò chưa lên).
4. Sau khi bản vá rò lên prod: chạy lại cùng lệnh với `--dong-bo-tim-kiem` (idempotent nên chạy lại được).
5. Kiểm bằng API công khai: `/users/<tên mới>` 200, `/users/<email cũ>` 404, tìm kiếm theo tên mới.
6. User gửi Google Search Console yêu cầu gỡ URL cũ; xem lại thông báo cũ trong chuông của vài tài khoản.

## 7. Rủi ro đã biết

- URL cũ chết: link đã chia sẻ và kết quả Google trỏ vào `/u/<email>` sẽ 404. Chấp nhận (quyết định b).
- Email cũ vẫn còn trong: `AuditLog.meta`, cache Google / Wayback / Cloudflare, ảnh OG. Không gỡ hết được; plan chỉ chấm dứt việc lộ **từ nay**.
- Tên đích có thể đã bị chiếm ⇒ quyết định (a) có thể buộc đặt một tên khác; lệnh không tự chọn thay user.
