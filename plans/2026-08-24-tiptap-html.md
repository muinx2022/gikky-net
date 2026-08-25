# Đăng bài: Tiptap + lưu HTML (thay markdown)

Chốt 2026-08-24 — **user chọn sau khi được nêu rõ đánh đổi**. Tôi đã khuyến nghị phương án
khác (thanh công cụ + xem trước trên markdown hiện có) và user chọn phương án HTML đầy đủ.
Ghi lại để người sau biết đây là quyết định có chủ đích, không phải ai đó không đọc
`lib/markdown.ts`.

## Cái bị lật

`apps/web/lib/markdown.ts` cố ý **không sinh HTML**: nó phân tích ra **cây node có kiểu**
(7 loại) và `ThanVan` render bằng JSX. Docstring của nó nói thẳng vì sao — allowlist thay
vì blocklist, `onerror=`/`onclick=` "không có chỗ tồn tại", `javascript:` chặn bằng
allowlist giao thức.

Chuyển sang HTML là **quay lại đúng mô hình sanitize-rồi-nhúng** mà file ấy từ chối. Vì
thế bản vá này phải mang theo hàng rào riêng, nếu không nó là một bước lùi thuần tuý.

## Luật KHÔNG thương lượng của đợt này

1. **Sanitize ở SERVER, lúc GHI.** `nh3` (Rust ammonia) trong `core/ghi.py`, trên **mọi**
   đường ghi `body`. Sanitize ở client là thứ bỏ qua được bằng một lệnh `curl` — nó chỉ để
   người dùng thấy đúng cái mình sắp lưu, không phải hàng rào.
2. **Allowlist thẻ + thuộc tính**, không blocklist. Chỉ: `p br strong em u s code pre
   blockquote ul ol li a h2 h3 hr`. Thuộc tính: **chỉ** `a[href]`. Cấm sạch `on*`, `style`,
   `class`, `id`, `script`, `iframe`, `object`, `embed`, `form`, `svg`.
3. **`a[href]` allowlist giao thức** `http`/`https`/`mailto` — giữ đúng lời hứa cũ của
   `markdown.ts`. Thêm `rel="nofollow ugc noopener"` + `target="_blank"`.
4. **Sanitize lần hai lúc ĐỌC** không làm — thay vào đó có **bài đo bất biến**: mọi `body`
   trong DB phải bằng chính nó sau khi sanitize (idempotent). Rẻ hơn, và bắt được cả dữ
   liệu lọt vào bằng đường khác.
5. **Dữ liệu CŨ là markdown** ⇒ phải có **data migration** chuyển markdown → HTML theo đúng
   7 cấu trúc cũ. Không migrate là mọi bài cũ hiện ra sai. Migration phải **idempotent** và
   có bài đo trên mẫu thật của seed.

## Bán kính ảnh hưởng (đã đo, không phải đoán)

| Chỗ | Đang giả định markdown |
|---|---|
| `apps/web/lib/markdown.ts` + `ThanVan` | 6 component dùng: `the-moc`, `binh-luan`, `khoi-trich`, `ban-cu-moc`, `mat-bao`, `than-van` |
| `api/api/trinh_bay.py::trich_van_ban` | body → văn bản thuần cho `xem_truoc` của thẻ feed |
| `api/core/tim_kiem.py` | đẩy `body` vào index Meilisearch |
| `apps/web/components/trang-mach.tsx::tomTat` | cắt 150 ký tự làm `meta description` |
| `e2e/don-vi/markdown.spec.ts` | **13 bài đo** |
| digest email | mẫu thư có nhúng trích đoạn |

Mỗi chỗ trên phải đổi từ "gỡ dấu markdown" sang "gỡ thẻ HTML", và **`meta description` /
digest tuyệt đối không được rò thẻ HTML ra ngoài**.

## Phạm vi ĐỢT NÀY

`body` của **mạch/mốc** (phần "đăng bài" user nói). **Bình luận GIỮ NGUYÊN markdown** —
composer khán đài là ô gõ nhanh, nhét một WYSIWYG vào đó là đổi một thao tác 3 giây thành
một trình soạn thảo. Hệ quả: hai định dạng cùng tồn tại ⇒ **phải có cột phân biệt**, xem
dưới.

## Cách phân biệt: cột `body_dinh_dang`

`Moc.body_dinh_dang` ∈ `{"markdown", "html"}`, mặc định `"markdown"`. Renderer chọn đường
theo cột này. Vì sao cột chứ không "đoán bằng regex": đoán là sai ở đúng nội dung người
dùng gõ dấu `<` — và đó là nội dung của một site tài chính nói về "giá < 27.80".

Migration đổi dữ liệu cũ sang HTML **và** set cột — sau migration mọi mốc là `"html"`,
nhưng cột ở lại để bình luận (markdown) và để lượt sau còn đường lùi.

---

# BỔ SUNG — Upload ẢNH vào thẳng nội dung (user chốt 2026-08-24)

> "Thêm 1 nút upload media, cho phép upload media (v1 này sẽ up ảnh, chưa cần up vid)"
> "thêm vào editor để upload vào content luôn"

## Hai thứ chặn, phải gỡ ở backend trước

1. **`lam_sach` cố ý KHÔNG có `img`** — docstring `THE_CHO_PHEP` ghi rõ "ảnh sống ở
   gallery". Chèn `<img>` mà không mở allowlist thì ảnh **bị xoá sạch lúc lưu**: người dùng
   thấy ảnh trong editor, đăng lên thì mất.
2. **`tai_anh_moc` đòi `moc_id` ĐÃ TỒN TẠI**, mà lúc soạn bài thì mốc chưa có. Cần một cửa
   upload **không gắn mốc**.

## Ranh giới an toàn — không thương lượng

- Allowlist thêm `img`, thuộc tính **chỉ** `src` + `alt`. Không `srcset`, không `onerror`,
  không `style`, không `width/height` (kích thước do CSS lo).
- **`src` CHỈ được trỏ vào kho ảnh của chính site** (tiền tố `MEDIA_URL` = `/media/`). Ảnh
  từ tên miền ngoài là:
  - một **pixel theo dõi**: mỗi người đọc bài là một lượt lộ IP + user-agent cho bên thứ ba;
  - **mixed content** và link chết khi bên kia đổi đường dẫn.
  Lọc sau `nh3`: `img` nào có `src` không khớp tiền tố ⇒ **gỡ cả thẻ**, không phải chỉ gỡ
  thuộc tính (một `<img>` không `src` là một ô vỡ).
- Cửa upload mới **phải có hạn mức** — không thì nó là dịch vụ lưu trữ file miễn phí. Dùng
  lại `core/han_muc.py`, không chế cơ chế đếm thứ hai.
- Tái dùng `core/anh.py::xu_ly_anh_tai_len` (chặn theo byte, nhận dạng bằng NỘI DUNG, chống
  decompression bomb, tái mã hoá) và `core/anh_luu.py`. **Không** viết đường xử lý ảnh thứ hai.

## Phạm vi v1

**Chỉ ảnh.** Không video — user nói rõ. Đừng dựng sẵn "cho sau này": một cửa nhận video là
một bài toán khác hẳn (dung lượng, transcode, streaming) và mở nó bằng một dòng `accept=`
là mở nhầm.
