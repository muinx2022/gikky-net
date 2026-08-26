# Ô nhập bình luận lên đầu · danh sách bình luận mặc định MỚI TRƯỚC

*Chốt 2026-08-26 (user).* Hai câu, hai việc:

> "di chuyển cái ô nhập bình luận lên ngay dưới chữ bình luận, và thay đổi hiển thị
> list cmt, order by created desc"

## 1. Ô nhập lên ngay dưới tiêu đề "Bình luận"

Hôm nay ô nhập của **mặt CẶN** nằm ở **cuối** `KhanDai`, sau cả `xem thêm bình luận ↓`.
Trên một mạch 24 bình luận, muốn viết một câu phải cuộn qua toàn bộ cây — và cuộn xong
thì cái nút "xem thêm" ngay trên nó lại mời cuộn tiếp.

**Mặt BÃO không đổi.** Ở đó ô nhập đã đứng TRƯỚC cả khu bình luận
(`trang-mach.tsx`, `data-testid="composer-mat-bao"`, wireframe 9.2) với câu mồi riêng
theo mốc mới nhất. Nó vốn đã ở trên, không có gì để "chuyển lên"; gộp hai chỗ làm một
là một việc khác (L05 đang ghim "đúng MỘT ô nhập mỗi mặt") và không nằm trong câu hỏi.

## 2. Sort mặc định: `hay_nhat` → `moi_nhat`

`moi_nhat` **đã có sẵn** ở cả ba tầng (`core/doc_noi_dung.py::sap_theo_thoi_gian`,
`?sort=` của Ninja, thanh sort trên UI) và nó chính là `ORDER BY (created_at, id) DESC`.
Nên việc này **không đụng Django** — chỉ đổi giá trị mặc định phía frontend.

Hai chỗ phải đổi CÙNG NHAU, thiếu một là URL và màn hình nói hai chuyện khác nhau:

- `lib/khan-dai.ts::SORT_MAC_DINH` — cái `docSort` rơi về khi `?sort=` vắng/rác;
- `lib/url.ts::duongDanKhanDai` — link `💬 N` trên thẻ feed đang **gõ cứng**
  `sort=hay_nhat`. Để nguyên thì bấm từ feed vào ra "Hay nhất" trong khi vào thẳng
  `/m/…` ra "Mới nhất".

## Tiêu chí nghiệm thu (đo được)

| # | Tiêu chí | Cách đo |
|---|---|---|
| 1 | `/m/<slug>-<id>` (mặt CẶN): ô nhập nằm GIỮA tiêu đề "Bình luận" và thanh sort | DOM: `compareDocumentPosition` của `[data-testid=composer]` so với `h2` và `[data-testid=thanh-sort]` |
| 2 | Vẫn đúng **một** ô nhập trong `khan-dai`, và mặt BÃO vẫn đúng một ở `composer-mat-bao` | L05 (`va-v2.spec.ts`) xanh, không sửa phần khẳng định |
| 3 | Vào `/m/…` không `?sort=` ⇒ `sort-moi_nhat` mang `aria-current="true"` | `mach-can.spec.ts` V6 |
| 4 | Thứ tự thread trong DOM = thứ tự `GET …/comments?sort=moi_nhat` trả về | V6 đã so sẵn `id_dom` vs `kd.threads` |
| 5 | `docSort` rác/rỗng/undefined → `"moi_nhat"` | `khan-dai-va-dem.spec.ts` |
| 6 | Link `💬 N` trên thẻ feed mang `sort=moi_nhat` | `duongDanKhanDai` |
| 7 | `pnpm lint` 0 warning · `tsc` sạch · `pnpm e2e:don-vi` xanh | chạy lại |

## Ngoài phạm vi (ghi ra để không tiện tay làm)

- Thứ tự các nút trên thanh sort (`SORT_KHAN_DAI`) giữ nguyên `hay_nhat · moi_nhat ·
  cu_nhat`. Đưa nút mặc định ra đầu là một quyết định thẩm mỹ riêng, user chưa hỏi.
- Mặc định `?sort=` của **Ninja** giữ `hay_nhat`: frontend luôn truyền tường minh, và
  đó là hợp đồng API có bài đo riêng.
- `.composer` / `.o_nhap` / `.moi_dang_nhap` trong `khan-dai.module.css` là CSS CHẾT từ
  lượt gỡ `ComposerTat` (Phase 2). Không dọn trong lượt này.

---

## Kết quả kiểm chứng (2026-08-26)

**⚠ Lượt này phiên chính TỰ LÀM và TỰ ĐO — không có `nghiem-thu`/`phan-bien` độc lập.**
Người đọc cần biết con số dưới đây do chính người viết code đo.

| # | Kết quả | Bằng chứng |
|---|---|---|
| 1 | ĐẠT | DOM thật của `/m/…-1`: con của `[data-testid=khan-dai]` theo thứ tự `dau · composer · cau-dang-doc · thanh-sort · danh_sach`; `compareDocumentPosition` cho `o_sau_h2 / sort_sau_o / cay_sau_sort` đều `true` |
| 2 | ĐẠT | mặt CẶN: `khan-dai` có đúng **1** `[data-testid=composer]`. Mặt BÃO (`?view=bao`): `composer-mat-bao` = 1, `khan-dai` = **0** |
| 3 | ĐẠT | vào `/m/…-1` không `?sort=` ⇒ `aria-current` nằm ở `sort-moi_nhat` |
| 4 | ĐẠT | `id` thread trong DOM `[23,22,21,19,18,16,14,13,11,10,8,7,3,1]` **bằng đúng** `GET /api/v1/machs/1/comments?sort=moi_nhat` trả về |
| 5 | ĐẠT | `khan-dai-va-dem.spec.ts` xanh |
| 6 | ĐẠT | trang chủ: cả 2 link `💬 N` ra `?khan_dai=1&sort=moi_nhat#khan-dai` |
| 7 | ĐẠT | `pnpm lint` 0 warning · `tsc --noEmit` sạch · `pnpm e2e:don-vi` **304 passed** |

### Thử phá (luật 4)

- `SORT_MAC_DINH` → `"hay_nhat"` ⇒ bài mới **ĐỎ**; khôi phục ⇒ xanh.
- `duongDanKhanDai` gõ cứng lại `sort=hay_nhat` ⇒ bài mới **ĐỎ**; khôi phục ⇒ xanh.

### CÒN NỢ — nói thẳng

1. **Bài đo vị trí ô nhập (`mach-can.spec.ts`, ca mới) CHƯA ĐƯỢC CHẠY, và chưa thử phá.**
   Nó thuộc bộ `pnpm e2e`, mà bộ đó chiếm cổng 3000 + 8000 và **seed đè `gikky_dev`** —
   nơi đang có bài thật do user đăng. Thứ đo được vị trí hôm nay là DOM của trình duyệt
   thật (bảng trên), không phải bài đo ấy.
2. `e2e/don-vi/trang-loi.spec.ts#14` (`/luat` phải là route TĨNH) **vẫn ĐỎ** — nợ có
   TỪ TRƯỚC lượt này, do `KhungHaiCot` gọi `GET /subs` phía server. Không phát sinh mới.

---

# Lượt 2 (cùng ngày): tắt khối "Đáng chú ý"

User chốt sau khi đọc giải thích về quy tắc sắp xếp:

> "trước mắt ta chưa tính đến điểm, mà chỉ tính đến việc cái nào cmt mới nhất thì lên trước"

Và trả lời hai câu hỏi phân nhánh:

| Hỏi | Chốt |
|---|---|
| Thứ tự thread GỐC theo mốc thời gian nào? | **Theo giờ của chính bình luận gốc** (không "bump" theo reply mới) |
| Reply BÊN TRONG thread sắp thế nào? | **Mới → cũ**, giống gốc |

⇒ Cả hai đúng bằng hành vi đang chạy, nên **không đụng Django, không đụng `doc_noi_dung.py`**.
Việc duy nhất: khối "Đáng chú ý" (`đã trích ∪ top-10 wilson`) xếp hạng bằng ĐIỂM ⇒ tắt.

## Con số làm nó chết

Mạch HPG: cây có **14** thread gốc, khối hiện **11** trong số đó — cùng nội dung, khác thứ
tự, ngay phía trên. Chốt chặn cũ (`nenRenderCauDangDoc`) chỉ hỏi *"có ứng viên nào bị bỏ
lại không"*; ở đây bỏ lại 3 nên nó render. "Lọc ra 11 trên 14" thì không còn là lọc.

## Cách tắt: CÔNG TẮC, không phải gỡ

`lib/khan-dai.ts::HIEN_KHOI_DANG_CHU_Y = false`. Component `CauDangDoc`,
`lib/api.ts::docCauDangDoc`, `?dang_doc=1` phía Django và
`api/tests/test_api_cau_dang_doc.py` **còn nguyên**. User nói *"trước mắt"* — bật lại là
đổi một chữ.

Cờ đứng **trước** `!la_bao` ở `trang-mach.tsx` để cắt luôn LỜI GỌI, không chỉ cắt render.

## Bài đo

- **Thêm** `khan-dai-va-dem.spec.ts`: (a) cờ = `false` ghim bằng giá trị; (b) hàng rào
  ĐỌC MÃ NGUỒN ép lời gọi `docCauDangDoc` phải nằm trong câu lệnh có nhắc tên cờ.
- **Viết lại** `vo-reddit.spec.ts` describe A5 → "khối TẮT", kèm ba vế chống rỗng đọc
  từ API (`threads.length > 0`, `so_ung_vien_bo_lai > 0`) để `toHaveCount(0)` không xanh
  rỗng.
- **Xoá** 4 bài đo render của khối (nó không còn render). Hợp đồng API của khối vẫn được
  `api/tests/test_api_cau_dang_doc.py` giữ đủ — không mất bài đo nào của Django.
- **Sửa** W11: bỏ dòng đòi `cau-dang-doc` visible; nguồn trùng còn lại (ngăn kéo) tự nó
  đủ dựng lại bất biến, vế chống rỗng vẫn đo đúng chuyện đó.

## Thử phá — và một proof RỖNG bị bắt tại chỗ

- Bật cờ `true` ⇒ bài (a) **ĐỎ**. Khôi phục ⇒ xanh.
- Gỡ cờ khỏi câu lệnh gọi ⇒ bài (b) **XANH** ← **proof đo RỖNG**. Nguyên nhân: nó đọc
  mã nguồn còn nguyên chú thích, mà dòng chú thích ngay trên lời gọi có nhắc tên cờ, nên
  đoạn cắt theo dấu `;` ôm trọn dòng ấy. Vá bằng `boChuThich` trước khi cắt; phá lại ⇒
  **ĐỎ**. Ghi lại vì đây đúng loài lỗi mà `D:\Projects\CLAUDE.md` dựng cả quy trình để bắt.

## Kiểm chứng

DOM `/m/…-1`: con của `khan-dai` = `dau · composer · thanh-sort · danh_sach` · khối
`cau-dang-doc` = **0** · API vẫn tính ra tập (11 câu, bỏ lại 3) nên sự vắng mặt là quyết
định chứ không phải API hỏng · **0** comment id bị render hai lần trong trang (trước là 21
nút bản phụ) · `sort-moi_nhat` đang sáng.

`pnpm lint` 0 warning · `tsc --noEmit` sạch · `pnpm e2e:don-vi` **306 passed**
(1 đỏ = nợ `/luat` có từ trước).

## Chưa làm — cần user quyết

Nút **"Hay nhất"** vẫn còn trên thanh sort. Tôi giữ lại vì đó là lựa chọn NGƯỜI DÙNG tự
bấm, khác với khối "Đáng chú ý" vốn bị áp đặt không có đường tắt. Nếu "chưa tính đến điểm"
nghĩa là bỏ luôn cả sort ấy thì nói một câu — gỡ khỏi `SORT_KHAN_DAI` là đủ, Django giữ
nguyên.
