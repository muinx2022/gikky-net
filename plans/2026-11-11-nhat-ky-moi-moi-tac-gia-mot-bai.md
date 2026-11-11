# Khối "Nhật ký mới" ở trang chủ: mỗi tác giả MỘT bài

Ngày 2026-11-11. Nhánh `v2`. Sửa `plans/2026-11-10-homepage-v2.md` (khối nhật ký) — chỉ khối "Nhật ký mới", không đụng khối Chủ đề, khối Bài viết, hay feed cũ.

## 1. Yêu cầu của user (nguyên văn)

> "hiện tại đã có người đâu, nên vẫn chỉ là bot post bài, vậy thêm lọc dữ liệu, uniq user show nhật kí mới ở home"

Bối cảnh: user xem dev.gikky.net với dữ liệu thật (2026-11-11): khối "Nhật ký mới" là 8 bài của cùng tài khoản `bot-trader`, mỗi bài một biểu đồ lớn — trang trông như dòng tín hiệu tự động, "nhìn cứ thế nào ấy", mất cảm tình lúc vào lần đầu. Đo qua API công khai của dev (`GET /api/v1/feeds/moi?loai_mach=nhat_ky&limit=50`, trang đầu 24 bài): `bot-trader` 20 bài, `muinx2022@gmail.com` 4 bài ⇒ sau lọc khối còn **2 thẻ** (một của bot, một của chủ site).

## 2. Thiết kế

> **ĐÃ THAY (2026-11-11, sau phản biện).** Bản lọc ở web dưới đây có 3 lỗi VỪA: (V1) chọn theo
> `last_content_at` nên nối mốc vào bài cũ làm thẻ hiện bài cũ; (V2) cửa sổ 50 bài ⇒ bot đăng dồn
> > 50 bài là người thật biến mất khỏi khối; (V3) Django dựng 50 thẻ mỗi lượt vào `/` (trung vị
> 9→41 ms). Thiết kế THỰC THI là **endpoint API riêng**:
> `GET /api/v1/feeds/nhat-ky-moi-tac-gia?limit=N` (`operation_id` `liet_ke_nhat_ky_moi_tac_gia`,
> TS `lietKeNhatKyMoiTacGia`, web bọc ở `lib/api.ts::docNhatKyMoiTacGia`): trong `_mach_hien(None,
> loai_mach="nhat_ky")`, `DISTINCT ON (author_id)` lấy bài `published_at` lớn nhất của mỗi tác giả,
> xếp `published_at` giảm dần, `limit` 1..20 (mặc định 8, ngoài khoảng ⇒ 400), `cursor_ke_tiep`
> luôn `null`. Khoá tác giả là `author_id` ở server (không phải `author.id`/`username` ở web);
> `lib/nhat-ky-moi.ts` đã xoá. Phần §2–§4 bên dưới giữ làm lịch sử; tiêu chí U1/U2 đọc lại là
> "theo `published_at`", không "theo thứ tự feed".

### Bản đầu (đã thay)

- Khối chọn **bài mới nhất của MỖI tác giả**, theo đúng thứ tự feed "Mới" (`last_content_at` giảm dần), lấy tối đa `SO_NHAT_KY` (= 8) tác giả đầu tiên. Bài giữ lại của một tác giả = lần xuất hiện ĐẦU của tác giả đó trong feed.
- **Chỉ ở web, KHÔNG đổi API**: `TrangChuMoi` (`apps/web/app/page.tsx`) gọi `docFeed("moi", { limit: 50, loai_mach: "nhat_ky" })` (50 là trần của API) thay `limit: SO_NHAT_KY`, rồi lọc bằng hàm thuần mới `chonNhatKyMoiTacGia(items, toiDa)` đặt ở `apps/web/lib/nhat-ky-moi.ts` (khoá tác giả = `author.id`; thiếu `author` thì mỗi mạch tự là một khoá). Hằng `SO_NHAT_KY_CUA_SO = 50` đặt cạnh hàm. Hai lời gọi `docFeed` còn lại GIỮ NGUYÊN; mọi lời gọi API kèm `baseUrl` và gọi thẳng theo tên (`type-frontend.spec.ts`).
- Liên kết "Xem tất cả nhật ký →" GIỮ `/?tab=moi&loai_mach=nhat_ky` và feed đó KHÔNG lọc (cửa vào duy nhất xem hết).
- `/chu-de`, `/s/*`, feed cũ `/?tab=…`, `sitemap.ts` (feed `moi` không lọc), `<head>`/h1/lede của `/` — KHÔNG đổi.
- Thẻ nhật ký giữ nguyên kiểu hiện tại (`TheMach`); chưa làm gọn thành hàng thumb nhỏ — chờ user xem kết quả.
- Khối rỗng / chỉ 1 tác giả: vẫn vẽ đúng số thẻ có (1, 2…); khối chỉ ẩn khi feed trả 0 bài như cũ (`nhat-ky-rong`).

## 3. Việc cần làm

1. `apps/web/lib/nhat-ky-moi.ts`: `SO_NHAT_KY_CUA_SO = 50` và `chonNhatKyMoiTacGia(items, toiDa)` (thuần, không đổi thứ tự, không trùng tác giả, cắt ở `toiDa`, không đột biến đối số).
2. `apps/web/app/page.tsx`: gọi `limit: SO_NHAT_KY_CUA_SO`, lọc rồi truyền xuống `TrangChuV2`; `trang-chu-v2.tsx` nhận mảng đã lọc (giữ kiểu `FeedOut`, `nhatKy.items` đã lọc; `cursor_ke_tiep` của khối này không dùng). Sửa chú thích nói "tám bài đầu".
3. Test: đơn vị cho `chonNhatKyMoiTacGia` (rỗng, một tác giả nhiều bài, nhiều tác giả đan xen, > `toiDa` tác giả, thiếu `author`, thứ tự giữ nguyên, không đột biến); e2e trên `/`: trong khối `khoi-nhat-ky` không tác giả nào xuất hiện hai lần, đúng bằng phép lọc áp lên API `feeds/moi?loai_mach=nhat_ky&limit=50` (bài `trang-chu-v2.spec.ts` ~dòng 283 hiện so với 8 bài đầu của API ⇒ sửa theo hợp đồng mới, ghi rõ trong báo cáo); **bài đo chống rỗng**: tiền điều kiện là feed API nhật ký có ít nhất một tác giả đăng ≥ 2 bài trong 50 bài đầu (nếu DB e2e chưa có thì thêm vào `seed_e2e` một cụm nhật ký của một tác giả với ≥ 3 bài MỚI NHẤT feed, không phá các bài đo khác, và ghi rõ); thử phá: bỏ lọc ⇒ bài đo đỏ.
4. Đo trước / sau trên `gikky_e2e` (cùng DB): thời gian + kích thước `GET /api/v1/feeds/moi?loai_mach=nhat_ky&limit=50` so với `limit=8` (JSON thô và gzip), TTFB của `/` (5 lần lấy trung vị); số thẻ trong khối; chiều cao khối.

## 4. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| U1 | Trên `/`, khối "Nhật ký mới": mỗi tác giả tối đa một thẻ; thứ tự đúng thứ tự feed; số thẻ = min(8, số tác giả trong 50 bài đầu). |
| U2 | Thẻ giữ lại của một tác giả là bài XUẤT HIỆN ĐẦU của tác giả đó trong feed (không phải bài cũ hơn). |
| U3 | "Xem tất cả nhật ký →" vẫn trỏ `/?tab=moi&loai_mach=nhat_ky`; trang đó KHÔNG lọc (cùng danh sách và cuộn vô hạn như trước). |
| U4 | `sitemap.ts` vẫn dùng `feeds/moi` không lọc; `<head>`/h1/lede của `/` giữ từng byte (`seo-trang-chu.spec.ts` xanh, không sửa); khối Chủ đề và Bài viết không đổi (cùng id, cùng thứ tự). |
| U5 | `/luat` vẫn `○` tĩnh; không `loading.tsx` / `<Suspense>` ở `/`; hai lời gọi `docFeed` kia không đổi. |
| U6 | Không phá khối khi API trả `author` thiếu / `items` rỗng / một tác giả duy nhất. |
| U7 | Đo: TTFB của `/` không tăng quá +50 ms trung vị so với trước (khi tăng hơn thì báo và nêu phương án đổi sang tham số API). |
| G | `pnpm lint` 0 warning, `tsc`, `pnpm codegen:check` (không đổi API ⇒ khớp), `pnpm build`, `pnpm e2e:don-vi`, pytest (đỏ ⊆ 17 đỏ nền), e2e đầy đủ `CI=1` + `gikky_e2e` (đỏ ⊆ ~22 đỏ nền), vân tay `gikky_dev` không đổi. |

## 5. Rủi ro / đánh đổi

- **SEO — số link `/m/` trên `/` GIẢM.** Khối nhật ký từ 8 link xuống bằng số tác giả (dev: 2), tổng link `/m/` của `/` từ ~19 xuống ~13. Đây là hệ quả CÓ CHỦ Ý của yêu cầu (user: bot chiếm cả khối). Giảm nhẹ: `sitemap.ts` vẫn liệt kê MỌI mạch (feed không lọc); "Xem tất cả nhật ký →" và feed `/?tab=moi&loai_mach=nhat_ky` (có cursor) vẫn là link crawl được; khối Bài viết vẫn 10 link. Theo dõi lượt bot vào `/m/*` sau deploy. Bài đo "tập link `/m/` không giảm" của các lượt trước KHÔNG áp cho khối này nữa — sửa từng bài đo liên quan, ghi lý do.
- **Cửa sổ 50 bài:** nếu 50 bài mới nhất đều của một tác giả thì khối chỉ có 1 thẻ (ví dụ bot đăng dồn). Chấp nhận; nếu thành vấn đề thì đổi sang tham số API (`DISTINCT ON`) — việc sau.
- **Tải trọng server:** Next kéo 50 thẻ thay vì 8 từ Django (mỗi thẻ có `XemTruocOut` tới 10 ảnh): đo ở §3.4; chỉ tốn băng thông nội bộ, HTML không thay đổi kích thước.
- **Trang thưa:** dữ liệu hiện tại chỉ 2 thẻ nhật ký ⇒ trang chủ ngắn đi rõ rệt; khi có người dùng thật khối sẽ đầy lại.

## Báo cáo thực thi

2026-11-11, phiên chính tổng hợp.

- **Lượt 1 (lọc ở web)**: nghiệm thu ĐẠT; phản biện tìm V1/V2/V3 (xem khung đầu §2) + N1–N4 ⇒ bỏ.
- **Lượt 2 (endpoint API)**: `api/api/feeds.py::feed_nhat_ky_moi_tac_gia`; `pnpm codegen`;
  `apps/web/lib/api.ts::docNhatKyMoiTacGia`; xoá `lib/nhat-ky-moi.ts`; pytest
  `tests/test_api_nhat_ky_moi_tac_gia.py` (17 bài, 8 phép phá đều đỏ) + `SO_QUERY_NHAT_KY_MOI_TAC_GIA = 3`;
  e2e nhóm U viết lại (email `@gikky.test`); `don-vi/nhat-ky-moi.spec.ts` thành 6 bài hành vi.
  Đo (425 nhật ký, 80 tác giả): `limit=8` 7,8 ms / 3 truy vấn, so `feeds/moi?limit=50` 24,8 ms.
- **Phiên khác** ("Homepage v2 giao diện mới") dựng tiếp trên endpoint: tải `SO_NHAT_KY_TAI = 20`, vẽ 8,
  phần dư nuôi dải chân khối — ngoài plan này.
- **Phản biện lượt 2**: endpoint không lỗi (rơi về bài hiện được kế tiếp, tác giả bị khoá giống
  `/feeds/moi`, `author` không nullable, 3 truy vấn). Hai lỗi VỪA ở `seed_e2e._xoa` (`--reset` xoá cứng
  mọi mạch trong sub e2e; xoá file ảnh trước khi DB commit) ⇒ đã sửa: chỉ xoá mạch miền `MIEN_E2E`,
  còn mạch người khác thì `CommandError` không xoá gì; file xoá qua `on_commit`; gom ảnh của mạch rác.
  3 bài pytest mới, mỗi bài đỏ khi bỏ phần sửa tương ứng.
- **Số cuối**: pytest 17 đỏ / 2636 pass (bằng số nền, không đỏ nào ở file seed/nhật ký); `pnpm e2e:don-vi`
  678 pass; e2e `trang-chu-v2` + `seo-trang-chu` (`CI=1`, `gikky_e2e`) **42/42 pass**; lint, codegen:check,
  build xanh; vân tay `gikky_dev` không đổi.
- **Chưa làm**: bộ e2e đầy đủ chưa có bản sạch sau khi phiên khác viết lại trang chủ (lần gần nhất 928 pass /
  29 đỏ, 21 thuộc nền, phần còn lại giải thích ở báo cáo agent). Mép còn lại: `LOI-VA-NO.md` P-20261111-1, -2.
