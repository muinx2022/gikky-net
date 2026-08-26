# Sổ tay: những gì cần thêm vào gikky.net — chốt sau buổi bàn 2026-08-25

> **Đây KHÔNG phải plan thực thi.** Không hạng mục nào dưới đây đã được duyệt để code.
> Nó là bản ghi những chỗ hụt tìm ra trong một buổi bàn dài, kèm lý do — để lần sau
> không phải nghĩ lại từ đầu. Hạng mục nào bắt tay làm thì tách plan con riêng và chạy
> đủ 5 chặng theo `D:\Projects\CLAUDE.md`.
>
> Mỗi mục ghi rõ **đã có gì rồi** — vì hoá ra phần lớn đã xây một nửa, và biết nửa nào
> đã có thì việc nhỏ đi rất nhiều.

---

## A. Đang chặn đường — không làm thì mọi thứ khác vô nghĩa

### A1. Không ai đăng ký được tài khoản

`EMAIL_URL` **trống** trên prod (`~/gikky-net/app/.env`), mà `ACCOUNT_EMAIL_VERIFICATION
= "mandatory"` khai **cứng** trong `config/settings.py` — không đọc từ env. Mail xác thực
rơi vào một file trong container, không ai nhận.

- **Google OAuth** mở được cửa đăng ký (tài khoản social có email đã xác thực sẵn).
  User đang giao admin làm. Redirect URI của bản headless:
  `https://gikky.net/api/_allauth/browser/v1/auth/provider/callback`.
  ⚠ Phải **restart container `api`** — `settings.py:82` chỉ nạp provider vào
  `INSTALLED_APPS` khi `GOOGLE_CLIENT_ID` khác rỗng, và việc đó xảy ra lúc khởi động.
- **Nhưng Google KHÔNG mở cửa quên mật khẩu.** Ai đăng ký bằng mật khẩu rồi quên thì
  vẫn kẹt. Muốn mời người từ f247 sang thì SMTP vẫn phải làm.

### A2. Site trắng

1 sub (`tin-tuc`), 2 mạch (cả hai do `bot-news` đăng), 4 tài khoản. Không có
`chung-khoan`, không có `crypto`. Không có mạch nào của người thật.

---

## B. Rẻ, giá trị cao — làm được ngay

### B1. Nút báo cáo cấp MẠCH, đặt ngay dưới tiêu đề

**Đã có:** `Report.Dich` trong `core/models/he_thong.py` có sẵn **`MACH`** (cùng `MOC`,
`COMMENT`); `api/bao_cao.py::_nap_dich` xử lý `MACH` đầy đủ.
**Thiếu:** đúng phần UI. Hiện chỉ có `hanh-dong-moc.tsx` và `hanh-dong-binh-luan.tsx`,
**cả hai đều nằm trong menu `⋯`**.

**Vì sao đáng làm nhất trong danh sách:** ma sát đang bị đảo ngược.

| Hành vi | Chi phí |
|---|---|
| Vote lên | 1 cú bấm, cột to, cạnh nội dung |
| Báo cáo | Tìm menu `⋯` của một mốc cụ thể → mở → chọn lý do |

Nhóm có tín hiệu quý nhất — **người đi ngang, không theo dõi, không cầm hàng** — lại
chịu ma sát cao nhất: họ ở đầu trang, nút thì nằm trong menu con của mốc thứ bảy. Họ
không tìm, họ đóng tab.

Tiêu đề cũng là **bề mặt vươn xa nhất** (feed · Google · link dán đi), nên đặt nút phản
hồi cạnh nó là đúng chỗ.

**Ràng buộc thiết kế:** dễ **tìm**, đừng dễ **xong**. Giữ bước chọn 1 trong 4 lý do.
Nút bấm-phát-xong chỉ là vote xuống có thêm thủ tục, và nó đổ rác không phân loại vào
hàng đợi mod — tài nguyên khan hiếm nhất của cả hệ thống.

**Lợi ích phụ:** báo cáo cấp mạch là đơn vị đúng cho ca "mốc 4–10 đều thúc giục" (xem
D3) — cái sai nằm ở xu hướng qua nhiều mốc, không nằm ở mốc nào.

### B2. Gom báo cáo thành HỒ SƠ, không phải dòng hàng đợi rời rạc

7 báo cáo vào 7 mốc của cùng một mạch phải đến tay mod như **một ca có hình dạng** —
kèm dòng thời gian, kèm chỗ mạch đổi tính — chứ không phải 7 dòng lẻ. Mốc thứ 4 đứng
một mình có thể trông vô hại; chỉ nhìn cả chuỗi mới thấy.

Đây đúng phân vai đã chốt: **code không phán xử, code chỉ thu hẹp hàng đợi.**

### B3. Đánh dấu người báo cáo CÓ theo dõi mạch hay không

Server biết sẵn qua bảng `Follow`. Tín hiệu nên là:

> *"12 người báo cáo, trong đó **11 người KHÔNG theo dõi mạch này**."*

Đây là con số duy nhất bàn tới trong buổi này mà **không tỷ lệ với quy mô khán giả**
(xem D2). Một mốc thúc giục thì gần như toàn bộ báo cáo đến từ người ngoài, còn người
trong đang vote lên — chính **độ lệch giữa hai nhóm** mới là báo động.

⚠ **Giới hạn, đã tự rút lại trong buổi bàn:** "không theo dõi" phân biệt được *khán giả
đã bị thu phục* với *người ngoài*, nhưng **không** phân biệt được người ngoài thiện chí
với **một nhóm được huy động đi dập**. Cả hai đều là non-follower.

---

## C. Cần plan riêng — đụng model, migration, hoặc bảo mật

### C1. `ModSub` vẫn chưa cấp quyền gì — nhưng bản đồ quyền đã đổi

*(Sửa 2026-08-25 sau khi user chỉ ra. Bản đầu của mục này dẫn docstring `ModSub` và kết
luận "chỉ superuser xử được" — câu đó **đã cũ**: `api/api/mod.py` là file mới của phiên
song song, chưa track, và nó dựng hẳn một bề mặt kiểm duyệt trên API v1 công khai.)*

**Bản đồ quyền thật, đo ngày 2026-08-25:**

| Hành động | Ở đâu | Đòi gì |
|---|---|---|
| Ẩn/gỡ ẩn **mạch · mốc · bình luận**, khoá/mở khoá **mạch** | **API v1 công khai** — `api/api/mod.py`, auth `chi_mod` (`ChiModTrenV1`) | `is_staff` |
| **Ban / gỡ ban người dùng** | **Khu quản trị** — `quan_tri_ban_nguoi_dung`, `quan_tri_go_ban_nguoi_dung` | `is_staff` + host `admin.gikky.net` |

⇒ **Ban user ĐÃ CÓ**, không phải chưa làm. Nó chỉ chưa có mặt trên bề mặt v1.

**Lỗ thật vẫn nguyên:** `ChiModTrenV1.authenticate` kiểm đúng một dòng —
`if not user.is_staff` — và **không hỏi `ModSub` câu nào**. Ở cả hai bề mặt, "mod" vẫn
đồng nghĩa với `is_staff`. Bảng mod chuyên mục vẫn là cái nhãn, đúng như docstring của
model tự cảnh báo.

Buổi bàn chốt rằng phân biệt "thúc giục" với "nêu ý kiến" **phải do người làm, không code
hoá được**. Nhưng "người" đó vẫn chỉ có thể là superuser. Nối `ModSub` vào quyền là bước
tiếp theo thật sự — thay đổi bảo mật, plan riêng
(`plans/2026-08-24-mod-chuyen-muc.md` §0).

**Câu hỏi mở, đừng vội coi là lỗ:** bốn hành động trên v1 đều là thao tác **nội dung** và
**đảo ngược được**; ban là thao tác **tài khoản**. Ranh giới đó có thể là chủ đích — PLAN
8.2 chặn `/api/admin/*` ngay tại Caddy trên host công khai, nên đưa ban lên v1 là cố ý
đục thủng đúng hàng rào ấy. Giá phải trả của việc giữ nguyên: mod vừa ẩn một bài spam
xong phải đổi sang `admin.gikky.net` mới ban được, mà đổi ngữ cảnh nghĩa là nhiều người
sẽ không làm. **Đây là lựa chọn của user, cần ghi ra là lựa chọn — không phải khoảng
trống ai đó quên lấp.**

### C2. Lý do báo cáo thứ 5

Hiện đúng 4: `phim_hang · lua_dao · spam · khac`.

Môi giới mời **mở tài khoản** (không phím mã) không dính cái nào: không hô mua bán,
không hứa lãi, tài khoản chứng khoán không phải uỷ thác, website công ty đại chúng
không phải nhóm kín. Gọi VPS/SSI/VND là `lua_dao` thì vừa sai vừa dễ ăn kiện.

⇒ Mọi báo cáo loại này rơi vào `khac` và biến mất. Cần một lý do riêng (vd `moi_chao`).

### C3. Ngưỡng tự động thu gọn — **đã sửa lại đáng kể so với ý ban đầu**

Ý gốc: vote ≤ −10 thì tự dời xuống cuối, dạng disable, bấm vẫn ra.

**Giữ:** cơ chế (tự động · không xoá · có nấc · đảo ngược được). Mod không scale, vote thì có.

**Đổi:** nguồn tín hiệu. Ba lý do:

1. **Phím hàng được vote LÊN, không phải xuống.** Giữa phòng toàn người cầm HPG, *"múc
   mạnh vào"* ăn +30. Ngưỡng âm bắt nội dung *không được ưa*; phím hàng giữa đám đông
   hưng phấn là nội dung *được ưa nhất phòng*.
   Nói gọn: **luật gikky nói về hình thức, vote đo cảm tình** — không bắt được vi phạm
   hình thức bằng dụng cụ đo cảm tình.
2. **Nó bắt nhầm thiểu số.** Cái bị −10 sẽ là *"cẩn thận tồn kho quý tới"* nói giữa mười
   người đang cầm hàng. Ngưỡng âm là **cỗ máy cưỡng chế đồng thuận** — đi ngược đúng thứ
   user nói forum cũ làm tốt hơn gikky (nhiều phản biện).
3. **−10 = mười nick phụ chôn được bất cứ thứ gì.** Hiện **không có trọng số vote theo
   tài khoản** nào trong repo (đã kiểm).

**Kết luận:** hai cơ chế cho hai loại — **ngưỡng vote cho RÁC** (spam, chửi, lạc đề —
loại bị vote xuống bởi mọi người bất kể đang cầm gì, tức tín hiệu khớp mục tiêu), và
**ngưỡng báo cáo cho VI PHẠM LUẬT**.

> Vote trả lời *"tôi có thích không"*. Báo cáo trả lời *"cái này có phạm luật X không"*.
> Phím hàng được vote lên **và** bị báo cáo — đếm báo cáo bắt được, đếm vote thì không.
> Báo cáo còn **có tên**, nên báo cáo bậy trừng phạt được; vote xuống thì ẩn danh và
> miễn phí vĩnh viễn.

**Đã có sẵn một nửa:** `core/xep_hang.py` sort bằng `wilson_lower_bound(up, down)` +
hệ số tươi — tính theo *tỷ lệ* kèm khoảng tin cậy, nên nội dung bị vote xuống nhiều đã
tự tụt đáy ở **mọi quy mô**, không cần con số thần kỳ.

### C4. Sàn theo LẶP LẠI cho bình luận

Nếu bài bị canh gắt còn bình luận thả lỏng, người muốn lùa sẽ **chuyển sang bình luận
và rải**: cùng một câu, đăng vào ba mươi mạch. Từng câu là "một lời trong đám đông";
ba mươi câu là **phát sóng lắp ghép từ nhiều mảnh nhỏ**.

Luật bình luận cần một cái sàn theo **lặp lại**, không theo nội dung: cùng người, cùng
kiểu câu, nhiều mạch trong thời gian ngắn ⇒ xử như bài. Mod không phải đọc từng câu,
chỉ cần đếm.

### C5. Loại tài khoản TỔ CHỨC, có nhãn

Để môi giới muốn có mặt thì mở tài khoản tổ chức, hiện huy hiệu, đăng ở chỗ dành riêng.
Công khai thì được; giả làm người dùng thường thì không.

**User chốt 2026-08-25: làm sau, chưa cần bây giờ.**

---

## D. Cấu trúc — món to, ảnh hưởng cả sản phẩm

### D1. Trang theo MÃ CHỨNG KHOÁN — món thiếu quan trọng nhất

**Chưa có thực thể mã chứng khoán nào trong codebase.**

Bài toán: f247 có **11.547 người online** dồn vào vài chục chủ đề — hàng trăm người mỗi
phòng. Mega-thread không chỉ là lỗi kiến trúc, nó là **cỗ máy dồn mật độ**, và đó là lý
do vào đó thấy "đông".

Cấu trúc mạch cố ý **phân tán** (N nhật ký thay vì 1 phòng) — tốt cho việc chống buồng
vọng âm, nhưng cái giá là **pha loãng**:

| | Người online | Số phòng | Mỗi phòng |
|---|---|---|---|
| f247 | 11.547 | ~vài chục | hàng trăm |
| gikky cùng quy mô, 200 mạch | 11.547 | 200 | ~57 |

`PLAN.md` nguyên tắc 9 đã biết luật này — *"24 bình luận chia 9 phòng = 9 phòng vắng;
mật độ là oxy của tán gẫu"* — nhưng nó dừng ở ranh giới **một mạch**. Chia 11 nghìn
người ra 200 mạch là đúng phép chia đó ở tầng cao hơn, và PLAN chưa cấm.

**Trang mã là chỗ hoà giải:** gom mốc + bình luận từ **mọi mạch** có nhắc mã đó về một
chỗ ⇒ có một cửa như mega-thread, nhưng thứ thấy được không phải dòng chảy 35 nghìn câu
mà là *12 người, mỗi người một vị thế, có giá vào, có ngày tháng, có nhật ký đọc lại
được*. Và **không ai sở hữu cái phòng đó**, nên không thành buồng vọng âm của một người.

Lấy **mật độ** của forum cũ mà không lấy **cấu trúc một tầng** của nó.

### D2. Tìm kiếm chưa index bình luận

Phase 7 chỉ index mạch (tiêu đề + mốc 1). PLAN 8.7 ghi rõ "index bình luận" còn nợ.

**Nội dung cũ không tìm được thì bằng không có giá trị** — đúng cái bệnh của forum cũ mà
gikky sinh ra để chữa. Theo đánh giá trong buổi bàn, đây là món nợ đắt nhất đang treo.

### D3. Chưa có thiết kế cho MẠCH KHỔNG LỒ

Spine chạy tốt với 9–40 mốc. "Nhật lệnh eM&aNh" của Mr.NaK trên f247 chạy 19 tháng,
9.679 trả lời — thành mạch thì cỡ vài trăm mốc. `①──②──…──◉300` trong một dòng là vô
dụng, bung dải gập ra là bức tường 298 mốc. **Chưa có khái niệm chương/giai đoạn.**

Lỗ này sẽ lộ ra đúng lúc có người dùng giỏi nhất.

### D4. Ống kính "phản biện" cho khán đài

Sort "Hay nhất" xếp theo vote ⇒ trong đám đông cùng cầm một mã, **câu dễ chịu nhất nổi
lên**. Nhưng trong tranh luận, cái đáng đọc nhất là **phản biện sắc nhất**.

Không đổi cách sort — PLAN nguyên tắc 7 cấm tự đổi sort ngầm dưới tay người dùng, và cấm
đúng. Mà **thêm một ống kính**: cách xem nổi những bình luận không cùng phía với bài.
Người đọc tự bấm.

---

## E. Chỉ là chữ, nhưng là chữ của user (PLAN mục 11)

### E1. Điều cấm thứ 5 — mời chào mở tài khoản / mã giới thiệu

`/luat` hiện có đúng 4 điều (`apps/web/lib/phap-ly.ts`), và **không điều nào chạm tới**
môi giới mời mở tài khoản. Tức hôm nay việc đó **hợp lệ**, và mod nào gỡ là đang xử
ngoài luật thành văn.

Ba vế đề xuất, đều cưỡng chế được:

| | |
|---|---|
| **Cấm mã/link giới thiệu** trong mốc và bình luận | Nhắc tên môi giới: được. Kèm mã ref: không. Đây là dòng kẻ duy nhất vừa rõ vừa cưỡng chế được. |
| **Có quan hệ thương mại thì phải khai trong bài** | Biến chuyện khó chứng minh (động cơ) thành chuyện dễ chứng minh (có khai hay không). Không khai mà lộ = gỡ; tái phạm = ban. |
| **Tài khoản tổ chức phải có nhãn** | Xem C5. |

**Không** cấm nhắc tên môi giới. *"Tôi đặt lệnh qua VPS, phí 0,15%"* là thông tin thật và
hữu ích trong nhật ký; cấm nó chỉ làm nhật ký kém trung thực.

**Vì sao đáng gắt:** hoa hồng môi giới trả theo **phí giao dịch** người được giới thiệu
sinh ra. Động cơ của người giới thiệu không phải "đúng nhiều" mà là "có nhiều người theo
và giao dịch nhiều" — trong khi cả gikky dựng lên để nói rằng nghĩ kỹ trước khi bấm thì
hơn bấm nhiều. **Hai động cơ ngược nhau trực tiếp, và cái ngược đó vô hình với người đọc.**

⚠ Mặt pháp lý (quảng cáo dịch vụ chứng khoán là hoạt động có điều kiện ở VN) cần luật sư,
không đoán.

### E2. Nguyên tắc BÀI vs BÌNH LUẬN — bất đối xứng theo bán kính

Chốt trong buổi bàn:

| Tầng | Vươn tới ai | Mức xử |
|---|---|---|
| **Mốc 1 / bài** | Feed công khai + URL + **Google**. Người lạ. | Gắt nhất. Tiêu đề dạng thúc giục ⇒ ban thẳng. |
| **Mốc 2…n** | Feed "đang diễn ra" + **notification cho follower**. Khán giả tự chọn. | Ở giữa — nó *chủ động gọi* hàng trăm người. |
| **Bình luận** | Chỉ người đang đọc mạch đó. | Nhẹ nhất — cảm xúc thật, một lời trong đám đông. |

Hai lý do nguyên tắc này đúng hơn vẻ ngoài của nó: nó **bám vào bất đối xứng đã có sẵn
trong kiến trúc**, và **bài thì ít, bình luận thì nhiều** — nên "gắt với bài" là phiên
bản duy nhất mod thực sự vận hành được.

**Tiêu đề là bề mặt sắc nhất**, không phải cả bài: nó là phần duy nhất chạm tới người
**không mở bài**. Và với site mới, nó thành bộ mặt của gikky trên Google khi ai đó tìm
"HPG" — xoá bài không xoá được index.

**Ranh giới dễ nhận:** có **thúc giục** không. *"không múc thì múc giá nào"*, *"của trời
cho"*, *"vào nhanh còn kịp"* — ngôn ngữ bán hàng, không phải ngôn ngữ nêu ý kiến.
Tách khỏi ca người mới viết vụng (*"em thấy HPG 22 rẻ đấy các bác"*): ẩn bài kèm giải
thích thì giữ được người, ban thì mất — và mất đúng lúc site cần từng người một.

### E3. Nguyên tắc: đồng thuận được, nhưng phải CÓ TÊN và CÓ VỊ THẾ

Điều 1 **đã** cho phép: *"được nói mình đang cầm gì và vì sao"*.

| | |
|---|---|
| ❌ "Múc, múc cật lực, giá này quá đẹp" | Mệnh lệnh trần. Không biết ai nói, cầm gì, lợi gì nếu mình nghe. |
| ✅ "Tôi cầm từ 21.8, giá này tôi thấy quá đẹp, tôi đang gom thêm" | Cùng độ hào hứng, không giảm chút nào. Nhưng cân được. |

Với mod, gọn thành một câu: **không cấm hô, cấm hô mà giấu mặt.**

### E4. Từ vựng đang phân vai lệch

`PLAN.md` mục 2: **Mạch · Mốc · Chủ mạch · Spine** — bốn từ, đều của người **tạo**. Chủ
mạch còn có badge trên mọi reply.

90% người dùng — nhóm chỉ thích trả lời, không tạo — được gọi là **"khán đài"**. Khán đài
là chỗ ngồi xem; người trên khán đài vỗ tay, không chơi.

Không phải chủ ý, chỉ là hệ quả của việc thiết kế xoay quanh khác biệt lõi. Nhưng từ vựng
đi vào code, vào UI, vào cách mọi người nói về sản phẩm — rồi rất khó đổi.

**Người đang xây site này tự nhận chỉ thích trả lời.** Đó không phải chi tiết tiểu sử, đó
là một **yêu cầu thiết kế**, và nó chưa có mặt trong PLAN.

### E5. "Được trích ×N" đang bị chôn

PLAN 5.6 mở đầu: *"**Cơ chế thưởng chủ lực cho người bình luận**: được ghi tên vào cuốn
sổ không-xoá-được."* Tương đương "câu trả lời được chấp nhận" của StackOverflow — cơ chế
làm SO thành nơi lớn nhất cho đúng nhóm người chỉ thích trả lời.

**Rào 2 là món quà lớn nhất mà không ai để ý:** blockquote bắt buộc hiện *"viết 10/06,
trích 21/08"*. Nghĩa là người **chỉ bình luận** cũng nhận được đúng thứ mà cả sản phẩm
dựng lên để trao cho tác giả mạch — **bằng chứng nói-trước-khi-biết-kết-quả** — mà không
phải tạo gì cả.

Nhưng hiện nó chỉ là một chỉ số trên hồ sơ. **Không có feed nào tôn vinh bình luận hay,
không có đường nào tìm ra người bình luận giỏi.** Với một cơ chế tự nhận là *chủ lực* thì
thế là quá mỏng.

---

## F. Đã BÁC trong buổi bàn — đừng đề xuất lại

| Ý | Vì sao bác |
|---|---|
| **Đếm số người cùng cầm một mã / bảng đồng thuận** | Chính là *"47 người đặt Chốt hết"* mà PLAN mục 4 gọi là **cấm tuyệt đối**. Docstring `core/models/tuong_tac.py` ghi rõ bộ reaction cũ 📈📉🔥🧊🎯 bị thay vì lý do này: *"bảng đếm hướng giá công khai dưới một vị thế tiền thật đang mở"*. |
| **Chép bài/mạch từ f247 sang gikky** | Bản quyền của từng thành viên; và nặng hơn: dựng lại mốc hôm nay là **chế ra bằng chứng tiên đoán**, giả đúng cái thứ sản phẩm dùng để bán mình. Ghi công không chữa được dấu thời gian nói dối. |
| **Bot đăng khuyến nghị mua bán / mốc dự kiến / điểm dừng lỗ** | PLAN mục 4. Và đó là mô hình `f319.net` bỏ paywall — cái làm chỗ đó thành lùa gà không phải paywall mà là phát khuyến nghị hàng loạt rồi để thống kê sống sót lo phần còn lại. |
| **Ngưỡng vote âm dùng cho phím hàng** | Xem C3. Phím hàng được vote **lên**. |

---

## G. Đang treo, chờ user

- **Cắm 3 scheduled task** cho bot bản tin (06:12 · 08:07 · 19:33 giờ VN, T2–T6).
  Code + prompt đã xong, chưa đăng ký.
- **Loạt bài VN30 tiếp theo.** Đề xuất: không làm 30 bài đều nhau (nhiều mã không có
  câu chuyện nào, cố nặn ra là quay lại bảng số). Thay bằng: bài có chuyện riêng · bài
  theo dòng (ngân hàng: 13 mã, 38,1% vốn hoá rổ, P/E 8,5, hai mã dưới sổ sách) · bài
  ngoài VN30 (cá tra — VHC/ANV/IDI, thuế Mỹ).
- **Mời 5 người viết nhật ký từ f247** — Mr.NaK, alexpham263, vanhoangthanh,
  The_Collector, boo. Nếu 90% chỉ muốn trả lời thì **không cần nhiều người tạo, cần rất
  ít nhưng đúng người**. Chặn ở A1: họ chưa đăng ký được.
