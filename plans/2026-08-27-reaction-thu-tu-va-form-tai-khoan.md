# Reaction đảo thứ tự · form tài khoản: màu tín hiệu, bề ngang, câu chữ username

Chốt 2026-08-27. Bốn việc user giao trong một lượt, hai khu tách biệt.

> 1. *"chi tiết post, chuyển action Hay lắm thành action đầu tiên trong chuỗi action"*
> 2. *"các phần đăng nhập, đăng ký, nếu lỗi, dùng font chữ đỏ, nếu ok, dùng font chữ màu xanh"*
> 3. *"các form ở phần đăng nhập, đăng ký, hiện tại đều co cụm ở giữa"*
> 4. *"ở form đăng ký, có 1 chỗ rất dễ gây hiểu nhầm: Tên hiển thị công khai, nhập tên có dấu
>    cách thì không được, nhưng cũng không dùng tên đó để đăng nhập được, vẫn phải dùng email,
>    chỗ này là chỗ gây conflict"*

---

## A · `hay_lam` lên đầu hàng reaction

**Hiện trạng:** `🧠 · 📎 · ❓ · ⚠️ · 🔥` — `hay_lam` đứng cuối (đặt ở lượt 2026-08-27 sáng,
lý lẽ ghi trong `lib/reaction.ts`: *"hàng nút kết ở một nốt khích lệ"*). User đảo lại.

**Thứ tự là HỢP ĐỒNG**, không phải chuyện CSS: `ban-sao-python.spec.ts` ghim
`CAC_REACTION` khớp **đủ và đúng thứ tự** với `Reaction.Emoji` của Django. Nên đảo chỗ ở
frontend mà không đảo ở Django là ĐỎ — và đó là chủ đích của hàng rào ấy.

⇒ Đổi cả hai đầu + **migration `0022`** (Django coi thứ tự `choices` là một phần state).

**Tiêu chí nghiệm thu:**

- A1. `Reaction.Emoji` liệt kê `HAY_LAM` đầu tiên; `CAC_REACTION` cũng vậy.
- A2. `makemigrations --check` sạch sau khi thêm `0022` (không còn thay đổi chưa sinh).
- A3. `0022` **thuần metadata** — đọc file, không có `RunPython`, không `AlterField` nào
  ngoài `choices`.
- A4. `pnpm e2e:don-vi -g reaction` xanh.
- A5. Trên trang thật: nút đầu tiên trong hàng là `🔥 Hay lắm`; server vẫn trả đủ 5 khoá.
- A6. Docstring cũ nói *"`hay_lam` đứng CUỐI có chủ đích"* phải được viết lại — để nguyên
  là để lại một lời giải thích cho một sự thật đã hết đúng.

---

## B · Lỗi = chữ ĐỎ, thành công = chữ XANH (5 trang tài khoản)

**Đây là chỗ đụng luật, phải ghi ra chứ không lặng lẽ làm.** `form-tai-khoan.module.css`
mở đầu bằng đúng một câu cấm:

> ⚠ **Không đỏ, không hoàng thổ ở đây.** PLAN 9.1 cấm `--loss` ngoài con số lãi/lỗ […]
> Lỗi và thành công vì thế phát tín hiệu bằng ĐƯỜNG VIỀN và NỀN […] không bằng màu cảnh báo.

Và luật ấy **có hàng rào chạy được**: `mau-token.spec.ts` chỉ cho `var(--gain)`/`var(--loss)`
xuất hiện ở đúng `components/con-so.module.css`.

**Hai lối, chọn lối thứ hai:**

1. *Thêm token mới* `--loi`/`--ok` với mã hex khác. Giữ nguyên hàng rào, nhưng bảng màu
   mọc thành 10 màu và site có **hai sắc đỏ lệch nhau vài độ** — thứ trông như lỗi chứ
   không như thiết kế.
2. **Dùng lại `--loss`/`--gain`, nới allowlist của hàng rào thêm đúng một file.** Chính
   docstring của hàng rào chỉ ra đây là cách nới đã dự liệu: *"muốn thêm chỗ dùng thì phải
   sửa cả file này — và đó là mục đích: quyết định có chủ đích, không phải một dòng CSS
   lọt vào lúc nửa đêm."*

**Lý lẽ để nới, và nó phải đứng vững chứ không phải cái cớ:** điều PLAN 9.1 sợ là xanh/đỏ
mất nghĩa "tiền" vì bị dùng trang trí. Năm trang tài khoản **không có một con số lãi/lỗ
nào** — không feed, không thẻ mốc, không `con-so`. Va chạm ngữ nghĩa mà luật ấy phòng
không thể xảy ra ở nơi không có tiền để hiểu nhầm.

⚠ **Vẫn phải báo user một câu**: sau lượt này, xanh/đỏ trên gikky không còn *chỉ* nghĩa
tiền. Đó là đánh đổi user đã chọn, không phải hệ quả bị bỏ quên.

**Tiêu chí nghiệm thu:**

- B1. `.loi`, `.loi_o` dùng `var(--loss)`; `.xong` dùng `var(--gain)`.
- B2. `NOI_DUOC_DUNG` thành DANH SÁCH, thêm đúng `form-tai-khoan.module.css` — không dùng
  pattern, không nới thành thư mục.
- B3. `mau-token.spec.ts` xanh, và **thử phá**: thêm `var(--loss)` vào một file thứ ba
  ⇒ phải ĐỎ ⇒ khôi phục.
- B4. **Tương phản đo bằng số**: thêm cặp `--loss`/`--gain` trên `--surface` và trên
  `--inset` (nền của `.loi`/`.xong`) vào `tuong-phan.spec.ts`, cả hai theme, ngưỡng 4.5.
  Trượt cặp nào thì sửa, không hạ ngưỡng.
- B5. Câu cấm ở đầu `form-tai-khoan.module.css` phải viết lại — để nguyên là để lại một
  luật đã bị chính file đó vi phạm.
- B6. Màu **không phải tín hiệu duy nhất**: `.loi` giữ `role="alert"`, `.xong` giữ
  `role="status"`, và giữ viền/nền. Người nhìn màu kém vẫn phải phân biệt được.

---

## C · Form thôi co cụm

`.the { max-width: 420px }` trong một cột đã có `max-width` riêng của `KhungHaiCot` ⇒ một
thẻ hẹp lọt thỏm giữa cột rộng. Nới bề ngang và nới thở bên trong.

- C1. `max-width` tăng lên **560px**; padding trong tăng tương ứng.
- C2. Ở 1280px: bề ngang thẻ đo được ≥ 520px.
- C3. Ở 375px: **0px cuộn ngang** (thẻ vẫn `width: 100%`).

---

## D · Gỡ mâu thuẫn username ↔ email

**User nói đúng, và câu chữ hiện tại SAI về mặt sự thật.** Bằng chứng:

- `api/config/settings.py:285` — `ACCOUNT_LOGIN_METHODS = {"email", "username"}`
- `apps/web/lib/dang-nhap.ts::taoThongTinDangNhap` — không có `@` thì gửi khoá `username`
- Ô đăng nhập đã ghi nhãn *"Email hoặc tên đăng nhập"*

⇒ **Đăng nhập bằng username LÀ ĐƯỢC.** Nhưng form đăng ký lại ghi:

> *"Tên bạn chọn ở đây là địa chỉ hồ sơ công khai — /u/tên-của-bạn. **Đăng nhập thì dùng email.**"*

Câu in đậm là một khẳng định sai, và nó chính là chỗ user thấy "conflict": trường bị gọi
là *"Tên hiển thị công khai"* (nghe như chỉ để trưng bày) nhưng lại bắt luật slug (không
dấu, không khoảng trắng), rồi copy còn bảo nó vô dụng lúc đăng nhập.

**Tiêu chí nghiệm thu:**

- D1. Bỏ hẳn câu *"Đăng nhập thì dùng email."*; câu thay thế nói đúng: dùng email **hoặc**
  tên này đều đăng nhập được.
- D2. Nhãn trường đổi khỏi *"Tên hiển thị công khai"* — nhãn mới phải nói cả hai vai (địa
  chỉ hồ sơ + tên đăng nhập).
- D3. Luật ký tự (không dấu, không khoảng trắng) vẫn hiện **trước** khi người dùng gõ, chứ
  không đợi server từ chối. (`goiY` hiện có đã làm việc này — không được làm mất.)
- D4. Không đụng backend: đây là lượt CÂU CHỮ. Nếu phát hiện backend thật sự không cho
  username đăng nhập thì DỪNG và báo user — lúc đó nhãn ô đăng nhập mới là chỗ sai.

---

## Ngoài phạm vi — không làm trong lượt này

- Bộ `pnpm e2e` đầy đủ vẫn không chạy được (chiếm cổng 3000+8000, seed ghi đè `gikky_dev`
  có bài thật). Mọi bài thuộc bộ ấy chỉ qua `tsc` + `eslint`.
- `/luat` + `force-dynamic` (`trang-loi.spec.ts#14`) — mâu thuẫn thiết kế đã báo user, chờ
  quyết.

---

# Báo cáo thực thi — 2026-08-27

**Tự làm, tự đo. KHÔNG có lượt nghiệm thu/phản biện độc lập** (phiên này bị cấm giao
subagent). Người đọc cần biết con số dưới đây do chính người làm đo.

| Tiêu chí | Kết quả |
|---|---|
| A1 `HAY_LAM` đầu ở cả hai đầu | ĐẠT |
| A2 `makemigrations --check` | ĐẠT — "No changes detected" |
| A3 `0022` thuần metadata | ĐẠT — chỉ `AlterField(choices=…)`, không `RunPython` |
| A4 hàng rào reaction | ĐẠT — 2/2 xanh |
| A5 trên trang thật | ĐẠT — nút đầu `🔥 Hay lắm`; server trả `["hay_lam","ro_rang","co_nguon","can_them","lieu"]` |
| A6 docstring cũ viết lại | ĐẠT — cả `tuong_tac.py` lẫn `lib/reaction.ts` |
| B1 `.loi`/`.loi_o` đỏ, `.xong` xanh | ĐẠT — đo màu tính được: `rgb(228,119,106)` = `--loss`, `rgb(67,190,131)` = `--gain` |
| B2 allowlist thành danh sách | ĐẠT — 2 tên tường minh, không pattern |
| B3 **thử phá** | ĐẠT — thêm `var(--loss)` vào `toast.module.css` ⇒ ĐỎ với `+ "components/toast.module.css"` ⇒ khôi phục |
| B4 tương phản 8 cặp mới | ĐẠT — thấp nhất 5.01:1 (`--gain` trên `--inset`, sáng), ngưỡng 4.5 |
| B5 câu cấm viết lại | ĐẠT |
| B6 màu không phải tín hiệu duy nhất | ĐẠT — đo được `.loi` viền `solid`, `.xong` viền `dashed`; `role` giữ nguyên |
| C1 `max-width` 560px | ĐẠT |
| C2 ≥520px ở 1280px | ĐẠT — đo được **560px** |
| C3 375px không cuộn ngang | ĐẠT — thẻ 345px, `cuonNgang = 0` |
| D1 bỏ câu sai | ĐẠT |
| D2 nhãn nói cả hai vai | ĐẠT — "Tên đăng nhập, cũng là địa chỉ hồ sơ" |
| D3 luật ký tự vẫn hiện trước | ĐẠT |
| D4 không đụng backend | ĐẠT |

**Bộ kiểm:** `pytest -k "reaction or moc"` 198 passed · `e2e:don-vi` 352 passed / 1 failed
(`/luat`, nợ đã báo) · `codegen:check` khớp · `lint` 0 warning · `tsc` sạch cả hai app.

## CÒN NỢ

1. **`pnpm e2e` đầy đủ vẫn KHÔNG chạy** — chiếm cổng 3000+8000, seed ghi đè `gikky_dev`
   (bài thật của user).
2. **Đường LỖI của form chưa được kích hoạt thật.** Màu đỏ/xanh xác nhận bằng cách đọc
   `getComputedStyle` trên phần tử dựng rời từ đúng lớp CSS đã băm — KHÔNG bằng cách gửi
   form sai. Lý do: gửi form đăng ký là tạo tài khoản, việc tôi không được phép làm. Ai
   chạy `pnpm e2e` sau này nên xác nhận lại bằng một lượt đăng nhập sai thật.
3. **`pytest` đầy đủ chưa chạy lại sau lượt này** — mới chạy nhóm `reaction or moc`
   (198 passed). Lượt trước đó, trên cây gần giống, là 1504 passed / 0 failed.
