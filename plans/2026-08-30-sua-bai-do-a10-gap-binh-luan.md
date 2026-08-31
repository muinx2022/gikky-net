# Sửa bài đo A10 "nội dung vẫn nằm trong HTML khi gập" — nó đo nhầm CÁI NÚT, không đo nội dung

Chốt 2026-08-30. Lượt này LẬT chẩn đoán của `P-20260830-8` trong `LOI-VA-NO.md`.

## 1. Chẩn đoán — vì sao sổ ghi sai

Sổ ghi: *"gập bình luận GỠ nội dung khỏi HTML ⇒ hợp đồng 'bot vẫn đọc được' (PLAN mục 1)
đang vỡ ngay tại HEAD"*. Khảo sát lượt này cho thấy **hợp đồng KHÔNG vỡ**:

- `apps/web/components/gap-nhanh.tsx:77` giữ nguyên children trong DOM khi gập —
  `<div className={css.than} hidden={gap}>` — `hidden` chỉ ẩn hiển thị, `textContent`
  vẫn chứa đủ.
- Thứ hỏng là **phép đo của A10** (`apps/web/e2e/vo-reddit.spec.ts:522-536`): nó chụp
  `thread.innerText().slice(0, 40).split("\n")[0]` làm "chữ mồi" — mà dòng đầu innerText
  của thread là **`[−]`**, ký tự trên chính cái nút gập. Bấm gập xong nút đổi thành `[+]`,
  nên `toContain("[−]")` đỏ **bất kể nội dung còn hay mất**.
- **Bằng chứng đo, không phải suy**: dựng đúng cấu trúc DOM + CSS của `GapNhanh`
  (grid `18px 1fr`, `.cot` chứa nút đứng trước `.than`) trong Chromium của Playwright:
  `innerText` trả `"[−]\nu/binhan · …\n\n<thân bài>"` — dòng đầu là `[−]`; sau khi mô
  phỏng gập, `textContent` vẫn chứa trọn thân bài nhưng không còn `[−]`.

Hệ quả: mức NẶNG của `P-20260830-8` hạ xuống — không có lỗi sản phẩm, chỉ có bài đo báo
động giả. Nhưng bài đo này đang canh một hợp đồng thật của PLAN mục 1, nên phải **sửa cho
nó đo đúng nội dung**, không được xoá.

## 2. Phạm vi

- **Sửa đúng MỘT file**: `apps/web/e2e/vo-reddit.spec.ts`, bài
  `"nội dung vẫn nằm trong HTML khi gập (bot vẫn đọc được — PLAN mục 1)"`.
- **Không đụng component nào** (`gap-nhanh.tsx` chỉ được sửa TẠM trong bước thử phá rồi
  khôi phục — diff cuối với HEAD phải rỗng).
- **Cấm đụng** 4 file CSS đang bẩn của phiên khác (`form-tai-khoan.module.css`,
  `ket-qua-tim-kiem.module.css`, `the-mach.module.css`, `trang-mach.module.css`) và
  `LOI-VA-NO.md` (phiên chính ghi ở chặng 5).

## 3. Phép đo mới

Tinh thần: chữ mồi phải là **thân bài thật**, và phải **không trùng** với dòng tóm tắt
hiện ra khi gập (tóm tắt = `u/<username> · N nhánh`, và với bia mộ là
`[bình luận đã xoá] · N nhánh` — nên KHÔNG lấy dòng tác giả, KHÔNG lấy bia mộ).

```ts
test("nội dung vẫn nằm trong HTML khi gập (bot vẫn đọc được — PLAN mục 1)", async ({
  page,
}) => {
  const { seq, nk } = await nganKeoDongNhat(1);
  // Gốc BÌNH THƯỜNG: bia mộ không có thân bài để đo, và chữ của nó trùng dòng tóm tắt.
  const muc_tieu = nk.threads.find((t) => t.trang_thai === "binh_thuong");
  expect(muc_tieu, "seed không có thread gốc bình thường?").toBeDefined();

  await page.goto(`${duongDan(hpg)}?khan_dai=1&sort=hay_nhat`);
  await page.getByTestId(`nut-ngan-keo-${seq}`).click();
  const thread = page
    .getByTestId(`lat-cat-${seq}`)
    .locator(`> [data-binh-luan-id="${muc_tieu!.id}"]`);
  const than = thread.getByTestId("than-nhanh").first();
  // Câu đầu của THÂN BÀI (thẻ `p` đầu tiên), không phải dòng đầu innerText của cả
  // thread — dòng đó là ký tự `[−]` trên nút gập, thứ đổi thành `[+]` sau khi bấm và
  // làm bản cũ của bài này đỏ oan (P-20260830-8, chẩn đoán đã lật).
  const chu = (await than.locator("p").first().innerText()).trim();
  expect(chu.length, "chữ mồi rỗng thì phép đo dưới pass rỗng").toBeGreaterThanOrEqual(10);
  expect(chu, "chữ mồi trùng dòng tóm tắt thì phép đo dưới pass rỗng").not.toContain("nhánh");

  await thread.getByTestId("nut-gap-nhanh").first().click();
  await expect(than).toBeHidden();                       // mắt không còn thấy
  expect(await thread.innerText()).not.toContain(chu);   // gập THẬT, không phải no-op
  expect(await thread.textContent()).toContain(chu);     // nhưng bot vẫn đọc được
});
```

(Đây là phác thảo — người thực thi được chỉnh chi tiết cú pháp/locator cho khớp helper
sẵn có, miễn giữ đủ: chọn gốc `binh_thuong` · chữ mồi từ `p` của `than-nhanh` · 2 rào
chống pass rỗng · bộ ba `toBeHidden` / `innerText not.toContain` / `textContent toContain`.)

## 4. Môi trường chạy — BẮT BUỘC đọc trước khi gõ lệnh

- **`pnpm e2e` GHI vào DB.** `gikky_dev` chứa dữ liệu THẬT ⇒ cấm chạy trần. Trỏ
  `gikky_e2e` bằng env var trong CÙNG phiên lệnh (django-environ không đè env có sẵn):
  ```powershell
  $env:DATABASE_URL = (Select-String -Path api\.env -Pattern '^DATABASE_URL=(.*)$').Matches[0].Groups[1].Value -replace '/gikky_dev$', '/gikky_e2e'
  pnpm e2e
  ```
- Trước khi chạy: **cổng 3000 và 8000 phải trống** (`reuseExistingServer` sẽ vớ server
  cũ với build cũ/DB sai). Cổng bận ⇒ DỪNG và báo, đừng kill tiến trình không phải của mình.
- Lọc bài: `pnpm e2e -g "trong HTML khi"` — **KHÔNG chèn `--`** trước cờ (nó nuốt cờ lọc,
  bộ chạy đủ mà vẫn báo passed — bẫy đã ghi trong CLAUDE.md).
- Một bộ e2e tại một thời điểm — không chạy song song với bất kỳ build/test nào khác
  dùng 2 cổng đó.

## 5. Tiêu chí nghiệm thu — ĐO ĐƯỢC

| # | Tiêu chí | Cách đo |
|---|---|---|
| 1 | Tái hiện nền: A10 ĐỎ tại HEAD, đỏ ở phép `toContain` | `pnpm e2e -g "trong HTML khi"` (DATABASE_URL=gikky_e2e) TRƯỚC khi sửa |
| 2 | Sau vá: A10 XANH | cùng lệnh, sau khi sửa spec |
| 3 | THỬ PHÁ (luật 4): sửa tạm `gap-nhanh.tsx` cho GỠ children thật khi gập ⇒ A10 phải ĐỎ ở đúng phép `textContent toContain` ⇒ khôi phục, `git diff HEAD -- apps/web/components/gap-nhanh.tsx` rỗng | chạy lại lệnh ở #2 với bản phá |
| 4 | Bộ ĐẦY ĐỦ sau vá: project `web` 0 đỏ; project `don-vi` còn đúng 1 đỏ ĐÃ BIẾT (`trang-loi.spec.ts` #14 — P-20260830-1, ngoài phạm vi lượt này) | `pnpm e2e` (DATABASE_URL=gikky_e2e) |
| 5 | Diff cuối: đúng 1 file đổi so với HEAD là `apps/web/e2e/vo-reddit.spec.ts`; 4 file CSS bẩn + sổ giữ nguyên trạng của phiên khác | `git diff HEAD --stat` |

Nền cho #4: theo sổ 2026-08-30, bộ đầy đủ có 2 bài đỏ (A10 + trang-loi #14). Nếu số nền
đo được KHÁC thế ⇒ DỪNG, báo lại, đừng suy diễn tiếp.

## 6. Còn lại cho chặng 5 (phiên chính)

- Cập nhật `P-20260830-8` trong sổ: chẩn đoán lật, mức hạ, trạng thái mới.
- Báo cáo; KHÔNG commit (user chưa bảo).

## 7. Cập nhật SAU phản biện (2026-08-30, chặng 5) — hai chỗ mục 1 và 5 ở trên SAI

1. **Câu "`toContain('[−]')` đỏ bất kể nội dung còn hay mất" (mục 1) SAI.** Nó chỉ đỏ khi
   thread mục tiêu **không có reply**: mọi reply render `GapNhanh` riêng và nút `[−]` của
   chúng (đang ẩn) vẫn nằm trong `textContent`, cứu phép so. Bài đo cũ trúng thread 0-reply
   vì `.first()` vớ phải **rác** các lượt e2e trước bỏ lại trong `gikky_e2e` (mốc 9: seed 3
   thread, DB 8 — xem `P-20260830-13`). Trên DB sạch, bài đo cũ XANH — tức tiêu chí #1
   ("tái hiện nền") chỉ tái hiện được trên đúng DB bẩn hiện tại.
2. **Nền của tiêu chí #4 (2 bài đỏ) đã lạc hậu.** Tại HEAD nền thật là 3 đỏ: thêm
   `giao-dien.spec.ts` T8 hỏng sẵn do Search v2 đổi `role` ô tìm kiếm (`P-20260830-12`).
3. **Bài đo được siết thêm sau phản biện** (phiên chính tự sửa ở chặng 5): chọn thread có
   reply đọc được và đo CẢ nhánh con (vế "mọi nhánh con" của hợp đồng); chữ mồi khoanh vào
   `> [data-chu-nguoi-dung]` của đúng gốc/reply (không vớ `p` của cây con hay dòng "tiếp
   tục thread"); lấy dòng DÀI NHẤT (dòng đầu ngắn kiểu "OK." sẽ đỏ oan rào độ dài); rào
   "không trùng tóm tắt" so với dòng tóm tắt THẬT đọc từ DOM thay vì chuỗi cứng "nhánh".
   Kiểm chứng lại từ đầu: A10 xanh (1 passed) · thử phá gỡ-children ĐỎ đúng phép
   `textContent` ("gập GỠ thân gốc khỏi HTML") · khôi phục diff rỗng · bộ đầy đủ
   565 passed / 2 failed (đúng 2 bài ngoài phạm vi: `trang-loi #14` + `T8`) · lint 0/0.
