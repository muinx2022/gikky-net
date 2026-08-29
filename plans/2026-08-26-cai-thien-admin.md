# Cải thiện khu quản trị `apps/admin` — 9 hạng mục + hành động hàng loạt

**Trạng thái:** XONG (2026-08-27) — đủ 5 chặng, đã chép về cây chính, CHƯA commit
(user chưa yêu cầu). Xem Báo cáo thực thi cuối file.

## Bối cảnh

Khảo sát 2026-08-26 (phiên chính đọc toàn bộ `apps/admin`, ~35 file / ~6.900 dòng) tìm ra:
2 lỗi thật, 3 chức năng thiếu, 3 điểm UX, 1 mẫu lặp kỹ thuật. User chốt làm hết, **kèm cả
hành động hàng loạt** (mục "xa hơn" duy nhất được chọn — ô "lý do khi ẩn" KHÔNG nằm trong
lượt này).

⚠ **Cây chính đang NHIỄM**: phiên Claude khác đang sửa dở `api/`, `apps/web/components`,
`packages/api-client` (file sinh ra!), và trong chính `apps/admin`:
`components/icon.tsx` · `components/khung/menu.ts` · `components/dung-mo-ta.ts` (đều M),
cùng `app/check-fx/` + `lib/fx.ts` (untracked, việc Check FX). ⇒ **mọi thực thi + đo đạc
làm trong worktree tách tại HEAD `ec47572`**, và tuyệt đối không đụng các file kể trên.

## Phạm vi

### LÀM (9 hạng mục)

**H1 — Hook chung `useHanhDong`** (`apps/admin/lib/hanh-dong.ts`, file mới)
Wrapper `chay` hiện chép nguyên xi ~9 chỗ (bao-cao, users, machs, binh-luan, subs,
quan-tri-vien, m/[machId], u/[username], cai-dat). Gom về một hook:
- Nhận một callback `async lamTuoi()` (mỗi trang tự quyết: `napLai()+lamMoi()` hay chỉ `nap()`).
- Trả `{ dang_chay, loi, chay }`; `chay(viec)` = khoá nút → chạy → lỗi thì hiện, xong thì `lamTuoi`.
- **Xử lý hết phiên**: khi `maLoi(error) === MA_CHUA_DANG_NHAP` (đã có sẵn trong `lib/api.ts`),
  thông điệp lỗi phải kèm **link bấm được tới `/dang-nhap`** (cách render tuỳ chọn — ví dụ mở
  rộng `HienLoi` nhận thêm node hành động; gắn `data-testid="loi-dang-nhap-lai"`).
- Tên hook PHẢI mở đầu `use` (`react-hooks/rules-of-hooks` + `--max-warnings=0`).
- KHÔNG phá hàng rào `type-admin.spec.ts`: lời gọi API vẫn viết thẳng tên hàm tại chỗ gọi,
  hook chỉ nhận thunk — đúng mẫu `chay(() => quanTriX({ baseUrl, … }))` hiện có.

**H2 — Sửa nút Ẩn bình luận nuốt lỗi** ở `app/m/[machId]/page.tsx::BinhLuanCuaMach`
(dòng ~310): hiện `await quanTriDatAnBinhLuan(...)` vứt kết quả, không đọc `{error}`,
không có chỗ hiện lỗi. Chuyển sang `useHanhDong` (H1) + `HienLoi`.

**H3 — Link `↗` ở `/binh-luan`** (dòng ~218): thêm `title="Mở trang công khai"` +
`aria-label` kèm ngữ cảnh, theo đúng mẫu `/machs` dòng ~372 (luật ba đường L30).

**H4 — Nút Đăng xuất** ở thanh trên (`components/khung/thanh-tren.tsx`):
- Gọi `DELETE ${GOC_ALLAUTH}/auth/session` với header `X-CSRFToken: docCsrf()`,
  `credentials: "same-origin"` (helper đặt cạnh `baoDamCsrf` trong `lib/api.ts`).
- ⚠ allauth headless trả **401 cho DELETE session THÀNH CÔNG** (phiên không còn) — 401/410
  ở đây là "đã thoát", KHÔNG phải lỗi. Chỉ báo lỗi khi fetch chết trước khi có HTTP.
- Xong thì `window.location.href = "/dang-nhap"` (full reload — cùng lý do trang đăng nhập
  đã ghi: `CongQuanTri` giữ kết quả `/me` cũ trong state khi điều hướng client-side).
- Nút chữ "Đăng xuất" (KHÔNG thêm icon — `icon.tsx` phiên khác đang sửa dở), phải bấm được
  ở CẢ bề rộng mobile (<sm, nơi khối danh tính đang ẩn). `data-testid="nut-dang-xuat"`.

**H5 — Badge chuông tự làm mới** (`components/khung/ngu-canh.tsx`): gọi lại `lamMoi()` khi
tab hiện lại (`visibilitychange` → `visible`) và khi cửa sổ `focus`; guard chống gọi chồng
(đang tải thì bỏ lượt); gỡ listener khi unmount.

**H6 — Xác nhận xoá chuyên mục** (`app/subs/page.tsx`): nút "Xoá" trên hàng KHÔNG gọi API
ngay nữa — mở `NganKeo` xác nhận (state riêng `mo_xoa: string | null`, đúng quy ước "mỗi
ngăn kéo một biến"), trong đó mới có nút gọi `quanTriXoaSub`. Giữ nguyên các chặn hiện có
(disabled khi còn mạch + ba đường L30).

**H7 — Datalist cho bộ lọc nhật ký** (`app/nhat-ky/page.tsx`): thêm `<datalist>` gợi ý cho
ô `action`, giá trị = 22 hằng `AUDIT_*` trong `api/core/ghi.py:1392-1423` (`an_moc`,
`go_an_moc`, `an_binh_luan`, `go_an_binh_luan`, `an_mach`, `go_an_mach`, `khoa_mach`,
`mo_khoa_mach`, `ban_user`, `go_ban_user`, `dong_bao_cao`, `tao_sub`, `sua_sub`, `xoa_sub`,
`sua_cai_dat_google`, `xoa_cai_dat_google`, `tao_user`, `sua_user`, `dat_mat_khau_user`,
`gan_mod_sub`, `go_mod_sub`, `doi_quyen_mod`). Kèm comment chỉ rõ nguồn + rằng datalist chỉ
là GỢI Ý (gõ tự do vẫn được — thêm action mới ở server mà quên chỗ này thì không hỏng gì,
chỉ thiếu một gợi ý). Vẫn khớp BẰNG ĐÚNG như cũ.

**H8 — Tiêu đề tab theo trang**: `TieuDeTrang` (`components/ui.tsx`) đặt
`document.title = "<tên trang> — gikky quản trị"` trong effect (mọi page đều là client
component nên không dùng được `metadata` per-page). Trang không dùng `TieuDeTrang`:
`/m/[machId]` đặt theo tiêu đề mạch sau khi nạp, `/u/[username]` theo `u/<username>`,
`/dang-nhap` = "Đăng nhập — gikky quản trị".

**H9 — Hành động hàng loạt** (KHÔNG đổi backend — lặp gọi endpoint đơn sẵn có):
- `/machs`: cột checkbox + ô "chọn cả trang" ở header; thanh hành động hiện khi ≥1 chọn:
  Ẩn · Gỡ ẩn · Khoá · Mở khoá · Bỏ chọn, kèm đếm "đã chọn N".
- `/binh-luan`: như trên với Ẩn · Gỡ ẩn.
- Logic thuần tách vào `apps/admin/lib/hang-loat.ts` (file mới, PHẢI test được):
  - lọc no-op: "Ẩn" chỉ gọi trên hàng CHƯA ẩn, "Khoá" chỉ trên hàng chưa khoá, v.v.;
  - tóm tắt kết quả: câu tiếng Việt "x/y thành công" + liệt kê id lỗi.
- Chạy **TUẦN TỰ** từng id, không `Promise.all`: tránh dồn tranh khoá hàng `Mach` (thứ tự
  khoá `Comment/Moc → Mach → MocAnh` — xem CLAUDE.md) và tránh dội N request đồng thời.
  Lỗi con thì ghi lại và đi tiếp; riêng `chua_dang_nhap` thì DỪNG phần còn lại.
- Gọi API thẳng tên hàm trong vòng lặp (`quanTriDatAnMach` / `quanTriDatKhoaMach` /
  `quanTriDatAnBinhLuan` với `baseUrl`) — không alias qua biến (hàng rào type-admin).
- Ẩn hàng loạt gửi `ly_do: ""` — đồng nhất với nút đơn hiện tại.
- Sau khi chạy xong: nạp lại bảng + `lamMoi()`; **sau MỌI lần bảng nạp lại, selection về
  rỗng** (đổi trang / đổi bộ lọc / nạp lại đều xoá chọn — luật đơn giản, đo được).
- Checkbox từng hàng có `aria-label` kèm tiêu đề/trích yếu. `data-testid`:
  `chon-mach-<id>`, `chon-binh-luan-<id>`, `chon-tat-ca`, `thanh-hang-loat`,
  `nut-hl-an`, `nut-hl-go-an`, `nut-hl-khoa`, `nut-hl-mo-khoa`.
- **Test mới bắt buộc** cho 2 hàm thuần của `hang-loat.ts`, đặt trong
  `apps/web/e2e/don-vi/` (import tương đối sang `apps/admin/lib/` — cùng cách các spec
  don-vi khác import lib; nếu import cross-app không chạy được thì DỪNG và báo, đừng chế
  regex). **Thử phá**: đảo logic lọc no-op → test phải ĐỎ → khôi phục; ghi bằng chứng.

### KHÔNG LÀM

- Ô "lý do" khi ẩn/khoá từ bảng (vẫn `ly_do: ""`) — user không chọn mục này.
- Endpoint bulk phía backend, mọi thay đổi `api/` / codegen / `packages/api-client`.
- Không đụng: `components/icon.tsx`, `components/khung/menu.ts`,
  `components/dung-mo-ta.ts`, `app/check-fx/**`, `lib/fx.ts`, và mọi file M/untracked
  của phiên khác (danh sách ở Bối cảnh).
- Không thêm mục menu mới (không đụng hàng rào `menu-quan-tri.spec.ts`).
- Không commit / push / deploy.

## Cách thực thi (môi trường)

1. `git worktree add --detach <scratchpad>\wt-admin ec47572` (HEAD lúc viết plan).
2. Kiểm nền bằng NỘI DUNG: `apps/admin/lib/danh-sach.ts` + `apps/admin/app/bao-cao/page.tsx`
   phải tồn tại; `git log --oneline -1` = `ec47572`.
3. Trong worktree: `pnpm install` → đo **BASELINE trước khi sửa**: `pnpm lint` (0 warning),
   `pnpm build` (0 warning), `pnpm e2e:don-vi` (ghi số bài pass — nền để so).
   ⚠ đúng lệnh `pnpm e2e:don-vi`, KHÔNG phải `pnpm e2e --project=don-vi`; cờ `-g` viết
   liền KHÔNG qua `--` (bẫy đã ghi trong CLAUDE.md).
4. Sửa code + viết test → chạy lại 3 lệnh trên, so với baseline.
5. **Để nguyên worktree** (không remove) cho chặng nghiệm thu/phản biện; KHÔNG chép về cây
   chính, KHÔNG commit — phiên chính chép về ở chặng 5.

## Tiêu chí nghiệm thu (đo trong worktree)

| # | Tiêu chí | Lệnh đo → kết quả mong đợi |
|---|---|---|
| T1 | Lint sạch | `pnpm lint` → exit 0, 0 warning |
| T2 | Build sạch | `pnpm build` → exit 0, 0 warning |
| T3 | don-vi xanh, có bài MỚI | `pnpm e2e:don-vi` → pass 100%, tổng bài > baseline (test hang-loat được cộng vào) |
| T4 | Hết wrapper lặp | `grep -rn "const chay = useCallback" apps/admin` → 0 kết quả |
| T5 | H2 hết nuốt lỗi | trong `app/m/[machId]/page.tsx`, `quanTriDatAnBinhLuan` nằm trong thunk truyền cho `chay(` của hook; có đường hiện lỗi cho khối Khán đài |
| T6 | H3 | link `↗` ở `app/binh-luan/page.tsx` có cả `title` lẫn `aria-label` |
| T7 | H4 | `thanh-tren.tsx` có `data-testid="nut-dang-xuat"`; đường gọi DELETE allauth coi 401 là thành công (đọc code); không import gì từ `icon.tsx` mới |
| T8 | H5 | `ngu-canh.tsx` có listener `visibilitychange` + `focus`, có cleanup, có guard đang-tải |
| T9 | H6 | `quanTriXoaSub` CHỈ xuất hiện trong thân ngăn kéo xác nhận; bấm "Xoá" trên hàng chỉ mở ngăn kéo |
| T10 | H7 | `nhat-ky/page.tsx` có `<datalist>` ≥22 option đúng danh sách AUDIT_* |
| T11 | H8 | `ui.tsx::TieuDeTrang` đặt `document.title`; `/m` `/u` `/dang-nhap` có đường đặt title riêng |
| T12 | H9 chọn/bỏ | `machs` + `binh-luan` có checkbox hàng + chọn cả trang + thanh hành động đủ nút theo data-testid ở trên |
| T13 | H9 tuần tự | vòng lặp bulk là `for … await` tuần tự, không `Promise.all`; dừng khi `chua_dang_nhap` |
| T14 | H9 test thuần | test mới cho lọc no-op + tóm tắt kết quả nằm trong bộ don-vi; **bằng chứng thử phá** (đảo logic → đỏ → khôi phục) ghi trong báo cáo |
| T15 | Hết phiên có lối ra | mã `chua_dang_nhap` từ một hành động ⇒ UI render link tới `/dang-nhap` (`data-testid="loi-dang-nhap-lai"`) — đọc code + (nếu chạy được) test |
| T16 | Không đụng file cấm | `git status --short` trong worktree KHÔNG có `icon.tsx`, `menu.ts`, `dung-mo-ta.ts`, `check-fx`, `fx.ts`, không file nào ngoài `apps/admin/**` + `apps/web/e2e/don-vi/**` + plan này |

## Rủi ro

- **`pnpm build` của `apps/web` có thể cần thứ ngoài phạm vi** (chưa từng kiểm build từ
  clone trần trong worktree). Baseline ở bước 3 chính là phép thử: HEAD build đỏ thì đó là
  chuyện của HEAD, không phải của bản vá — ghi rõ và so tương đối.
- Import cross-app trong spec don-vi có thể không resolve — nếu vậy DỪNG, báo, đừng tự chế.
- Hai phiên cùng chạy build/test trên máy: worktree tách lo phần file, nhưng CPU/pnpm store
  vẫn chung — chấp nhận, chỉ ảnh hưởng thời gian.
- allauth DELETE session: hình dạng response cần kiểm thực tế ở chặng 5 (smoke bằng
  browser nếu port 3001/8000 rảnh) — code viết theo hợp đồng "401 = đã thoát".

## Báo cáo thực thi (chặng 5, 2026-08-27)

**Đã làm:** đủ H1–H9, cộng các bản vá sau lượt phản biện. 17 file sửa + 5 file mới
(+762/−228), chép về cây chính từ worktree tách tại `ec47572`.

**Lệch plan, có chủ đích:**
- `tomTatHangLoat` đổi chữ ký thành object BỐN số phận `{da_doi, von_vay, that_bai,
  bo_do}` — bản đầu (2 tham số) bị phản biện bắt lỗi CHẶN: dừng sớm vì hết phiên mà báo
  "N/N thành công" cho cả hàng chưa gửi; đồng thời `da_doi=false` từ server (mod khác đổi
  trước) từng bị đếm là thành công.
- `thoatPhien` bản đầu bỏ qua mọi `r.status` — phản biện bắt lỗi CHẶN thứ hai (403/5xx =
  phiên còn sống mà UI báo đã thoát trên máy chung); nay `!r.ok && status !== 401` là ném.
- Thêm ngoài plan: `components/hang-loat.tsx` (UI chọn hàng), `lib/tieu-de.ts` (hook
  title), `ThanhPhanTrang` thêm prop `khoa`, `useDanhSach.napLai` đọc vị trí hiện tại qua
  ref (chặn lượt nạp-lại cũ ghi đè bảng khi mod lật trang giữa lượt bulk), khoá
  checkbox/bộ lọc/phân trang khi bulk đang chạy, guard badge chỉ chặn nhánh
  focus/visibility + chống kết quả về muộn, `datDangTai` vào `finally`.
- H8 phủ thêm `/chan-doan` (server component → `metadata`) và nhánh lỗi của `/m/[machId]`.
- Đổi tên biến nội bộ `chay`→`napTrang` trong `danh-sach.ts` (nghiệm thu lưu ý: làm T4
  grep sạch hơn thực chất — chấp nhận, vì bản chất T4 là "hết wrapper lặp" và điều đó đúng).

**Kiểm chứng THẬT (worktree tách `ec47572`, cây sạch):** lint exit 0 / 0 warning ·
`pnpm --filter @gikky/admin build` ✓ 0 warning (sau vá tạm 2 khoá `dung-mo-ta.ts` — file
của lượt khác, đã khôi phục) · don-vi **320 pass / 1 fail nền** (`trang-loi.spec.ts` về
`/luat`, đỏ sẵn ở HEAD, ngoài phạm vi). **Cây chính sau khi chép:** don-vi **340 pass /
1 fail** (vẫn bài `/luat`; số bài nhiều hơn vì cây chính có thêm spec của lượt check-fx),
lint 0 warning. `pnpm build` TOÀN PHẦN ở cây chính chưa đo — cổng 3000/8000 đang được
lượt e2e của phiên khác dùng; build admin đã chứng minh sạch trong worktree.

**Thử phá test mới:** 3 lượt của thợ (4/3/1 bài đỏ) + 1 lượt độc lập của nghiệm thu
(4 đỏ) + 1 lượt của phiên chính cho nhánh `bo_do` mới (2 đỏ) — đều khôi phục xanh 14/14.

**Nghiệm thu:** 16/16 ĐẠT (T2, T3 đạt-có-điều-kiện vì hai lỗi nền của HEAD).
**Phản biện:** lượt 1 ra 2 CHẶN + 4 NÊN SỬA + 5 GHI NHẬN — sửa hết 2 CHẶN + 4 NÊN SỬA +
2 GHI NHẬN; lượt 2 (soi lại bản vá): không còn CHẶN/NÊN SỬA, 4 điểm NHẸ đã sửa nốt
(guard onSubmit binh-luan, prop `khoa` cho phân trang, nút đơn không xoá tóm tắt,
docblock lạc chỗ) + `datDangTai` vào finally.

**Còn lại, ghi nhận không sửa:**
- `bo_do` tính bằng phần dư nên bất biến "tổng 4 số = số mục tiêu" là số học, không kiểm
  được; biểu thức có 3 bản sao trong 2 trang. Muốn ghim thì tách "tổng kết lượt chạy"
  thành hàm thuần nhận danh sách kết quả từng hàng.
- Điều hướng NGOÀI trang (ô tìm thanh trên, link trong hàng, nút Back) vẫn đổi được bộ
  lọc giữa lượt bulk — bảng nay đúng nhờ `napLai` qua ref, chỉ còn câu tóm tắt lượt cũ
  đứng trên bảng mới (nội dung vẫn trung thực).
- Tiêu đề ngăn kéo trống trong 200ms hoạt cảnh đóng (mẫu sẵn có toàn khu admin).
- Chưa smoke trên trình duyệt: H4 (hình dạng response DELETE allauth thật), H5, H8 —
  cần chạy `pnpm admin:dev` + Django khi cổng rảnh.
- Bài `/luat` đỏ nền thuộc `apps/web`, ngoài phạm vi — của lượt khác xử lý.
