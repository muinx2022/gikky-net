# Dọn rác `gikky_e2e` — đóng P-20260830-13

Chốt 2026-08-31. User uỷ quyền ("cần sửa gì thì làm đi"); cơ chế do phiên chính chọn.

## 1. Vấn đề (P-20260830-13)

Mỗi lượt `pnpm e2e`, các spec ghi (`tai-khoan-va-ghi.spec.ts:150,292`) để lại **bình luận
SỐNG** của tài khoản dùng-một-lần `@gikky.test` trong mạch seed HPG. `dung-seed.ts::
donRacLanTruoc` chỉ ẩn **MẠCH** rác, không dọn **BÌNH LUẬN** rác nằm trong mạch seed. Rác
tích lại đổi ngầm đối tượng đo của mọi bài chọn "mốc đông nhất / thread đầu tiên" — chính
nó đẻ ra cú đỏ A10 bị ghi nhầm thành lỗi sản phẩm (P-20260830-8). Bằng chứng: mốc 9 HPG
seed 3 thread, DB đang 8.

## 2. Cơ chế chọn: management command, gọi từ globalSetup

Ba lối trong sổ: (1) dọn trong globalSetup · (2) `seed_dev --reset` · (3) ép mọi bài chọn
mục tiêu ghim được. Chọn **(1)**, vì: (2) là lệnh phá — chạy nhầm trên DB thật là mất dữ
liệu, đúng ca `dung-seed.ts` đã cố tránh; (3) phải sửa hàng loạt spec và vẫn để DB bẩn.
Nhưng (1) làm bằng **command Python** chứ không nhét thêm inline `shell -c` vào TS:

- inline hiện tại đã 15 dòng Python trong chuỗi TS — không pytest nào chạm được, không thử
  phá được;
- command thì test được, và logic ẩn-mạch sẵn có chuyển vào cùng chỗ.

## 3. Phạm vi

1. **MỚI** `api/core/management/commands/don_rac_e2e.py`:
   - Ẩn mọi `Mach` của tác giả email `@gikky.test` chưa ẩn (chuyển logic từ
     `donRacLanTruoc`, giữ nguyên lý do dùng `dat_an_mach` — L32).
   - **MỚI**: ẩn mọi `Comment` của tác giả `@gikky.test` chưa ẩn, nằm trong mạch KHÔNG
     phải rác (`mach__hidden_at__isnull=True` — mạch rác đã ẩn cả mạch, khỏi tốn lượt),
     qua đường ghi mod-hide sẵn có của `core/ghi.py` (tìm đúng hàm — quanh
     `dat_an_binh_luan`/tương tự; TUYỆT ĐỐI không ghi thẳng `hidden_at`).
   - Actor: tài khoản staff đầu tiên (như bản cũ); không có staff ⇒ lỗi nói tiếng người.
   - In số đã ẩn từng loại. Idempotent.
   - An toàn dữ liệu thật: chỉ đụng nội dung của tác giả `@gikky.test` — ranh giới miền
     email đã chốt trong docstring `dung-seed.ts` (mọi tài khoản seed là
     `@vi-du.gikky.net`, dữ liệu thật không dùng `@gikky.test`). Ghi rõ trong docstring.
2. `apps/web/e2e/dung-seed.ts`: `donRacLanTruoc` thay inline python bằng gọi
   `scripts/py.mjs don_rac_e2e`; giữ nguyên vị trí trong globalSetup; docstring cập nhật
   (trỏ sang command, giữ phần "vì sao ẩn chứ không xoá" + ranh giới miền email).
3. **MỚI** `api/tests/test_don_rac_e2e.py` — pytest, mỗi bài THỬ PHÁ theo luật 4:
   - bình luận `@gikky.test` trong mạch seed → chạy command → `hidden_at` đặt,
     `comment_count` mạch giảm đúng (đường ghi cập nhật đếm);
   - bình luận của `@vi-du.gikky.net` và của user thường KHÔNG bị đụng;
   - mạch `@gikky.test` bị ẩn; idempotent (chạy 2 lần, lần 2 ẩn 0);
   - không có staff ⇒ CommandError.
4. Không đụng file nào khác. (Spec e2e KHÔNG sửa — mục tiêu là trả DB về đúng seed để các
   bài "chọn đông nhất" đo đúng đối tượng; A10 đã tự chọn theo thuộc tính từ lượt trước.)

## 4. Tiêu chí nghiệm thu

| # | Tiêu chí | Cách đo |
|---|---|---|
| 1 | pytest mới xanh, và từng bài đã thử phá (đảo điều kiện lọc → đỏ) — ghi nguyên văn 1 ca | `pnpm test -- -k don_rac -x` |
| 2 | Toàn bộ pytest xanh 0 warning | `pnpm test` |
| 3 | Trên `gikky_e2e`: TRƯỚC chạy ghi số bình luận `@gikky.test` sống trong mạch seed (psql đếm); SAU `pnpm e2e` (globalSetup gọi command) số đó = 0 và mốc 9 HPG về đúng 3 thread seed | psql chỉ đọc + so |
| 4 | Bộ đầy đủ `pnpm e2e` (gikky_e2e) vẫn **0 failed** | |
| 5 | `pnpm lint` 0/0 (file TS đổi) | |
| 6 | Diff đúng 3 file mục 3 (+ file bẩn sẵn + 2 file lượt T8/P-14 chưa commit) | `git diff HEAD --stat` |

Nền hiện tại: bộ đầy đủ 572 passed / 0 failed (đo 2026-08-31, sau lượt /luat).

## 5. Chặng 5

Ghi sổ, đóng P-20260830-13, commit pathspec (user đã uỷ quyền), báo cáo.

## 6. Cập nhật sau nghiệm thu + phản biện (vòng 2, 2026-09-01)

Tiêu chí #3 mục 4 viết lỏng: *"SAU `pnpm e2e` số đó = 0"* — lệnh dọn ở ĐẦU lượt, nên rác
của chính lượt vừa chạy nằm lại tới lượt sau (đo được: 17 mạch + ~10 bình luận). Nghĩa
đúng: **rác của các lượt TRƯỚC mốc globalSetup = 0** — và vế đó ĐẠT.

Phản biện bắt 4 lỗ thật + 2 chuông thiếu, vá ở vòng 2:
1. Thiếu `deleted_at__isnull=True` ⇒ ẩn bia mộ làm nhãn lật `DA_XOA→DA_AN`, tắt
   `giu_vi_da_trich`, rơi khối trích — đã vá + bài đo đối chứng.
2. Thiếu `lam_moi_mach` ⇒ ISR giữ rác tới 60 phút khi server được dùng lại — đã vá (gom
   mỗi mạch một lời gọi, sau mọi transaction) + bài đo mock.
3. Thiếu cổng môi trường — cửa đăng ký sản phẩm NHẬN miền `@gikky.test`
   (`test_tai_khoan.py:66`), nên "prod không có hàng khớp" là giả định, không phải bất
   biến — đã thêm `doi_dev` (lớp 2) + bài đo DEBUG=False, docstring viết lại trung thực.
4. Nửa mạch không có chuông chống ghi-thẳng — đã thêm assert AuditLog `an_mach` (bản
   `.update()` không đẻ audit ⇒ đỏ).
5. Đối chứng mạch miền seed `@vi-du.gikky.net` bổ sung vào bài 3.
6. Dây nối globalSetup→command không ai canh — thêm
   `e2e/don-vi/dung-seed-goi-don-rac.spec.ts` (don-vi thành 403 bài).

Con số ĐỘC LẬP với bộ lọc (phản biện đòi, thay cho "25/25" vốn là phép đo vòng):
chạy tay lệnh trên gikky_e2e ⇒ HPG `comment_count` **24/24** — đúng bất biến seed
(`test_seed_dev.py:87`); 0 bình luận `@gikky.test` sống; 0 mạch rác sống; 0 bia mộ bị
ẩn nhầm; mốc 9 = 3 thread đọc được.

NGOÀI phạm vi lượt, ghi sổ: vote/report/tài khoản `@gikky.test` tích qua các lượt (vote
là vế nặng nhất — điểm seed trôi vĩnh viễn), xem P-20260901-1.
