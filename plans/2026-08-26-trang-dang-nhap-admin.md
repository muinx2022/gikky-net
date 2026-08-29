# Trang đăng nhập khu quản trị: bỏ một lần click · nút con mắt · ghi nhớ đăng nhập

Chốt 2026-08-26. Ba việc user giao, đều ở `apps/admin`:

1. *"sao không chuyển về page login luôn mà lại phải mất thêm 1 lần click nữa?"*
2. *"có thể show mật khẩu, nút hình con mắt ở ô nhập pass"*
3. *"thêm tùy chọn ghi nhớ đăng nhập"*

User chốt phạm vi: **"làm cho phần admin"**. Site công khai đã có `ModalDangNhap` cho các
đường ghi, nên nó không có bệnh (1) — xem §5.

Ô "ghi nhớ" **mặc định TÍCH SẴN** (user chốt): hôm nay phiên luôn sống 2 tuần kể cả khi
đóng trình duyệt, nên tích sẵn = không ai bị đăng xuất bất ngờ sau khi deploy. Ô tích là
**lối thoát cho người cần an toàn**, không phải rào cản cho người bình thường.

---

## 0 · Phát hiện quyết định thiết kế của việc 3

**`allauth.headless` KHÔNG có một dòng nào đụng tới hạn phiên.** Đã kiểm:

```
grep -rn "set_expiry|SESSION_REMEMBER|session_remember" allauth/headless/   ⇒ RỖNG
```

`ACCOUNT_SESSION_REMEMBER` chỉ được đọc ở `allauth/account/forms.py` — luồng **có giao
diện HTML**, thứ gikky cố ý không mount (`HEADLESS_ONLY = True`).

⇒ **`ACCOUNT_SESSION_REMEMBER` là cấu hình CHẾT trong gikky.** Đặt nó vào `settings.py`
không có tác dụng gì, và **không có gì báo**. Đây là cái bẫy đắt nhất của việc 3: nó là
setting đầu tiên ai cũng với tay lấy, tên nó đúng y nhu cầu, và nó im lặng không làm gì.
Phải tự cài, và phải ghi lý do ra để người sau không "dọn dẹp" bằng cách thay bản tự cài
bằng setting kia.

Hệ quả thứ hai: hôm nay `settings.py` **không khai `SESSION_*` nào** ⇒ chạy mặc định
Django (`SESSION_COOKIE_AGE = 2 tuần`, `SESSION_EXPIRE_AT_BROWSER_CLOSE = False`). Tức
"ghi nhớ" đang **luôn bật cho mọi người**; việc cần làm là cho người dùng *tắt* nó.

## 1 · Việc 1 — bỏ một lần click

`apps/admin/components/cong-quan-tri.tsx`, nhánh `MA_CHUA_DANG_NHAP`:
thay thẻ "Chưa đăng nhập / Tới trang đăng nhập" bằng `router.replace("/dang-nhap?tiep=…")`.

**Chỉ nhánh 401.** Ba nhánh còn lại (`khong_du_quyen`, `sai_host`, lỗi mạng) **giữ nguyên
màn hình riêng** — docstring của file ấy đã nói vì sao, và lý do còn nguyên giá trị: gộp
chúng lại là người *đã* đăng nhập nhìn thấy form đăng nhập lần nữa mà không hiểu vì sao.

**`replace`, không `push`.** `push` để lại cổng 401 trong lịch sử, nên bấm Back sau khi
đăng nhập là quay về đúng cái cổng ấy rồi bị đẩy đi tiếp — một vòng lặp người dùng không
thoát được bằng Back.

### 1.1 · `?tiep=` — quay lại đúng chỗ đang đứng

Không có nó thì "bỏ một lần click" đổi lấy "về nhầm trang": đang ở `/machs` mà bị đẩy ra,
đăng nhập xong lại đứng ở `/`. Trang đăng nhập hôm nay ghi cứng
`window.location.href = "/"` (`app/dang-nhap/page.tsx`), cần đọc `?tiep=`.

⚠ **`tiep` là dữ liệu do người ngoài đặt được** — nó nằm trên URL. Nhận thẳng là một
**open redirect**: gửi cho mod một link `/(admin)/dang-nhap?tiep=https://kẻ-gian/...`,
họ đăng nhập xong thì bị bắn sang trang kia, và trang kia dựng lại giao diện gikky để xin
mật khẩu lần nữa. Phải lọc:

- bắt buộc bắt đầu bằng **một** `/`;
- **từ chối** `//` và `/\` (trình duyệt hiểu là protocol-relative ⇒ ra ngoài site);
- từ chối mọi chuỗi có `:` trước dấu `/` đầu tiên;
- không hợp lệ ⇒ về `/`, **không** báo lỗi (người dùng không làm gì sai).

Viết thành **một hàm thuần** `duongDanQuayLai(tiep: string | null): string` ở
`apps/admin/lib/` để bài đo `e2e:don-vi` gọi thẳng được — đây là phần **duy nhất** của
lượt này kiểm tự động được (xem §4).

## 2 · Việc 2 — nút con mắt

`apps/admin/app/dang-nhap/page.tsx`. **Icon đã có sẵn**: `hien` (mắt) và `an` (mắt gạch)
trong `components/icon.tsx` — không vẽ mới, không thêm tên vào `TenIcon`.

Bắt buộc:

- `type="button"` — thiếu nó thì nút nằm trong `<form>` sẽ **submit form**, tức bấm xem
  mật khẩu là gửi luôn lần đăng nhập. Đây là lỗi kinh điển và nó im lặng.
- `aria-label` đổi theo trạng thái ("Hiện mật khẩu" / "Ẩn mật khẩu") + `aria-pressed`.
- Không đổi `autoComplete="current-password"` của ô nhập.
- Nút nằm **trong** ô nhập (position tuyệt đối), không đẩy layout khi đổi icon.

## 3 · Việc 3 — ghi nhớ đăng nhập

### 3.1 · Đường truyền tín hiệu: HEADER, không phải body

Body của `POST /api/_allauth/browser/v1/auth/login` do `LoginInput` của allauth định
nghĩa, và nó **loại mọi khoá lạ** trước khi handler thấy. Thêm `remember` vào body là gửi
một thứ chắc chắn bị vứt — im lặng.

⇒ Client gửi header **`X-Ghi-Nho: 1|0`**. Backend đọc trong một receiver của signal
`user_logged_in`:

```python
@receiver(user_logged_in)
def dat_han_phien(sender, request, user, **kwargs):
    ...
```

**Vì sao signal chứ không middleware:** `django.contrib.auth.login` gọi `cycle_key()` rồi
mới bắn `user_logged_in`, nên tới lúc receiver chạy thì khoá phiên đã xoay xong và
`set_expiry` bám đúng phiên mới. Middleware chạy trước/sau cả request, không có chỗ nào
đứng đúng giữa hai việc đó.

### 3.2 · Mặc định khi KHÔNG có header — giữ nguyên hành vi cũ

Header vắng ⇒ **phiên bền** (`SESSION_COOKIE_AGE`), đúng như hôm nay.

Đây là quyết định có chủ đích, không phải lười: **site công khai cũng đăng nhập qua đúng
endpoint allauth ấy**. Mặc định "hết khi đóng trình duyệt" sẽ đăng xuất toàn bộ người dùng
site công khai mỗi lần họ đóng trình duyệt — một thay đổi hành vi diện rộng mà **không ai
yêu cầu**, và nó nằm ngoài phạm vi user chốt ("làm cho phần admin").

### 3.3 · Ô tích

`app/dang-nhap/page.tsx`, mặc định `true`. Nhãn nói ra hệ quả thật, không nói "ghi nhớ
tôi" chung chung — người bỏ tích cần biết mình đổi lấy cái gì. Đại ý:
*"Ghi nhớ đăng nhập — bỏ tích thì đóng trình duyệt là hết phiên."*

### 3.4 · KHÔNG làm

- **Không** đặt `ACCOUNT_SESSION_REMEMBER` — xem §0, nó không chạy. Nếu ai đó thêm vào
  sau này, nó vẫn không chạy, và nó sẽ làm người đọc tưởng đó là cơ chế đang dùng.
- **Không** đổi `SESSION_COOKIE_AGE`. 2 tuần là mặc định Django và user không yêu cầu đổi.
- **Không** đụng luồng đăng nhập Google (nó không đi qua endpoint `login`; header vắng ⇒
  phiên bền ⇒ đúng hành vi cũ).

## 4 · Tiêu chí nghiệm thu (ĐO ĐƯỢC)

Nền **đo lại tại `ec47572`** (cây nhảy thêm một commit giữa lúc viết plan và lúc thực thi;
commit ấy gộp cả lượt "khu quản trị viên" của phiên này):

| Lệnh | Nền tại `ec47572` |
|---|---|
| `pnpm test` | **1495 passed / 16 skipped / 0 warning** |
| `pnpm e2e:don-vi` | **1 failed / 340 passed** (`trang-loi.spec.ts` #14 — có sẵn) |
| `tsc --noEmit` (admin) | **0 lỗi** — phiên kia đã vá `dung-mo-ta.ts` |
| `lint` · `codegen:check` | exit 0 · khớp |

*(Con số 1487 ở bản plan đầu là của `9edc374`, giữ lại để không ai tưởng có bài đo biến mất.)*

| # | Tiêu chí | Đo bằng |
|---|---|---|
| N1 | `pnpm test` xanh, 0 warning, ≥ 1487 + bài mới | tự chạy |
| N2 | `pnpm lint` `--max-warnings=0` | exit 0 |
| N3 | `pnpm e2e:don-vi` — **không đỏ thêm bài nào** so với nền | nền đang đỏ **đúng 1** bài (`trang-loi.spec.ts` #14, có sẵn từ `516e973`) |
| N4 | `tsc --noEmit` ở `apps/admin` — **không đỏ thêm** | nền đang đỏ **đúng 1** lỗi (`dung-mo-ta.ts`, của phiên khác) |
| N5 | `codegen:check` khớp | exit 0 *(lượt này không đổi schema Ninja — nếu nó lệch thì có gì đó sai)* |
| N6 | Bài đo `duongDanQuayLai` phủ hết ca chống open-redirect | §4.1 |
| N7 | Bài đo hạn phiên đủ 3 nhánh, đều thử phá được | §4.2 |

⚠ **N3/N4 viết là "không đỏ thêm", không phải "exit 0"** — cố ý. Hai lỗi nền kia không
thuộc lượt này (một của phiên khác, một có từ `516e973`), và lượt trước đã phải chấm KHÔNG
ĐẠT ba tiêu chí chỉ vì plan viết `exit 0` tuyệt đối. Đếm số bài đỏ trước và sau.

### 4.1 · `e2e/don-vi/` — `duongDanQuayLai`

Hàm thuần, nên bộ `don-vi` gọi thẳng được. Bắt buộc có:

- `/machs` → `/machs` · `/m/12?x=1` → giữ nguyên query
- `null` / `""` → `/`
- **`//kẻ-gian.example`** → `/` *(protocol-relative — ca nguy hiểm nhất)*
- **`/\kẻ-gian.example`** → `/` *(backslash, trình duyệt hiểu như `//`)*
- `https://kẻ-gian.example` → `/` · `javascript:alert(1)` → `/`
- `http:/x` → `/` *(có `:` trước `/` đầu)*

### 4.2 · `api/tests/test_ghi_nho_dang_nhap.py` (mới)

- **G1** `X-Ghi-Nho: 1` ⇒ `session.get_expire_at_browser_close()` là **False**, và
  `get_expiry_age()` xấp xỉ `SESSION_COOKIE_AGE`
- **G2** `X-Ghi-Nho: 0` ⇒ `get_expire_at_browser_close()` là **True**
- **G3** **không** gửi header ⇒ **False** (giữ nguyên hành vi cũ) — bài này là thứ duy
  nhất canh cho site công khai không bị đổi hành vi
- **G4** đăng nhập sai mật khẩu kèm `X-Ghi-Nho: 0` ⇒ không có phiên nào được tạo
  *(chống một bản cài đặt hạn phiên TRƯỚC khi biết đăng nhập có thành công không)*
- **G5** giá trị rác (`X-Ghi-Nho: abc`) ⇒ rơi về mặc định **False**, không ném

⚠ **Chống bài đo rỗng:** G1 và G3 cho **cùng kết quả** (`False`), nên nếu receiver không
chạy gì cả thì cả hai vẫn xanh. G2 là bài duy nhất phân biệt được — nên **thử phá bắt
buộc phải bắt đầu từ G2**, và báo cáo phải nói rõ G2 đỏ khi gỡ receiver.

### 4.3 · Việc 1 và 2 KHÔNG có bài đo tự động — nói thẳng

`apps/admin` **không có bài đo trình duyệt nào**. Phần chuyển hướng và nút con mắt chỉ
kiểm được bằng tay. Phiên chính làm việc đó ở chặng 5 và **ghi rõ là kiểm tay**, không để
con số của G1..G5 che cho hai việc không ai đo.

## 5 · Ghi nhận về site công khai — CHƯA làm, chờ user

Front đã có `ModalDangNhap`, dùng ở `composer.tsx` (bình luận) và `form-dang-mach.tsx`
(đăng mạch) ⇒ các **action** chính đúng như user mô tả.

Nhưng còn **ba chỗ guard cả trang** vẫn `router.replace("/dang-nhap")`:
`components/danh-sach-sub-mod.tsx:38` · `components/form-cai-dat.tsx:45` ·
`components/form-ho-so.tsx:61`.

Chúng là *trang cần phiên*, không phải *action*, nên có thể vẫn đúng. Cần user chốt trước
khi đụng — và **không thuộc lượt này**.

## 6 · Ràng buộc tài nguyên

⚠ **Phiên Claude khác đang làm trên repo** (bot tin tức + bình luận HTML). Không đụng:
`api/config/settings.py`, `seed_dev.py`, `tao_sub.py` (**đang STAGED**), `package.json`,
`PLAN.md`, `scripts/tin-tuc/`, `deploy/prod/`, `api/api/binh_luan.py`, `api/api/machs.py`,
`api/api/schemas*.py`, `api/api/trinh_bay.py`, `api/core/models/binh_luan.py`,
`apps/web/components/*`.

⚠ Việc 3 **cần thêm một receiver** — đặt ở **file mới** `api/core/phien.py` chứ không nhét
vào `settings.py` (phiên kia đang sửa file đó) hay `core/ghi.py` (đã lẫn code hai lượt).
Đăng ký trong `AppConfig.ready()` của app `core`.

⚠ Ba dev server **đang chạy** (3000/3001/8000). `pnpm build` phá `.next/`; phiên chính lo
tắt/bật, subagent **không** build.

| Agent | Được chạy | Cấm |
|---|---|---|
| `nghiem-thu` | `pnpm test` · `build` · `lint` · `codegen:check` · `tsc` — một bộ một lúc | — |
| `phan-bien` | đọc code · `e2e:don-vi` · SQL chỉ đọc | `build` · `pnpm e2e` |

## 7 · Nhật ký thực hiện

Nghiệm thu chấm **7/7 ĐẠT**, tự chạy lại toàn bộ và tự làm thực nghiệm để chứng minh G2
phân biệt được (viết file test tạm, `disconnect` receiver, xác nhận nhánh "bật" trả
`False` ⇒ G2 sẽ đỏ). Phản biện **không tìm ra lỗi chặn phát hành**, nhưng tìm ra 6 điểm —
2 trong đó là hỏng im lặng thật. Phiên chính sửa cả 6 ở chặng 5.

### 7.1 · Hai lỗi hỏng im lặng — đã vá

**(a) `set_expiry(SESSION_COOKIE_AGE)` đóng băng hạn vào dữ liệu phiên.**
`SessionBase.set_expiry` ghi giá trị vào `_session_expiry`, và `get_expiry_age` trả lại
đúng số nguyên ấy. Hệ quả: ops rút `SESSION_COOKIE_AGE` từ 14 ngày xuống 1 ngày sau một sự
cố bảo mật, restart — **mọi phiên tạo trước lúc rút vẫn sống 14 ngày**, không log, không
cảnh báo. `set_expiry(None)` **xoá** khoá ("the session uses the global session expiry
policy") nên vẫn ghi đè được `_session_expiry = 0` còn sót — đúng mục đích ban đầu — mà
không đóng băng gì. Bài đo mới: `test_ghi_nho_KHONG_dong_bang_han_vao_du_lieu_phien`.

**(b) Tín hiệu bị vứt khi lượt đăng nhập vướng một *login stage*.** `resume_login` thoát
TRƯỚC `adapter.login()` khi còn stage chưa xong, nên **request mang header không phải
request bắn `user_logged_in`**. Vá bằng `AdapterTaiKhoan.pre_login` → cất vào
`request.session`; receiver đọc `META` trước, bản đã cất sau, rồi `pop`.

⚠ **Nhưng ca cụ thể phản biện dựng thì KHÔNG xảy ra hôm nay, và điều đó phải nói ra.**
`EmailVerificationStage.is_resumable()` trả `EMAIL_VERIFICATION_BY_CODE_ENABLED`; gikky xác
thực bằng **link**, không bằng mã ⇒ stage **không resume được**. Đã chạy thử: bấm link làm
`verified=True` nhưng response là `401 {flows:[login, signup]}` — người dùng phải đăng nhập
lại từ form, và lượt ấy MANG header. Bản vá vì thế là **bảo hiểm cho stage resume được**
(`LoginByCodeStage`, `PhoneVerificationStage`, `allauth.mfa.stages.AuthenticateStage`), chứ
không phải sửa một lỗi đang nổ. Ngày bật 2FA cho mod thì **mọi** lượt đăng nhập hoàn tất ở
`/auth/2fa/authenticate` và ô tích im lặng ngừng tác dụng cho 100% mod.

Bài đo vì thế đo **cơ chế**, không giả vờ đo một ca chưa tồn tại: một bài chứng minh tín
hiệu được CẤT trên đúng request mang header (qua HTTP thật, stage chặn thật), một bài
chứng minh receiver ĐỌC bản đã cất khi request không có header.

### 7.2 · Bốn điểm còn lại — đã vá

- **`duongDanQuayLai` nhận cả `/dang-nhap`** ⇒ gõ đúng mật khẩu xong bị đưa lại form
  trống, gõ lại thì ăn 409 *"Bạn đang đăng nhập rồi."* Hai câu mâu thuẫn trong mười giây.
  Có hai cửa vào: soạn link tay, và một cuộc đua hẹp trong `CongQuanTri`. Đã chặn cả hai,
  kèm bài đo chống `startsWith("/dang-nhap")` trần nuốt nhầm `/dang-nhap-lai`.
- **Ô mật khẩu chuyển sang `type="text"` thiếu `autoCapitalize/autoCorrect/spellCheck`.**
  iOS Safari mặc định `autocapitalize="sentences"` cho `type="text"` ⇒ bấm con mắt trước
  khi gõ thì `matkhau123` thành `Matkhau123` và màn hình báo sai mật khẩu cho một mật khẩu
  **đúng**. `spellCheck={false}` còn chặn mật khẩu đang hiện rõ bị gửi đi kiểm chính tả.
- **Hằng tên header không có chuông** — hai bản sao nối nhau bằng docstring. Đổi phía TS
  thành `"X-GhiNho"` thì test/lint/build/tsc đều xanh và ô tích im lặng chết. Đã thêm vào
  `ban-sao-python.spec.ts` (khuôn có sẵn của repo cho đúng loài này), đọc cả hai phía bằng
  regex fail-closed và tự dựng lại phép đổi tên `X-Ghi-Nho → HTTP_X_GHI_NHO`.
- **Chú thích ở G1 mô tả một hành vi không tồn tại** ("có vài mili giây thật") — và cái sai
  ấy dạy đúng hiểu nhầm dẫn tới lỗi (a). Đã viết lại.

### 7.3 · Thử phá — 6 lượt, tất cả ĐỎ đúng bài

| Phá | Bài đỏ |
|---|---|
| quay lại `set_expiry(<số>)` | `test_ghi_nho_KHONG_dong_bang_han_vao_du_lieu_phien` |
| gỡ `stash_ghi_nho` khỏi `pre_login` | `test_tin_hieu_ghi_nho_duoc_CAT_khi_luot_dang_nhap_vuong_stage` |
| receiver không đọc bản đã cất | `test_receiver_doc_ban_da_cat_khi_request_khong_co_header` |
| gỡ phép từ chối `/dang-nhap` | `?tiep=/dang-nhap` không đưa người dùng trở lại form |
| chặn bằng `startsWith("/dang-nhap")` trần | KHÔNG chặn nhầm đường trùng tiền tố |
| đổi tên header phía TS | tên header khớp nhau giữa admin và `core/phien.py` |

⚠ **Lượt phá thứ ba lúc đầu KHÔNG đỏ, và đó là lỗi của phép đo chứ không phải của bài đo.**
Script vá dùng mẫu có `\n` trong khi file là **CRLF** ⇒ không khớp, không thay gì, test
xanh — trông y hệt một bài đo rỗng. Bắt được nhờ kiểm lại `includes()` trả `false`. Ghi ra
vì đây là cách một lượt thử phá tự nói dối trên Windows.

### 7.4 · Số đo cuối

`pnpm test` **1503 passed / 16 skipped / 0 warning** · `lint` exit 0 · `tsc` (admin) **0
lỗi** · `codegen:check` khớp · `e2e:don-vi` **352 passed**, vẫn đúng **1** bài đỏ có sẵn
(`trang-loi.spec.ts` #14).

**Kiểm TAY phần không có bài đo tự động** (plan §4.3), đo trên hệ thống đang chạy:

- mở `/machs?trang=2` khi chưa đăng nhập ⇒ tự sang `/dang-nhap?tiep=%2Fmachs%3Ftrang%3D2`,
  giữ nguyên query, không cần bấm gì;
- nút con mắt: `type="button"`, `password ⇄ text`, `aria-label`/`aria-pressed` đảo theo;
- ô ghi nhớ mặc định tích sẵn; bỏ tích ⇒ gửi `X-Ghi-Nho: 0`, tích ⇒ `1` (bắt bằng cách bọc
  `fetch`, dùng mật khẩu cố ý sai để không phải nhập mật khẩu thật vào form);
- **header sống sót qua proxy tới Django** — `curl` qua cổng 3001 bằng một tài khoản
  dùng-một-lần (đã xoá sau đó):

  | Header | `Set-Cookie: sessionid` |
  |---|---|
  | `X-Ghi-Nho: 0` | `HttpOnly; Path=/; SameSite=Lax` — **không `expires`, không `Max-Age`** |
  | `X-Ghi-Nho: 1` | `expires=…; Max-Age=1209600` |

### 7.5 · Một bài đỏ KHÔNG thuộc lượt này

`tests/test_api_theo_sub.py::test_me_subs_moi_theo_dung_truoc` — đỏ khi chạy cả file, xanh
khi chạy một mình ⇒ phụ thuộc thứ tự. **Đã chứng minh không phải do lượt này**: khôi phục
`allauth_adapter.py` và `apps.py` về `ec47572` rồi chạy lại, nó vẫn đỏ. File test và
`api/api/theo_doi.py` đều sạch trong git. Nguyên nhân nhiều khả năng là độ phân giải đồng
hồ: hai lượt theo dõi liên tiếp rơi vào cùng một mốc `created_at` ⇒ `-created_at` không xác
định thứ tự. Không sửa — ngoài phạm vi, và thuộc tính năng của phiên khác.

### 7.6 · Còn treo

- **`pnpm build` chưa ai chạy** cho lượt này: cổng 3000/3001/8000 bị dev server của phiên
  khác chiếm, build sẽ phá `.next/` của họ. `tsc --noEmit` + `lint` phủ phần lớn nhưng
  không phủ khâu bundling.
- §5 (ba chỗ guard cả trang ở site công khai vẫn `router.replace("/dang-nhap")`) — chờ user.
