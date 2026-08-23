# PLAN — gikky.net

> **Bản chốt v2, 2026-08-21.** Master plan của dự án, viết để một agent MỚI — không có ngữ cảnh
> gì ngoài file này — thực thi được từ đầu. Nội dung đã qua HAI vòng phản biện đối kháng
> (3 agent phản biện thiết kế sản phẩm + 2 agent phản biện bản plan: một "đọc lạnh" kiểm tính
> tự đứng, một kỹ thuật; 41 vấn đề tìm được đã vá vào bản này). **Đừng tự thiết kế lại** những
> gì đã chốt, đặc biệt mục 4 (những thứ đã bị loại — kèm lý do).
>
> **Cách dùng:** quy trình làm việc chung nằm ở `D:\Projects\CLAUDE.md` (5 chặng, bắt buộc).
> Mỗi phase ở mục 10 khi bắt tay làm thì tách thành plan con `plans/YYYY-MM-DD-<ten>.md`
> với tiêu chí nghiệm thu ĐO ĐƯỢC, rồi chạy đủ 5 chặng. Phase 0 tạo `CLAUDE.md` riêng của repo
> (chỉ chứa phần RIÊNG: lệnh build/test/dev — không chép lại quy trình chung).
> Chỗ nào plan ghi "chốt trong plan con" thì plan con PHẢI nêu giá trị cụ thể trước khi code.

---

## 1. Sản phẩm

**gikky.net** là diễn đàn trading tiếng Việt kiểu Reddit, với một khác biệt lõi duy nhất:
**bài viết không phải khối văn bản chết — nó là "mạch": một nhật ký mà tác giả nối thêm mốc
theo thời gian thực.** Ca dùng điển hình: nhật ký lệnh — mốc 1 vào lệnh → nâng dừng lỗ →
chốt 1/3 → ... → tổng kết, kéo dài nhiều tuần/tháng, cộng đồng bàn luận suốt dọc đường.

**Vì sao đáng làm:**
- Trên Reddit/Facebook, người viết nhật ký giao dịch phải chế bằng tay: sửa bài thêm `EDIT:`,
  đăng bài `UPDATE` mới rồi link ngược, ghim comment của chính mình. Nhu cầu lớn tới mức tồn tại
  r/BestofRedditorUpdates (hàng triệu thành viên) chỉ để *khâu tay các bài UPDATE rời rạc*.
- Giá trị lõi của nhật ký giao dịch là **ghi-trước-khi-biết-kết-quả**. Nền tảng nào chứng minh
  được điều đó (dấu thời gian máy chủ bất biến, append-only) sẽ có thứ Facebook không bao giờ có:
  sự đáng tin.
- Mạch đã đóng là **tư liệu lưu trữ được Google index** — mỗi mạch tử tế là một trang đón
  traffic vĩnh viễn. Group Facebook không có mặt này.

**Phạm vi v1:** web mobile-first, tiếng Việt, một server. Chưa có app native.
**Sub khởi điểm** (tạo tay qua admin): `chung-khoan` (chứng khoán VN), `crypto`.
Cơ chế mạch là generic — sau này mở sub thể loại khác (trekking, cây cảnh, xây nhà) không cần
sửa lõi, nhưng **v1 chỉ nói chuyện trading**: copy, câu mồi, ví dụ seed đều là trading.

**Múi giờ chuẩn của sản phẩm: Asia/Ho_Chi_Minh.** Mọi chỗ nói "ngày", "hôm nay" trong plan
đều theo múi giờ này (server lưu UTC + USE_TZ như chuẩn Django, quy đổi khi tính "ngày").

---

## 2. Từ vựng bắt buộc

Dùng thống nhất trong code, UI, tài liệu. Model đặt tên không dấu theo đúng bảng này —
**đừng dịch sang tiếng Anh** (domain là tiếng Việt; `Comment`, `Vote`, `Follow` generic thì giữ
tiếng Anh).

| Thuật ngữ | Nghĩa | Trong code |
|---|---|---|
| **Mạch** | Một bài viết dạng nhật ký nối dài. Mọi post sinh ra là post thường; khi tác giả nối mốc thứ 2 nó *tự trở thành* mạch — không có nút "tạo mạch" riêng | model `Mach` |
| **Mốc** | Một entry do tác giả ghi vào mạch, đánh số `seq` 1..n. Bài gốc chính là mốc seq=1, không có ngoại lệ | model `Moc` |
| **Chủ mạch** | Tác giả — badge hiện trên mọi reply của họ (như badge OP của Reddit) | `mach.author` |
| **Khán đài** | Khu bình luận: MỘT phòng duy nhất chứa toàn bộ cây bình luận của mạch | UI |
| **Ngăn kéo** | Cửa sổ lật ra ngay dưới thẻ mốc, chiếu lát cắt bình luận neo vào mốc đó | UI |
| **Spine** | Dải xương sống `①──②──...──◉⑨` tóm tắt mạch trong 1 dòng, ghim đầu trang | UI |
| **Trích vào sổ** | Chủ mạch trích 1 bình luận vào mốc mới, người bình luận được ghi công vĩnh viễn | model `Trich` |
| **Mặt BÃO / mặt CẶN** | Hai bố cục của cùng trang mạch: BÃO = đang sôi, khán đài là thân bài; CẶN = lưu trữ, nhật ký là thân bài | mục 5.5 |
| **Hai dấu thời gian** | `occurred_at` (người dùng đặt, nhập lùi được — ngày *sự việc xảy ra*) tách khỏi `created_at` (server đóng dấu, bất biến — bằng chứng *ghi lúc nào*) | mọi Moc |
| **Vạch mới** | Đường kẻ "Mới kể từ lần bạn đọc" trong timeline cho người theo dõi quay lại | `Follow.last_seen_entry_seq` |

---

## 3. Mười nguyên tắc đã chốt (kèm lý do — để không bị "tối ưu" nhầm)

1. **Post thường là mặc định.** Không bắt ai quyết định "đây là journal" lúc viết bài đầu —
   lúc đó chưa ai biết bài có hậu hay không. Mốc thứ 2 xuất hiện thì UI mạch tự bật.
2. **Mốc append-only.** Sửa im lặng trong 15 phút đầu; sau đó mọi sửa đổi hiện dấu "đã sửa"
   + lưu bản cũ xem được (đầy đủ MỌI trường sửa được — xem 5.2). Xoá = bia mộ "mốc đã xoá"
   giữ chỗ, không biến mất. Với nhật ký giao dịch, tính bất biến **là** sản phẩm.
3. **Hai dấu thời gian, chỉ một cái sửa được.** `occurred_at` cho người dùng (nhập lùi thoải mái,
   cấm tương lai), `created_at` cho niềm tin (server, bất biến, hiển thị kiểu "biên lai").
4. **Anchor để CHIẾU, không bao giờ để LỌC.** Bình luận gốc ghi `anchor_moc_seq` (nullable):
   viết trong ngăn kéo → neo mốc đó; viết ở khán đài → mặc định neo mốc mới nhất, người viết
   đổi hoặc gỡ được (gỡ = NULL, bình luận không xuất hiện trong ngăn kéo nào). Dùng anchor để
   mở ngăn kéo, tô sáng, gắn chip — **cấm** dùng làm bộ lọc chia khán đài thành N phòng
   (bài học: 24 bình luận chia 9 phòng = 9 phòng vắng; mật độ là oxy của tán gẫu).
5. **Một kho bình luận, hai ống kính.** Khán đài (cây đầy đủ, sort Hay nhất) và ngăn kéo
   (lát cắt theo mốc, sort cũ→mới) chiếu cùng dữ liệu — cùng vật thể, vote ở đâu cũng là một.
   Pattern đã chứng minh: GitHub PR (tab Conversation vs Files changed).
6. **Neo sống ở bình luận gốc; reply đi theo gốc.** Thread neo mốc 2 có reply viết ở mốc 9 —
   reply vẫn thuộc thread đó. Ngăn kéo mốc 2 vì thế tự kể được cả "lời tiên tri lẫn cái kết".
7. **Sort Hay nhất + hệ số tươi theo mốc.** Công thức chính xác ở 5.3. Lý do: Best thuần để
   3 bình luận từ mốc 1 chiếm đỉnh vĩnh viễn — người đến sau thấy "ván đã đóng".
   **Không bao giờ tự đổi sort ngầm** dưới tay người dùng.
8. **Hai mặt BÃO/CẶN đổi theo vòng đời, không chia đôi màn hình.** Không thể cho timeline và
   khán đài cùng làm thân bài một lúc (Reddit Live, Storify, Twitter Moments chết vì vết này).
   Bình luận là *quá trình*, mốc là *kết tủa* — mỗi pha một mặt.
9. **Trạng thái vắng phải duyên dáng.** Dưới 4 bình luận: ẩn mọi số đếm, khán đài thu về một
   dòng mời. Không bao giờ hiển thị "0 bình luận", "0 người đang xem" — không phô sự im lặng.
   **Áp cho CẢ hồ sơ** *(chốt 2026-08-22)*: user chưa hoạt động không được in
   `Mạch 0 · Mốc 0 · Bình luận 0 · Được trích ×0` — ẩn cả khối chỉ số, thay bằng một dòng
   giới thiệu. `Được trích ×N` là phần thưởng chủ lực của 5.6; in `×0` vào mặt người mới là
   nói với họ rằng họ đang ở cuối bảng trước khi kịp viết chữ nào.
   **Ngoại lệ đã cân nhắc — điểm vote** *(chốt 2026-08-22)*: `0` trên cột vote KHÔNG bị
   luật này cấm. `diem` là toạ độ trên một thang **có phần âm**, không phải số đếm người
   tham gia; giấu nó đi thì `0` (chưa ai vote) lẫn với `0` (5 lên 5 xuống), và cột vote
   mất chiều cao làm nhảy bố cục cả feed. Nhưng ngoại lệ này **có giá phải trả**, xem
   5.7: chừng nào chưa có tự-upvote thì ngày ra mắt MỌI thẻ đều in `0`.
10. **Luật domain ở Django, frontend chỉ render.** Có 2 frontend (web + admin) — luật mà rò
    sang React là có 2 phiên bản sự thật. API trả kết quả đã quyết (`face`, danh sách đã sort,
    lỗi rate-limit...), Next không tính lại.

---

## 4. Những thứ ĐÃ BỊ LOẠI — cấm tái phát minh

Các cơ chế sau đã được đề xuất và bị vòng phản biện đối kháng (3 agent độc lập) bác. Agent thực
thi **không đề xuất lại**, kể cả dạng biến thể, trừ khi user chủ động yêu cầu:

| Cơ chế | Lý do loại (tóm tắt) |
|---|---|
| **Kèo/dự đoán có chấm thắng-thua, streak, leaderboard** | Không chấm được sạch (free-text không có tiêu chí trúng/trượt; tác giả chấm = xung đột lợi ích; vote chấm = 3-4 nick phụ mua được). Farm tầm thường (rải dự đoán hai chiều, chỉ kèo trúng được đếm = survivorship bias có mộc nền tảng — máy chế uy tín cho phím hàng). "47 người đặt Chốt hết" dưới vị thế tiền thật đang mở = áp lực đám đông lên lệnh thật. **Với site trading, đây là cấm tuyệt đối.** |
| **Presence realtime** ("N đang xem", "đang gõ...") | Ở quy mô forum, hiển thị "0 đang xem" là quảng cáo công khai sự vắng vẻ — phản social proof. Typing indicator là văn phạm chat đồng bộ dán lên môi trường bất đồng bộ. Hạ tầng websocket đắt cho thứ vô hình ở 90% bài. |
| **Lọc bình luận theo mốc (chia phòng)** | Xé đám đông thành N phòng vắng. Thay bằng chiếu/tô sáng (nguyên tắc 4, 5). |
| **Sort tự đổi ngầm** (vd tự chuyển "Mới nhất" 1h sau mốc mới) | Anti-pattern gây mất phương hướng. Muốn đổi thì người dùng tự bấm. |
| **Mốc mới bump bài lên feed Hot** | Động cơ ngược: tác giả băm "chốt 1/3" thành 3 mốc để ăn 3 lượt đẩy. Feed "Đang diễn ra" riêng (sort `last_entry_at`) + notification cho follower là đủ. |
| **Sparkline/mini-chart mật độ bình luận** | Nhiễu ở quy mô nhỏ (24 bình luận). Có thể xét lại khi có mạch nghìn comment. |
| **Đồng tác giả mạch** | Hoãn. "Trích vào sổ" xử lý bản nhẹ: đồng đội comment, chủ mạch trích kèm tên. |
| **Structured fields bắt buộc theo sub** | Biến đăng bài thành điền biểu mẫu — không ai điền. V1 chỉ có `figures` hiển thị tự do (5.2) + `ket_qua` tự do khi đóng sổ (5.1). |
| **Auto-mở panel/sheet khi khách ghé** | Interstitial che nội dung người ta bấm vào để đọc — bị đóng theo phản xạ. |
| **Mention `@user`** | Cắt khỏi v1 (cần parse + cú pháp + chống spam riêng — không đáng ở giai đoạn này). |
| **Search full-text** | Cắt hẳn khỏi v1, kể cả tsquery "mức tối thiểu". V2. |
| **"Tham gia sub" (subscribe) + feed cá nhân hoá** | *(chốt 2026-08-22)* Vòng lặp lõi của Reddit, nhưng v1 chỉ có **2 sub** — một nút Tham gia với hai lựa chọn là sân khấu, và feed "của tôi" gần như trùng feed chung. Nó còn cần model mới + logic feed mà PLAN không có. **Và không render nút disabled làm chỗ đứng**: một cái nút vĩnh viễn không bấm được còn tệ hơn không có nút (nguyên tắc 9 — đừng phô thứ rỗng). Xét lại khi có >5 sub. |
| **Neo bình luận chung vào mốc 1** (khán đài = ngăn kéo của mốc đầu) | User nêu 2026-08-21, cân nhắc rồi **giữ nguyên nguyên tắc 4**. Cơ chế "một kho, hai ống kính" thì đã đúng ý đó rồi (khán đài = list chung, ngăn kéo = lát cắt theo mốc, mốc 1 = bài gốc). Chỉ khác chỗ **neo mặc định**: nếu neo mốc 1 thì ngăn kéo mốc 1 phình thành bản sao khán đài, **ngăn kéo mốc mới nhất rỗng** đúng lúc tác giả vừa nối mốc và cần phản hồi nhất (đâm nguyên tắc 9), chip `‹mốc 1›` hiện khắp nơi thành nhiễu, và mặt BÃO (5.5) mất chỗ dựa. Nhu cầu "bình luận về cả mạch" đã có đường riêng: **gỡ chip → `anchor_moc_seq = NULL`**. |

---

## 5. Spec sản phẩm chi tiết

### 5.1 Vòng đời mạch

- Đăng bài = tạo `Mach` + `Moc(seq=1)` trong một giao dịch. Không có trường `body` trên `Mach`.
- Nối mốc: chỉ tác giả; mạch `status=open` và không bị khoá. Rate limit: **tối đa 3 mốc mỗi
  ngày (ngày lịch VN) mỗi mạch** — server trả lỗi rõ, UI hiển thị "mai nối tiếp nhé".
- Đóng mạch ("đóng sổ"): tác giả bấm, kèm ô nhập tuỳ chọn **`ket_qua`** — một dòng tự do ≤40
  ký tự (vd "+18.2% · 163 ngày") hiện ở banner mặt CẶN và OG card. Thuần hiển thị, không
  validate ngữ nghĩa (cùng triết lý với `figures`). Mạch đóng **vẫn bình luận được**, không
  nối mốc được. Mở lại được trong 7 ngày (sau đó nút biến mất).
- `entry_count == 1` → trang hiển thị như post thường (không spine, không ngăn kéo);
  UI mạch bật từ mốc 2.

### 5.2 Mốc

- Trường: `seq`, `occurred_at` (date, người dùng đặt, cho nhập lùi; **mặc định = hôm nay theo
  giờ VN, client gửi tường minh, server validate và từ chối ngày tương lai**), `created_at`
  (server), `loai` (chip ngắn tự do ≤20 ký tự: "vào lệnh", "nâng dừng lỗ"...; có gợi ý sẵn theo
  sub nhưng không ép), `body` (markdown ≤10.000 ký tự), `question_for_crowd` (nullable ≤200 ký
  tự — câu mồi hiện ở ngăn kéo khi chưa có bình luận), `figures` (jsonb `[{label, value}]` tối
  đa 6 cặp — **thuần hiển thị**, dạng dải số "GIÁ VÀO 27.80 · DỪNG LỖ 26.40", không validate
  ngữ nghĩa, không bắt buộc).
- **Trường sửa được qua PATCH:** `body, figures, occurred_at, loai, question_for_crowd` —
  không gì khác. Sửa im lặng ≤15 phút kể từ `created_at`; sau đó mỗi lần sửa tạo `MocRevision`
  lưu **đủ cả 5 trường bản trước** (sửa lùi `occurred_at` mà không để vết là phá giá trị lõi),
  UI hiện "đã sửa N lần" bấm xem diff — diff phải hiện cả thay đổi ngày ("10/06 → 04/06").
- Xoá → `deleted_at`, render bia mộ. Ảnh: Phase 5, ≤10 ảnh/mốc.
- **Mốc bị mod ẩn (`hidden_at`) CŨNG giữ chỗ trên spine như bia mộ**, nhãn "mốc đã bị ẩn"
  *(chốt 2026-08-21)*. Lý do: `seq` bất biến, spine không đánh số lại được — giấu hẳn một ô là
  làm thủng dãy số và phá bất biến `entry_count == số ô trên spine` mà dải gập của 5.5 suy ra.
  ⚠ Đây là quyết định **moderation công khai**: người lạ thấy rằng có thứ vừa bị gỡ. Nó không
  mâu thuẫn 5.10 ("soft-hide — tác giả vẫn thấy kèm nhãn"): tác giả thấy **nội dung**, người
  khác chỉ thấy **cái ô trống có nhãn**. **USER ĐÃ DUYỆT 2026-08-22** — một ô trống trung thực
  hơn một dãy số thủng, và Reddit cũng làm đúng vậy với `[removed]`.

### 5.3 Khán đài

- Cây bình luận lồng nhau không giới hạn độ sâu về dữ liệu; **UI render tối đa 6 tầng** rồi
  "tiếp tục thread →" (như Reddit).
- Sort: `hay_nhat` (mặc định) | `moi_nhat` | `cu_nhat`. Công thức `hay_nhat`, viết một cách
  duy nhất để không hiểu nhầm:

  ```
  rank(c) = wilson_lower_bound(c.up_count, c.down_count, z=1.281)
          + (0.15 nếu c.created_at > mach.last_entry_at
                  VÀ now − c.created_at ≤ 48 giờ)
  ```
  Hành vi biên (chủ đích): bình luận viết muộn bao nhiêu cũng được hưởng bonus trong 48h đầu
  *đời của nó*, miễn nó ra đời sau mốc mới nhất. Chỉ áp cho bình luận gốc; sibling trong thread
  sort theo wilson thuần.
- **Phân trang:** `hay_nhat` trả MỘT trang 50 thread gốc đầu (đủ cho tuyệt đại đa số mạch;
  quá 50 → nút "xem thêm" gọi lại offset — chấp nhận trôi nhẹ vì rank động). Cursor keyset
  thật chỉ áp cho `moi_nhat`/`cu_nhat` (khoá `created_at, id` ổn định).
- Bình luận điểm ≤ −5 tự gập, bấm mới mở.
- Chip `‹mốc N›` trên bình luận gốc có neo: bấm → peek mốc đó, không rời khán đài.
- Sửa bình luận: hiện dấu `*đã sửa*`. Xoá: giữ chỗ "[đã xoá]" nếu có reply con **hoặc đã TỪNG
  được trích vào sổ (kể cả trích đã gỡ)**; xoá thật chỉ khi không dính cả hai.
  Chữ "đã TỪNG" là cố ý và khớp đúng `Trich.comment = PROTECT`: rào 1 của 5.6 giữ hàng `Trich`
  sau khi gỡ vì **"tự nó là log"** — xoá thật bình luận sẽ xoá luôn cái log đó. Đọc thành "đang
  được trích" là Phase 2 sẽ tiền-kiểm `removed_at IS NULL`, quyết "xoá thật", rồi ăn
  `ProtectedError` → 500 trên một thao tác hợp lệ của chính chủ.
  > **Vá 2026-08-21 (Phase 1a).** Bản đầu chỉ có điều kiện "có reply con", và nó **đá thẳng vào
  > 5.6** — mục 5.6 mở đầu bằng "cuốn sổ **không-xoá-được**" và giữ hàng `Trich` kể cả khi gỡ vì
  > "tự nó là log". Hai câu gặp nhau ở chỗ: người bình luận xoá bình luận chưa có reply của chính
  > mình ⇒ blockquote biến mất khỏi mốc của một mạch **đã đóng sổ**, chỉ số "Được trích ×N" tụt,
  > hàng log mất — không exception, không audit. `Trich.comment` nay là `PROTECT` nên đường đó
  > **nổ** thay vì nuốt; câu trên là luật tương ứng ở tầng sản phẩm.
  > Kèm theo, việc của Phase 2: xoá thật một bình luận để lại **`Vote` mồ côi** (`Vote` cố ý
  > không có FK) — đường `DELETE /comments/{id}` phải dọn, hoặc chuyển hẳn sang xoá mềm.

### 5.4 Ngăn kéo — bốn luật

1. Accordion: mở ngăn kéo mốc khác thì cái đang mở gập lại. Mở = các thread có bình luận gốc
   `anchor_moc_seq == seq` (cả thread, gồm reply mọi thời điểm).
2. Sort trong ngăn kéo: **cũ → mới**, không cho chỉnh (nó là cửa sổ, không phải phòng).
   Render tối đa 2 tầng reply; thread sâu → "xem cả nhánh ở khán đài ↓" (scroll + highlight).
3. Composer trong ngăn kéo tự neo mốc đó. Composer khán đài neo mốc mới nhất, chip đổi/gỡ được
   (gỡ = anchor NULL — xem nguyên tắc 4).
4. Mốc 0 bình luận: không hiện `💬 0` — hiện `＋ nói gì đó về mốc này` + `question_for_crowd`
   nếu có.

### 5.5 Hai mặt BÃO/CẶN

```
BÃO  nếu (status == open VÀ chưa bị khoá VÀ now − last_activity_at ≤ 72h)
     HOẶC (user đăng nhập VÀ đã follow hoặc từng bình luận mạch này)
CẶN  còn lại.       last_activity_at: cột denormalize trên Mach (mục 6)
```
- Khách ẩn danh + bot: thuần theo luật thời gian → Google thấy mặt CẶN với mạch nguội.
  Cơ chế phục vụ/cache tách theo đăng nhập — bắt buộc đọc 8.4 trước khi build trang mạch.
- Toggle thủ công theo *lượt xem* (`?view=bao|can`), **không lưu** lựa chọn (bài học phản biện:
  máy nhớ toggle → người nghiêm túc bật "thuần" một lần rồi vĩnh viễn không thấy bình luận).
- **Mặt BÃO** (khán đài là thân bài): header → spine 1 dòng (bấm số → peek mốc; **số của các
  mốc chưa xem đổi màu hoàng thổ** theo `last_seen_entry_seq`) → thẻ mốc mới nhất mở sẵn
  (kèm nút "mở cả mạch ▾" — bung timeline đầy đủ, trong đó **vạch mới** kẻ trước mốc đầu tiên
  chưa xem) → composer + câu mồi theo trạng thái → cây khán đài. Mốc mới nhất mở sẵn được
  tính là đã xem (client gọi `POST /machs/{id}/seen` khi trang mở).
- **Mặt CẶN** (nhật ký là thân bài): banner ("MẠCH ĐÃ ĐÓNG · {ket_qua} · N mốc" — phần
  `ket_qua` chỉ hiện khi có) → toàn bộ mốc (mốc 1 + gập giữa + 2 mốc cuối; dải gập hiện
  "5 mốc · 43 bình luận" + MỘT trích dẫn nóng nhất làm mồi bung) → chân trang
  "💬 N bình luận · xem các câu đáng đọc ▾". **"Câu đáng đọc" = bình luận đã được trích ∪
  top-10 theo wilson.** Bấm chân trang → bung khán đài đầy đủ ngay tại đó (mặc định
  `hay_nhat`, đổi được 3 sort) **kết thúc bằng composer** — mạch đóng vẫn bình luận được (5.1).

  > **Cách cài "câu đáng đọc", chốt 2026-08-22:** cú bấm bung khán đài đầy đủ (đúng câu
  > trên), nhưng phần **TRÊN CÙNG** của khối vừa bung là tập hợp ấy, gắn nhãn "Câu đáng
  > đọc", rồi mới tới cây đầy đủ. Không làm vậy thì cái nhãn trên nút đang hứa một thứ mà
  > cú bấm không giao — 1c bung toàn bộ khán đài và phép hợp không tồn tại ở đâu cả. Phải
  > là **hợp THẬT**: `r7` của seed cố ý nằm NGOÀI top-10, nên ai cài thành "chỉ top-10"
  > thì bài đo đỏ.
  > **Một ngoại lệ** *(chốt 2026-08-22, Phase 1d)*: khi tập ấy BẰNG cả khán đài (mạch dưới
  > 10 thread và không có trích nào), khối "Câu đáng đọc" **không render**. Nếu không nó
  > là bản sao y nguyên của cái cây ngay dưới nó, và một cái nhãn "đáng đọc" dán lên
  > TOÀN BỘ nội dung thì không chọn lọc gì cả — nó chỉ làm trang dài gấp đôi.

  > **Công thức dải gập, chốt 2026-08-22 (Phase 1c) — hiện thực DUY NHẤT ở
  > `apps/web/lib/dai-gap.ts`:** với `entry_count = n`, **gập `seq` từ 2 tới n−3**; hiện mốc
  > `1`, `n−2`, `n−1`, `n`. Với `n = 9` ⇒ gập **2–6, đúng "5 mốc"** như câu trên và như
  > wireframe 9.2 và như bảng nghiệm thu mục 10.
  > ⚠ Câu *"2 mốc cuối"* ở trên là **văn xuôi lỏng** — thực tế hiện **ba** mốc cuối
  > (`n−2, n−1, n`). Giữ `2…n−3` vì nó làm ba chỗ còn lại của PLAN đúng cùng lúc, **và** vì
  > nó đưa khối "trích vào sổ" của mạch seed (mốc 7) lên mặt tiền — với `2…n−2` thì cơ chế
  > thưởng chủ lực của 5.6 bị gập mất, phải bấm bung mới thấy.
  > **USER ĐÃ DUYỆT 2026-08-22.** Kèm một sửa: **chỉ gập khi giấu được ÍT NHẤT 2 mốc**, tức
  > `n ≥ 6`. Với `n = 5` công thức cho dải gập đúng 1 mốc — giấu một mốc sau một cái nút cao
  > bằng chính nó, lại tốn thêm một dòng mồi bung. `NGUONG_KHONG_GAP` phải là **5**, không
  > phải 4. (Bản đầu của 1c cài `2…n−2`, và phiên chính đã lỡ sửa wireframe cho khớp code
  > trước khi phản biện chỉ ra rằng NỀN mới là chỗ sai.)

### 5.6 Trích vào sổ — bốn rào bắt buộc

Cơ chế thưởng chủ lực cho người bình luận: được ghi tên vào cuốn sổ không-xoá-được.
Rào (chống "máy in địa vị" + "giặt hindsight"):
1. **Tối đa 1 trích đang hiệu lực mỗi mốc** — partial unique `UNIQUE(moc) WHERE removed_at
   IS NULL` (Django: `UniqueConstraint(condition=...)`). Gỡ trích được trong 24h (row giữ lại
   với `removed_at` — tự nó là log), gỡ xong trích lại bình luận khác được.
2. Blockquote hiển thị **kèm dấu thời gian bình luận gốc** ("viết 10/06, trích 21/08") —
   chống trích hậu nghiệm câu "hoá ra đúng" để sổ đọc như tiên tri.
3. Chỉ số hồ sơ "Được trích vào sổ ×N" đếm theo **số tác giả khác nhau** đã trích —
   chống hai nick trích qua lại. **KHÔNG tính tự trích** *(chốt 2026-08-22)*: chủ mạch trích
   bình luận của chính mình thì không cộng vào chỉ số của chính họ. Rào này dựng lên để chặn
   "máy in địa vị" — mà tự trích chính là cái máy in ngắn nhất.
4. Render tách bạch khỏi thân mốc, ghi rõ "trích từ khán đài, bởi chủ mạch" — nó là chú thích,
   không phải nội dung sổ.
Người được trích nhận notification.

### 5.7 Vote · Reaction · Follow

- Vote ±1 trên mốc và bình luận, riêng rẽ (mốc 9 được 412 dù bài gốc 89 — phần giá trị nhất
  phải nổi lên được). Đổi/rút vote được.
- **Tác giả tự upvote sẵn** *(chốt 2026-08-22, cài ở Phase 2)*: mốc và bình luận khởi điểm
  với **+1 của chính người viết**, rút được như mọi vote khác. Không phải để thổi điểm —
  ai cũng được đúng 1 phiếu nên thứ hạng tương đối không đổi — mà để `0` **có nghĩa**.
  Không có nó thì `0` vừa là "chưa ai đụng tới" vừa là "đã bị dìm về không", và ngày ra
  mắt cả feed là một cột số 0 (đâm nguyên tắc 9, xem mục 3). Có nó thì `0` nghĩa là **đã
  có người vote xuống** — một câu mang thông tin.
- Reaction 1 chạm trên mốc: bộ cố định `📈 📉 🔥 🧊 🎯` — bậc thang tham gia rẻ hơn viết.
- Follow mạch: nút "Theo mạch". Follower nhận notification mốc mới.

### 5.8 Notification

- Mốc mới → follower: **tối đa 1 thông báo mỗi mạch mỗi ngày (ngày lịch VN — khớp
  `dedupe_key`, chấp nhận biên ngày là chủ đích)**; mốc thứ 2 trong ngày update payload
  thông báo cũ thay vì tạo mới.
- Reply bình luận của tôi, trích bình luận của tôi: thông báo thường. (Mention: đã loại, mục 4.)
- Kênh v1: chuông trên web (poll 60s) + email. **Email digest: tuỳ chọn opt-in, gửi tuần —
  8:00 sáng thứ Bảy giờ VN**, gộp mạch đang theo có diễn biến trong tuần.
- Bảng `Notification` + cron gửi email. **Không websocket ở v1.**

### 5.9 Feed & URL

- `/` — 2 tab: **Mới** (post mới, sort `created_at`) · **Đang diễn ra** (mạch open, sort
  `last_entry_at` desc; feed đặc sản của gikky, KHÔNG phải Hot bằng bump).
- `/s/<sub>` — như trên, trong sub. `/m/<slug>-<id>` — trang mạch (id bền, slug đổi được,
  redirect vĩnh viễn khi slug cũ — **308, không phải 301** *(sửa 2026-08-22, Phase 1c)*: Next App
  Router chỉ có `permanentRedirect()` và nó trả 308; đặt 301 phải đi qua `middleware.ts`, mà
  middleware là cơ chế của 8.4 thuộc Phase 3. 308 còn đúng hơn về ngữ nghĩa (301 cho phép đổi
  method sang GET, 308 giữ nguyên) và Google coi cả hai là vĩnh viễn như nhau.
  `/u/<username>` — hồ sơ: mạch của họ, chỉ số "Được trích ×N",
  tổng mốc, tổng bình luận.
- JSON-LD `DiscussionForumPosting` trên trang mạch; sitemap.xml; canonical.

### 5.10 Moderation & compliance (site trading VN)

- **Footer disclaimer + trang `/luat` (bản draft): làm ngay ở Phase 1** — site trading VN
  không được public thiếu nó, dù chỉ là trang đọc. Nội dung footer: nội dung do người dùng
  đăng, không phải khuyến nghị đầu tư; gikky không phải công ty chứng khoán, không môi giới,
  không nhận uỷ thác.
- **Luật cộng đồng** (`/luat`): cấm hô hào mua/bán kiểu phím hàng, cấm cam kết lợi nhuận,
  cấm mời chào uỷ thác/room VIP trả phí, cấm link nhóm kín trong bài. User duyệt bản cuối.
- **Report** (Phase 4): nút báo cáo trên mạch/mốc/bình luận với lý do (phím hàng, lừa đảo,
  spam, khác) → hàng đợi admin.
- **Admin xử lý** (Phase 4): ẩn (soft-hide — tác giả vẫn thấy kèm nhãn), khoá mạch (đọc được,
  không tương tác — trục riêng, khác "đóng sổ"), ban user (tạm/vĩnh viễn, hiện lý do khi bị
  chặn đăng nhập), **shadow-limit tài khoản < 3 ngày tuổi: tối đa 5 bình luận/giờ**.
- Mọi hành động mod ghi `AuditLog`.

---

## 6. Data model

PostgreSQL 17 (bản đang chạy trên máy dev — chốt 2026-08-21; dev, compose và prod dùng
CÙNG một major version). Django ORM — mức trường/ràng buộc, agent tự viết migration.

`AUTH_USER_MODEL = "core.User"` đã chốt từ **Phase 0** (custom user model rỗng,
`class User(AbstractUser): pass`) vì đổi nó sau lần `migrate` đầu tiên là ngõ cụt.
Các trường thêm dưới đây là việc của Phase 1 — chỉ là một migration bình thường.

```
User            # Django auth + django-allauth; thêm:
                username UNIQUE, display_name, bio,
                banned_until TIMESTAMPTZ NULL, ban_permanent BOOL DEFAULT false,
                ban_reason VARCHAR NULL

Sub             id, slug UNIQUE, ten, mo_ta, created_at            # v1 tạo qua admin

Mach            id, sub FK, author FK, slug, title (≤160),
                status ENUM(open, closed), closed_at NULL,
                ket_qua VARCHAR(40) NULL,          # nhập tự do khi đóng sổ (5.1)
                locked_at NULL,                    # mod khoá — trục riêng với status
                hidden_at NULL, hidden_by FK NULL, # mod ẩn (soft-hide)
                last_entry_at, last_activity_at,   # KHÔNG phải "max mọi hoạt động" — hai nhóm
                entry_count, comment_count,        #   hai luật đếm, xem "Luật đếm 4 cột" ở
                created_at                         #   ghi chú cuối mục này. TẤT CẢ denormalize,
                                                   #   cập nhật trong cùng transaction với ghi
                INDEX (sub, last_entry_at DESC), (author, created_at DESC),
                      (created_at DESC),                          # feed Mới toàn cục
                      (last_entry_at DESC) WHERE status='open'    # feed Đang diễn ra toàn cục

Moc             id, mach FK, seq INT, author FK,
                occurred_at DATE, created_at TIMESTAMPTZ (server),
                loai VARCHAR(20) NULL, body TEXT, question_for_crowd VARCHAR(200) NULL,
                figures JSONB NULL,                # [{label, value}] ≤6
                edited_at NULL, edit_count INT DEFAULT 0,
                deleted_at NULL, hidden_at NULL, hidden_by FK NULL,
                score INT DEFAULT 0                # mốc chỉ cần score (không sort wilson)
                UNIQUE (mach, seq)

MocRevision     id, moc FK, body, figures, occurred_at, loai, question_for_crowd,
                revised_at                         # bản TRƯỚC — đủ cả 5 trường sửa được (5.2)

MocAnh          id, moc FK, khoa_luu_tru, exif_taken_at NULL,
                status ENUM(pending, confirmed), position INT, w, h, created_at,
                da_cach_ly BOOL DEFAULT false
                # ≤10 confirmed/mốc — enforce ở app, TRONG khoá hàng Moc (Phase 5)
                # `r2_key` → `khoa_luu_tru` và `thumb_key` bỏ hẳn (2026-08-23, xem 8.5):
                #   ảnh lưu xuống đĩa nên tên cột không được nói "R2"; ảnh chính và
                #   thumbnail dùng CHUNG một khoá, khác thư mục
                # `da_cach_ly`: file đang ở kho cách ly (mốc bia mộ / bị mod ẩn) — 8.5

Comment         id, mach FK, parent FK NULL, author FK,
                anchor_moc_seq INT NULL,   # chỉ có nghĩa khi parent IS NULL; reply kế thừa
                                           #   gốc; NULL = người viết đã gỡ chip (nguyên tắc 4)
                body TEXT, created_at (server), edited_at NULL, deleted_at NULL,
                hidden_at NULL, hidden_by FK NULL,
                up_count INT DEFAULT 0, down_count INT DEFAULT 0,   # BẮT BUỘC cho wilson —
                score INT GENERATED (up_count − down_count),        #   score suy ra, đừng lưu tay
                path VARCHAR COLLATE "C"           # materialized path: "000012.000034"
                UNIQUE (mach, path)                # chặn race cấp phát path; ĐỦ cho cả
                                                   #   LIKE 'tiền tố%' — xem ghi chú dưới
                INDEX (mach, anchor_moc_seq) WHERE parent IS NULL,
                      (mach, author)               # cho luật BÃO "từng bình luận mạch này"

Vote            user FK, target_type ENUM(moc, comment), target_id, value SMALLINT ∈ {−1, 1}
                UNIQUE (user, target_type, target_id)
                # cập nhật up_count/down_count/score đích trong CÙNG transaction

Reaction        user FK, moc FK, emoji ENUM(len, xuong, lua, bang, trung)   # 📈📉🔥🧊🎯
                UNIQUE (user, moc)

Trich           id, moc FK, comment FK, created_at, removed_at NULL
                UNIQUE (moc) WHERE removed_at IS NULL   # partial — gỡ xong trích lại được
                                                        # (Django: UniqueConstraint condition)

Follow          user FK, mach FK, created_at, last_seen_entry_seq INT DEFAULT 0
                UNIQUE (user, mach)

Notification    id, user FK, type, payload JSONB, created_at, read_at NULL,
                dedupe_key VARCHAR NULL            # "moc_moi:{mach_id}:{yyyymmdd theo giờ VN}"
                UNIQUE (user, dedupe_key)
                INDEX (user, created_at DESC)      # chuông poll

Report          id, reporter FK, target_type, target_id, ly_do ENUM, ghi_chu, created_at,
                resolved_at NULL, resolved_by FK NULL, action VARCHAR NULL

AuditLog        id, actor FK, action, target_type, target_id, meta JSONB, created_at
                # log hành động; STATE moderation nằm ở hidden_at/locked_at/ban — không ở đây
```

Ghi chú thực thi:
- **Cấp phát `path`:** trong transaction, `select_for_update` trên parent (comment gốc thì trên
  Mach) rồi cấp segment kế; retry khi `IntegrityError` từ `UNIQUE (mach, path)`. Không có bước
  này, hai reply đồng thời cùng parent sẽ trùng path im lặng.
- **`path` phải là `COLLATE "C"`, và bỏ `INDEX (mach, path)` riêng** *(sửa ngược 2026-08-21,
  sau khi đo bằng `EXPLAIN`)*. Postgres chỉ biến `LIKE 'x%'` thành điều kiện index khi cột
  có collation `C` (hoặc opclass `*_pattern_ops`); dưới collation locale — dev là
  `English_United Kingdom.1252` — cùng truy vấn rơi xuống `Filter:` **kể cả khi đã tắt
  `enable_seqscan` lẫn `enable_bitmapscan`**. Có `C` rồi thì b-tree của `UNIQUE (mach, path)`
  phục vụ luôn việc gom subtree, nên index thường trùng cột là thừa: bản đầu của mục này liệt
  kê cả hai là thiếu sót, không phải chủ ý. `C` còn khoá luôn thứ tự của `Max(path)` và
  `ORDER BY path` để dev (Windows) và prod (Linux) không cho hai kết quả khác nhau.
- **`path` dùng để làm gì:** gom cả subtree bằng một query + sort `cu_nhat` bằng ORDER BY path.
  Với `hay_nhat`/`moi_nhat`: fetch phẳng theo mach rồi **dựng cây và sắp sibling trong Python**
  — đừng cố nhét rank vào ORDER BY path.
- Wilson + bonus tươi tính lúc query (Python, trên trang 50 thread — rẻ); **không lưu rank**.
- Xoá user (GDPR-lite): giữ nội dung, author hiển thị "[tài khoản đã xoá]".
- **Luật đếm 4 cột denormalize — CẤU TRÚC vs NỘI DUNG** *(chốt 2026-08-21, Phase 1a)*:
  - `entry_count` và `last_entry_at` đo **cấu trúc**: tính trên **MỌI** `Moc`, kể cả bia mộ
    (`deleted_at`) lẫn mốc bị mod ẩn (`hidden_at`). Lý do: `seq` bất biến và spine render đủ
    số ô — mốc ẩn chiếm chỗ y hệt bia mộ. Giữ được bất biến **`entry_count == max(seq)`**, mà
    dải gập của mặt CẶN (5.5) suy ra từ chính con số này.
  - `comment_count` và `last_activity_at` đo **nội dung đọc được**: loại `deleted_at` và
    `hidden_at`. Lý do: banner nói "24 bình luận" trong khi người đọc thấy 22 là sai âm thầm;
    và một mạch bị dọn spam không được ở mặt BÃO thêm 72h nhờ chính cái spam vừa bị ẩn.
  - Hệ quả cố ý 1: **ẩn hay xoá mềm một mốc không làm `last_entry_at` lùi** ⇒ hệ số tươi (5.3)
    không hồi tố. (Nói "không bao giờ lùi" là nói quá: xoá **cứng** hàng `Moc` mới nhất — hôm nay
    chỉ Django admin làm được — vẫn kéo nó lùi. Cùng mệnh đề điều kiện với `entry_count` dưới.)
  - Hệ quả cố ý 2 — **hai cột lệch nhau được**, `last_activity_at` có thể **nhỏ hơn**
    `last_entry_at`. Sinh ra ca: tác giả nối mốc 10, không ai bình luận, mod ẩn mốc 10 ⇒ mạch
    vẫn **đứng đầu feed "Đang diễn ra"** (5.9 sort `last_entry_at`) nhưng mở ra là **mặt CẶN**
    (5.5 tính theo `last_activity_at`). Đây là hành vi mới từ 2026-08-21, **chưa xử**: Phase 4
    phải dọn bằng `Mach.hidden_at`/`locked_at`, hoặc feed lọc thêm `last_activity_at`. Ghi ở đây
    để 1c/Phase 4 không tưởng là bug ngẫu nhiên.
  - **`Comment.deleted_at` KHÔNG được đếm dù vẫn render bia mộ `[đã xoá]` (5.3).** Khác với
    `Moc` — `Comment` không có `seq` nên không có bất biến nào để giữ. Hệ quả: khán đài có thể
    render 24 dòng trong khi chân trang nói "💬 22 bình luận". **"💬 N" nghĩa là N bình luận
    ĐỌC ĐƯỢC, không phải N dòng** — 1c phải hiểu đúng chữ đó.
  - Nói chính xác: code ghim `entry_count == COUNT(*) Moc`. Nó trùng `max(seq)` **chừng nào
    không hàng `Moc` nào bị xoá cứng** — hôm nay không có đường nào, nhưng Phase 4 mở admin xoá
    `Moc` lẻ là bất biến gãy im lặng.

---

## 7. API v1 (Django Ninja, prefix `/api/v1`)

Auth qua session cookie (allauth headless — **mount toàn bộ urls allauth, kể cả OAuth
callback, dưới prefix `/api/`** để Caddy/rewrites route được; redirect URI Google đăng ký là
`https://gikky.net/api/accounts/google/login/callback/`). CSRF chuẩn Django.
Lỗi `{detail, code}`. **Một ngoại lệ có tên**: lời từ chối *vì thời gian* thêm
`thu_lai_tu` (`LoiThoiGianOut`, lớp CON của `LoiOut`) — hôm nay chỉ 429 `qua_han_muc_moc`.
Ai chỉ đọc `detail`/`code` không phải biết lớp ấy tồn tại; hàng rào
`tests/test_hop_dong_openapi.py` vì thế đo theo **trường**, không theo tên schema.

| Method & path | Việc | Ghi chú |
|---|---|---|
| `POST /api/_allauth/browser/v1/auth/*` | allauth headless: đăng ký · đăng nhập · đăng xuất · xác thực email · quên/đổi mật khẩu · Google OAuth | *(chốt Phase 2, 2026-08-22)* **không** nằm dưới `/api/v1` — đó là URLconf của allauth, mount nguyên khối ở `/api/_allauth/`. `HEADLESS_CLIENTS = ("browser",)` ⇒ chỉ session cookie. Redirect URI Google của bản headless là `/api/_allauth/browser/v1/auth/provider/callback`, **không** phải `/api/accounts/google/login/callback/` |
| `GET /me` | phiên hiện tại: `dang_nhap`, `username`, `display_name`, `email`, `email_da_xac_thuc`, `la_staff`, `google_bat` | *(thêm Phase 2, 2026-08-22)* khách nhận **200** kèm `dang_nhap:false`, không phải 401. Per-user tuyệt đối — **không cache** (8.4 điểm 4). `google_bat=false` ⇒ trang đăng nhập **không render** nút Google (mục 4) |
| `GET /feeds/moi`, `GET /feeds/dang-dien-ra` | 2 feed, cursor keyset | `?sub=` lọc |
| `GET /subs/{slug}` | header trang chuyên mục: `ten`, `mo_ta`, `so_mach`, `created_at` | *(thêm Phase 1d, 2026-08-22)* chỉ đọc, không per-user; slug lạ → 404 |
| `GET /subs` | liệt kê MỌI sub, sắp theo `slug` | *(thêm Phase 1d vá, 2026-08-22)* sidebar + `sitemap.ts` phải hỏi đây, **cấm ghi cứng danh sách slug ở frontend** — sub thứ ba mở ra mà vắng mặt im lặng ở cả hai chỗ là đúng loài hỏng nợ #11 vừa được vá để diệt |
| `POST /machs` | tạo bài (= mốc 1) | *(Phase 2)* ai đăng nhập cũng được; `sub` là **slug**; tác giả nhận sẵn +1 của mình (5.7) |
| `GET /machs/{id}` | mach + mốc + `face` server đã tính + spine | **không chứa gì per-user** (cache được). *(Phase 3, 2026-08-23)* thêm ba trường **suy từ dữ liệu mạch, không từ người xem** nên chúng không phá tính chất đó: `mo_lai_den` (= `closed_at + 7 ngày`, `null` khi đang mở) · mỗi mốc có `author` và `sua_im_lang_den` (= `created_at + 15 phút`). Cả ba trả nợ `MOC-THIEU-AUTHOR` + `API-THIEU-MOC-THOI-GIAN`: trước đó frontend giữ bản sao của `NGAY_MO_LAI`/`PHUT_SUA_IM_LANG` và suy quyền sửa mốc từ chủ MẠCH |
| `GET /machs/{id}/me` | trạng thái CỦA VIEWER: `my_votes`, `my_reactions`, `following`, `last_seen_entry_seq`, `tung_binh_luan`, **`face`** | client fetch sau khi trang cached render — dữ liệu per-user KHÔNG được nướng vào page cache (8.4). *(Phase 3, 2026-08-23)* khách nhận **200** kèm `dang_nhap:false`, không phải 401 — cùng lý lẽ `GET /me`. **`face` ở đây áp ĐỦ HAI VẾ của 5.5** (dòng `GET /machs/{id}` chỉ có vế thời gian); vì vế 2 là phép HOẶC nên nó chỉ kéo được CẶN → BÃO. Tên trường giữ **tiếng Anh** đúng nguyên văn dòng này: `test_api_mach.py::MANH_PER_USER` ghim đúng các mảnh chữ ấy làm danh sách CẤM của cửa cache được |
| `POST /machs/{id}/mocs` | nối mốc | rate 3/ngày VN, chỉ author, open + không khoá. *(Phase 2)* mã lỗi riêng cho từng ca: `khong_phai_chu` 403 · `mach_bi_khoa` 403 · `mach_da_dong` 409 · `qua_han_muc_moc` 429. *(Phase 3, 2026-08-23)* thân của 429 là `LoiThoiGianOut` — kèm `thu_lai_tu` = **nửa đêm giờ VN kế tiếp**, vì `detail` dừng ở "mai nối tiếp nhé" mà "mai" lúc 23:50 nghĩa là mười phút nữa |
| `PATCH /mocs/{id}` · `DELETE` | sửa (5 trường ở 5.2; revision nếu >15ph) · bia mộ | *(Phase 2)* **chỉ `Moc.author`**; PATCH thật (trường vắng = không đổi); `DELETE` trả về chính thẻ mốc ở dạng bia mộ, không 204. *(Phase 3, 2026-08-23)* `MocOut` nay có `author` — UI hỏi được ĐÚNG cột mà cửa này hỏi, thay vì suy từ chủ mạch |
| `GET /mocs/{id}/revisions` | danh sách bản cũ cho UI diff | |
| `GET /machs/{id}/comments` | khán đài `?sort=hay_nhat\|moi_nhat\|cu_nhat`; hay_nhat = 1 trang 50 + "xem thêm", 2 sort kia cursor keyset | server sort, trả cây đã dựng |
| `GET /mocs/{id}/comments` | lát cắt ngăn kéo, cũ→mới | |
| `POST /machs/{id}/comments` | viết bình luận | parent?, anchor_moc_seq? (nullable), body. *(Phase 2)* ai đăng nhập cũng được, **mạch đóng sổ vẫn viết được**; `anchor` kèm `parent` ⇒ 400; người viết nhận sẵn +1 của mình |
| `PATCH /comments/{id}` · `DELETE` | sửa (dấu *đã sửa*) · xoá theo luật 5.3 | *(Phase 2)* **chỉ `Comment.author`**, kể cả chủ mạch cũng không sửa được lời người khác. `DELETE` trả `{id, xoa_that}`: `false` = ở lại làm bia mộ; xoá thật thì **dọn `Vote` mồ côi** cùng transaction |
| `POST /votes` | vote/đổi/rút | value ∈ {−1,0,1}; transaction cập nhật counts. *(Phase 2)* trả về con số MỚI của đích cho UI lạc quan; `up_count`/`down_count` là `null` với đích là mốc (mốc chỉ có `score`) |
| `POST /mocs/{id}/reactions` | react/đổi/rút | *(Phase 2)* `emoji=null` là rút; trả `dem` **đủ 5 khoá kể cả khoá 0** |
| `POST /mocs/{id}/trich` · `DELETE` | trích/gỡ | 4 rào 5.6. *(Phase 3, 2026-08-23)* **chỉ chủ mạch** (`Mach.author` — rào 4 ghi "bởi chủ mạch"); thân `{comment_id}`, mốc nằm ở URL. Mã riêng từng ca: `da_co_trich` 409 (rào 1) · `het_han_go_trich` 409 (>24h) · `chua_co_trich` 404 · trích chéo mạch / bình luận đã gỡ ⇒ 400. Trả về **cả thẻ mốc** vì rào 4 bắt render tách bạch. **Có áp `mach_bi_khoa`** — khác `follow`/`seen` dưới đây |
| `POST /machs/{id}/follow` · `DELETE` | theo/bỏ | *(Phase 3, 2026-08-23)* cả hai **idempotent**; lượt theo đầu đặt `last_seen_entry_seq = entry_count` chứ không `0`. **KHÔNG áp `mach_bi_khoa`**: follow là sổ tay riêng của người đọc, và chặn `DELETE` trên mạch bị khoá thì người ta không tắt được thông báo của đúng cái mạch đó |
| `POST /machs/{id}/seen` | cập nhật last_seen_entry_seq | gọi khi mở trang. *(Phase 3, 2026-08-23)* thân `{entry_seq?}`, vắng ⇒ "đã xem tới mốc mới nhất". Con số **chỉ tiến không lùi** + kẹp trần `entry_count` (peek mốc cũ không kéo vạch mới về sau). Chưa follow ⇒ **200 kèm `following:false` và không ghi gì** — cột này sống trên hàng `Follow` (mục 6), và tạo `Follow` hộ là âm thầm bắt người ta theo mạch vì họ mở một trang |
| `POST /machs/{id}/close` · `/reopen` | đóng sổ (kèm ket_qua?) / mở lại ≤7 ngày | *(Phase 2)* **chỉ author**; đóng lần hai ⇒ 409 `mach_da_dong` (nếu không, bấm hai lần là dời hạn 7 ngày); mở lại **xoá `ket_qua`** |
| `GET /notifications` · `POST /notifications/read` | chuông poll 60s | *(Phase 3, 2026-08-23)* **per-user tuyệt đối, cấm cache**; khách nhận **401** — khác `GET /me` và `/machs/{id}/me` (200 rỗng) vì chuông chỉ được poll khi header đã biết có người đăng nhập. `GET` cursor keyset trên `(created_at, id)` giảm dần, kèm `so_chua_doc` của **cả hộp thư** (không phải của trang). `read` nhận `{ids?}`: `null` = đọc hết, `[]` = không dòng nào; id của người khác **bị bỏ qua im lặng**, không 403 — 403 xác nhận id đó có thật. Sinh thông báo nằm TRONG transaction của hành động (mốc mới cho follower, gộp 1/mạch/ngày lịch VN · được trích · reply) |
| `POST /reports` | báo cáo một mạch/mốc/bình luận vào hàng đợi kiểm duyệt | *(cài 2026-08-23, lượt vá V1)* thân `{target_type: mach\|moc\|comment, target_id, ly_do: phim_hang\|lua_dao\|spam\|khac, ghi_chu?}`; ai đăng nhập cũng tố được, **không cần quyền gì trên đích**. **KHÔNG áp `mach_bi_khoa`** — báo cáo là lời nhắn gửi mod, không phải tương tác với nội dung; chặn nó là đúng lúc mạch bị khoá vì tranh chấp thì không ai tố thêm được (cùng lý lẽ `follow`/`seen`, khác `trich`). Chống trùng: **một người, một đích, một báo cáo ĐANG MỞ** (unique **partial** `WHERE resolved_at IS NULL`) ⇒ 409 `da_bao_cao`; mod đóng báo cáo cũ rồi thì tố lại được. Đích không có / mạch bị ẩn ⇒ 404, đích đã là bia mộ hoặc đã bị ẩn ⇒ 409 `noi_dung_da_go`. Response là **biên nhận**, cố ý không mang trạng thái xử lý — người tố không được có một cửa dò hàng đợi. Phase 4 dựng trọn phía tiêu thụ mà quên cửa này, nên hàng đợi kiểm duyệt rỗng **về cấu trúc** suốt hai phase |
| `PATCH /me` | đổi tuỳ chọn của chính phiên đang gọi | *(thêm 2026-08-23, lượt vá V1)* hôm nay đúng một trường: `{nhan_digest?}`. PATCH thật (trường vắng = không đổi; `{}` hợp lệ và không ghi gì). Là cửa **duy nhất** bật được digest tuần — PLAN 5.8 chốt digest là opt-in và `User.nhan_digest` mặc định `false`, nhưng tới lượt vá này không endpoint/form nào đặt được nó, tức `gui_digest` chạy trên một tập người nhận luôn rỗng. `GET /me` trả kèm `nhan_digest` để công tắc đọc lại được trạng thái |
| `POST /mocs/{id}/anh` | tải MỘT ảnh lên mốc (**multipart**) | *(Phase 5, 2026-08-23)* **thay thế** `POST /media/presign` + `/media/confirm` của bản trước — ảnh lưu xuống ĐĨA nên upload một nhịp, xem 8.5. Chỉ `Moc.author`; mạch khoá ⇒ 403 `mach_bi_khoa`, mốc bia mộ/bị ẩn ⇒ 409 `noi_dung_da_go`, đủ 10 ảnh ⇒ 409 `qua_nhieu_anh`, ảnh >8MB ⇒ **413** `anh_qua_nang`, không nhận dạng được ⇒ 400 `anh_hong` / `dinh_dang_khong_nhan` / `anh_qua_lon`. **Mạch đã đóng sổ VẪN tải lên được** (5.1 chặn nối mốc mới, không chặn sửa mốc cũ). Một ảnh mỗi request — nhiều ảnh thì UI gửi tuần tự |
| `DELETE /anh/{id}` | gỡ một ảnh | *(Phase 5, 2026-08-23)* chỉ `Moc.author`. **Không có bia mộ cho ảnh**: hàng đi, **file cũng biến khỏi đĩa**. Trả về chính thẻ ảnh vừa xoá (không 204) để UI gỡ đúng ô khỏi gallery |
| `GET /users/{username}` | hồ sơ công khai | |
| **Admin (`/api/admin`, staff-only)** | reports queue, hide/lock/ban/unban, subs CRUD, audit log | router riêng; **chỉ truy cập được qua host admin — xem 8.2** |

**Bảng khu quản trị — `NinjaAPI` khoá `admin`, prefix `/api/admin`** *(Phase 4, 2026-08-22)*.
Mọi dòng dưới đây đòi session cookie của một tài khoản `is_staff` còn hiệu lực và chưa bị ban;
mọi request GHI đòi CSRF. Người lạ nhận **401 `chua_dang_nhap`**, người đã đăng nhập mà không
phải mod nhận **403 `khong_du_quyen`**, và request tới từ host không nằm trong `ADMIN_HOSTS`
nhận **403 `sai_host_quan_tri`** trước cả hai. TS client ở subpath `@gikky/api-client/admin`.

| Method & path | Việc | Ghi chú |
|---|---|---|
| `GET /admin/me` | mod đang đăng nhập là ai | cũng là chỗ **gieo cookie CSRF** cho app admin |
| `GET /admin/reports` | hàng đợi báo cáo, cursor keyset | `?trang_thai=cho_xu_ly\|da_xu_ly\|tat_ca` (mặc định `cho_xu_ly`), `?limit`, `?cursor`; mỗi dòng kèm ngữ cảnh của thứ bị tố |
| `POST /admin/reports/{id}/dong` | đóng báo cáo | `{hanh_dong: an\|khoa\|ban\|bo_qua}` — **chỉ ghi lại, không tự thi hành** |
| `POST /admin/mocs/{id}/an` | ẩn / gỡ ẩn mốc | `{an, ly_do?}`; idempotent. Mốc bị ẩn **giữ ô trên spine** (5.2) |
| `POST /admin/comments/{id}/an` | ẩn / gỡ ẩn bình luận | `{an, ly_do?}`; kéo theo `comment_count` trong cùng transaction |
| `POST /admin/machs/{id}/an` | ẩn / gỡ ẩn mạch | `{an, ly_do?}`; mạch ẩn ⇒ 404 ở mọi cửa công khai |
| `POST /admin/machs/{id}/khoa` | khoá / mở khoá mạch | `{khoa, ly_do?}`; **trục riêng, khác "đóng sổ"** (5.10) |
| `GET /admin/machs/{id}` | chi tiết mạch cho mod | kèm mọi mốc, **không che** nội dung đã ẩn — mod phải đọc để phán xử |
| `GET /admin/users/{username}` | hồ sơ tài khoản cho mod | trạng thái ban + số mạch + số bình luận |
| `POST /admin/users/{username}/ban` | ban | `{ly_do, vinh_vien?, den_khi?}` — **đúng một** trong hai; 409 nếu đích là chính mình hoặc một mod khác |
| `POST /admin/users/{username}/go-ban` | gỡ ban | idempotent |
| `GET /admin/subs` · `POST /admin/subs` | liệt kê (kèm `so_mach`) · tạo | slug phải ở dạng chuẩn, server **không** slugify hộ |
| `PATCH /admin/subs/{slug}` · `DELETE` | sửa `ten`/`mo_ta` · xoá | `slug` **không sửa được** (URL công khai); xoá chỉ khi sub rỗng, ngược lại 409 |
| `GET /admin/nhat-ky` | `AuditLog`, cursor keyset | `?action=` lọc **bằng đúng**; chỉ đọc — không có cửa ghi hay xoá |

OpenAPI schema xuất bằng management command **tự ghi file**, chạy từ **gốc repo**:

```
pnpm codegen                       # cách thường dùng: export + sinh TS client + hàng rào
node scripts/py.mjs export_openapi --output ../packages/api-client/openapi.json   # chỉ export
```

Nguồn cho codegen 8.3 (không curl server đang chạy). **KHÔNG dùng redirect `>`**: PowerShell 5.1
redirect ghi ra UTF-16/BOM, làm openapi-ts và bước kiểm drift vỡ — nên thiếu `--output` thì
command **ném `CommandError`** chỉ thẳng vào chuyện đó thay vì ghi ra stdout.
**Đường dẫn tương đối tính từ `api/`, KHÔNG phải từ gốc repo** — `scripts/py.mjs` spawn
`manage.py` với `cwd = api/`, nên cwd của tiến trình Python luôn là `api/` bất kể bạn đứng ở đâu
(đó là lý do có `../` trong lệnh trên). Command **từ chối** chứ không tự tạo thư mục cha, để
đường dẫn gõ nhầm không lặng lẽ đẻ ra `api/packages/...` — rác đó không nằm trong `.gitignore`.
Bảng trên là hợp đồng v1; plan con từng phase **được thêm** endpoint nhỏ nếu thiếu, nhưng phải
ghi vào plan con và cập nhật lại bảng này.

**Thêm một `NinjaAPI` mới (vd router admin ở dòng cuối bảng) thì phải làm ĐỦ 3 việc** — chi tiết
ở docstring `api/config/api_registry.py`:
1. mount vào `api/config/urls.py`;
2. đăng ký vào `api/config/api_registry.py::NINJA_APIS` — `export_openapi` chỉ xuất được API nó
   biết, quên bước này thì `pnpm codegen` vẫn exit 0 và sinh TS client thiếu sạch nhóm endpoint
   đó (hỏng im lặng, sẽ đẩy người viết frontend sang tự khai interface tay — đúng thứ 8.3 cấm);
3. thêm subpath vào `exports` của `packages/api-client/package.json` (`./src-<khoá>/index.ts`),
   **không được dùng wildcard `"./*"`** — wildcard mở lại đường import thẳng `client` singleton
   mà 8.3 cấm.

Mỗi việc một cái chuông chạy được: `api/tests/test_api_registry.py` (việc 1 có, việc 2 thiếu),
`pnpm codegen:check` (đăng ký rồi mà client không sinh ra, hoặc client mồ côi của khoá đã gỡ),
`scripts/rao-can-exports.mjs` (việc 3).

Mọi endpoint phải khai **`operation_id` tường minh**; thiếu nó, tên hàm trong TS client sinh ra
sẽ trôi theo tên hàm Python / theo route, và đổi tên hàm Python thành một breaking change của
frontend.

---

## 8. Kiến trúc kỹ thuật

### 8.1 Monorepo

```
gikky-net/
├─ api/                     # Django 5 + Ninja + Postgres
│  ├─ config/  core/  api/
│  └─ pyproject.toml        # pytest + pytest-django
├─ apps/
│  ├─ web/                  # Next.js (App Router) — public, xem 8.4
│  └─ admin/                # Next.js — admin TỰ BUILD (KHÔNG dùng Refine/React-Admin
│                           #   — quyết định của user 2026-08-21; đừng đề xuất lại)
├─ packages/
│  └─ api-client/           # TS client sinh từ OpenAPI (hey-api/openapi-ts) — KHÔNG sửa tay
├─ docs/mockup-tham-khao.html   # chuẩn thẩm mỹ (9.1)
├─ docker-compose.dev.yml   # postgres:17 + minio (giả R2 local)
├─ plans/                   # plan con từng phase (quy trình 5 chặng)
└─ CLAUDE.md                # riêng repo: lệnh dev/build/test
```

pnpm workspace cho JS; Python venv riêng trong `api/`.

### 8.2 Same-origin qua reverse proxy — các chốt BẮT BUỘC

Dev: Next rewrites `/api/*` → `http://localhost:8000`. Prod: Caddy.

```
gikky.net/api/admin/*   → 403 CHẶN TẠI CADDY (trước rule proxy)   ← đừng quên
gikky.net/api/*         → Django
gikky.net/*             → Next web
admin.gikky.net/*       → allowlist IP → Next admin
admin.gikky.net/api/*   → allowlist IP → Django (kể cả /api/admin)
```

- **Chặn `/api/admin/*` trên host public** là lớp phòng thủ hạ tầng — thiếu nó, API admin lộ
  internet và chỉ còn mỗi permission staff che chắn.
- **Django admin nằm ở `/api/admin/django/`** (chốt Phase 0): `admin.site.urls` kết thúc bằng
  catch-all, mount thẳng ở `/api/admin/` là nuốt sạch prefix mà router Ninja admin cần. Vì nó
  vẫn nằm TRONG `gikky.net/api/admin/*` nên luật 403 ở trên phủ luôn cả nó — **không phải thêm
  luật Caddy nào**. Đây là lý do không tách ra `/api/dj-admin/`: mỗi prefix mới là một luật
  Caddy nữa phải nhớ, quên một cái là lộ form đăng nhập Django admin ra internet.
- **Cookie cross-subdomain:** prod đặt `SESSION_COOKIE_DOMAIN=".gikky.net"`,
  `CSRF_COOKIE_DOMAIN=".gikky.net"`,
  `CSRF_TRUSTED_ORIGINS=["https://gikky.net","https://admin.gikky.net"]`;
  dev thêm `"http://localhost:3000","http://localhost:3001"`. Thiếu các dòng này thì POST từ
  admin (và từ dev) ăn 403 CSRF — đây là lỗi sẽ gặp NGAY Phase 2 nếu bỏ qua.
- **Không JWT** — mọi lý do "cần JWT" ở giai đoạn này đều là tách domain sớm không cần thiết.
- **KHÔNG có ngoại lệ CORS nào.** *(sửa 2026-08-23 — dòng cũ nói "ngoại lệ duy nhất:
  presigned PUT lên R2/minio (8.5)")*. Ngoại lệ ấy tồn tại vì upload đi thẳng lên bucket,
  tức một origin thứ hai. Ảnh nay lưu xuống đĩa và upload là `POST` multipart vào chính
  Django qua `/api/*` — same-origin ở cả dev (rewrites) lẫn prod (Caddy). Bớt được một bề
  mặt, và bớt luôn một thứ phải cấu hình đúng ở nơi không ai kiểm được từ repo.

### 8.3 Type một chiều: Ninja → OpenAPI → TS

`pnpm codegen` = script **Node** (cross-platform, không cú pháp bash trong package.json):
gọi `manage.py export_openapi` ra file → chạy openapi-ts → ghi `packages/api-client`.
CI kiểm drift: sinh lại rồi `git diff --exit-code`. **`.gitattributes` ép `* text=auto eol=lf`
ngay Phase 0** — không có nó, CRLF Windows vs LF CI làm bước kiểm drift báo giả 100%.
Frontend **cấm** tự khai interface trùng với API.

### 8.4 Render & cache — cơ chế đã chốt (điểm dễ làm sai nhất, đọc kỹ)

Face phụ thuộc viewer, mà App Router hễ đọc `cookies()` là cả route thành dynamic — **không
tồn tại** kiểu "cùng route, khách ăn ISR, người đăng nhập ăn dynamic" một cách tự nhiên.
Cơ chế chốt:

1. **Middleware Next** kiểm tra *sự tồn tại* của session cookie (không validate):
   - **Không cookie** → rewrite nội bộ sang biến thể route **ISR** (`/m/[slug]/(anon)`):
     fetch Django không kèm cookie, face tính thuần luật thời gian (đúng 5.5 cho khách + bot).
   - **Có cookie** → biến thể **dynamic no-store**: forward cookie, Django trả face per-user.
2. **ISR:** revalidate nền **1 giờ** (bắt cú flip BÃO→CẶN do 72h trôi và comment mới trên
   trang nguội — hai sự kiện KHÔNG có signal) **cộng** on-demand revalidate cho sự kiện có
   signal: tạo/sửa/xoá Moc, Trich, đóng/mở/khoá mạch.
3. **On-demand revalidate từ Django:** bọc trong `transaction.on_commit(...)` (gọi trong
   signal trần sẽ fetch phải dữ liệu CHƯA commit — cache đúng bản cũ, heisenbug); timeout 1–2s,
   fire-and-forget + log lỗi, không raise vào request người dùng; secret qua **header**
   `x-revalidate-secret` (query string nằm lại access log 2 tầng proxy); URL gọi **nội bộ**
   `http://localhost:3000/...` (gọi qua `gikky.net/api/...` sẽ bị Caddy nuốt sang Django).
4. **Dữ liệu per-user trên trang cached** (vote của tôi, đã theo chưa, vạch mới): client
   component gọi `GET /machs/{id}/me` — tuyệt đối không nướng vào HTML cache.

### 8.5 Media (Phase 5) — **ảnh lưu xuống ĐĨA** (chốt lại 2026-08-23)

> Mục này đã được **viết lại**. Bản trước thiết kế cho R2/minio (hai nhịp presign →
> PUT → confirm). Phase 5 kẹt vì thiết kế ấy đòi R2 hoặc minio, mà máy dev không có
> Docker và chưa có tài khoản lưu trữ nào. **User chốt 2026-08-23: lưu thẳng xuống đĩa,
> cả dev lẫn VPS, chưa cần dịch vụ.** Plan con: `plans/2026-08-23-phase-5-anh-local.md`.

**Lưu:** `STORAGES["default"]` = `FileSystemStorage`, `MEDIA_ROOT` đọc từ env (dev
`api/media/`, VPS một thư mục **ngoài cây mã nguồn** — `git pull` không được xoá ảnh của
người dùng), `MEDIA_URL = /media/`. Đổi sang R2 sau này là đổi **một khối `STORAGES`**,
không đụng đường ghi: `core/anh_luu.py` chỉ nói chuyện qua API storage của Django.

**Phục vụ:** dev qua Django `static()` + `rewrites` của Next; **prod Caddy đọc thẳng từ
đĩa, KHÔNG qua Django** (`handle_path /media/*` + `file_server`, kèm `nosniff` và
`Content-Security-Policy: default-src 'none'; sandbox`). Xem `deploy/Caddyfile`.

**Ba chỗ lệch so với bản trước, mỗi cái có lý do:**

1. **MỘT nhịp, không phải hai.** `POST /mocs/{id}/anh` nhận multipart thẳng vào Django.
   Hai nhịp tồn tại *chỉ vì* server không cầm được file; server cầm được rồi thì lý do
   đó mất. Cột `MocAnh.status` **giữ lại** và đặt `confirmed` ngay — nó là chỗ hai nhịp
   quay về khi có R2.
2. **SERVER đọc EXIF `DateTimeOriginal`**, từ file gốc, trước khi tái mã hoá — không phải
   client đọc bằng exifr rồi gửi kèm. Đáng tin hơn hẳn: không phụ thuộc client trung
   thực, không có chuyện hai bên bất đồng về cùng một tấm ảnh. Nghiệm thu đổi thành
   *"server đọc đúng `DateTimeOriginal` từ file gốc, và ảnh đã lưu KHÔNG còn EXIF"*.
3. **Thumbnail sinh ĐỒNG BỘ** lúc upload, không queue job cron. Job queue được thiết kế
   cho R2 nơi server phải tải file về mới resize được; server đang cầm ảnh trong RAM thì
   một lần `resize` rẻ hơn hẳn việc dựng và trông một hàng đợi — và nó xoá luôn trạng
   thái trung gian "ảnh đã lên nhưng chưa có thumb" mà UI sẽ phải biết vẽ.

**Bảy phép kiểm ở cửa nhận file** — đây là bề mặt nhận dữ liệu từ internet, phần đắt nhất
của phase. Đầy đủ ở `api/core/anh.py`; tóm tắt: ① trần byte chặn TRƯỚC khi đọc gì ·
② nhận dạng bằng **nội dung**, không bằng tên file hay `Content-Type` (cả hai do client
gửi) · ③ **allowlist** JPEG/PNG/WebP (không GIF, không SVG — SVG là XML và chạy script) ·
④ kiểm `w×h` từ header, chống bom giải nén · ⑤ **TÁI MÃ HOÁ mọi ảnh** — thứ vô hiệu hoá
file đa định dạng (polyglot) và xoá sạch EXIF cùng lúc · ⑥ tên file **uuid4**, đuôi suy
từ định dạng đã nhận dạng · ⑦ trần 10 ảnh/mốc enforce **trong khoá hàng `Moc`** (đếm
ngoài khoá là lỗi `L11`).

**Xoá và bia mộ.** `DELETE /anh/{id}` xoá hàng **và file** — không bia mộ cho ảnh. Mốc
thành bia mộ / bị mod ẩn thì ảnh **được chuyển sang một kho cách ly** (`MEDIA_AN_ROOT`,
nằm NGOÀI `MEDIA_ROOT`) chứ không chỉ biến khỏi API: Caddy phục vụ file không qua Django,
nên ẩn ở tầng API một mình để nguyên URL cũ sống mãi. Đảo ngược được (mod bỏ ẩn ⇒ file
về chỗ cũ, URL cũ sống lại). Kèm `manage.py don_anh_mo_coi --dry-run` dọn file mồ côi.

**Sao lưu đổi câu chuyện:** từ đây có trạng thái **ngoài database**, nên `pg_dump` một
mình không còn là bản sao lưu đủ — `docs/sao-luu-phuc-hoi.md`.

**Không còn ngoại lệ CORS nào** (xem 8.6): upload là same-origin.

### 8.6 Môi trường máy dev (Windows 11 — máy hiện tại của user)

- Python 3.12 user-install **không có trên PATH** — tạo venv bằng đường dẫn tuyệt đối:
  `"C:\Users\Ng Xuan Mui\AppData\Local\Programs\Python\Python312\python.exe" -m venv .venv`
  (gõ `python` trần trúng stub Microsoft Store).
- Repo: `D:\Projects\gikky-net` (đã tạo, trống). `git init` ở Phase 0.
- Ports dev: web 3000 · admin 3001 · api 8000 · postgres 5432 · ~~minio 9000/9001~~
  (**Phase 5 không dùng minio nữa** — ảnh lưu xuống đĩa, xem 8.5; hai cổng ấy chỉ còn
  nghĩa nếu một ngày quay lại object storage).
  Windows + Hyper-V thỉnh thoảng chiếm sẵn port sau reboot (EACCES khó hiểu) — lệnh chẩn đoán
  ghi vào CLAUDE.md repo: `netsh interface ipv4 show excludedportrange protocol=tcp`.
- Docker Desktop cần chạy cho compose; chưa cài thì báo user, đừng tự cài.

---

## 9. UI spec

### 9.1 Ngôn ngữ thị giác — "mực và dấu"

Chuẩn thẩm mỹ: **`docs/mockup-tham-khao.html` trong repo** (mở bằng trình duyệt — Phase 0
kiểm tra file đã nằm đó). Lưu ý: file này là mockup bố cục CŨ (trước khi chốt hai mặt) —
chỉ dùng làm chuẩn **màu / chữ / chất liệu**, KHÔNG dùng làm chuẩn layout; layout theo 9.2.

- Nền giấy lạnh `#F1F2F5` / tối `#0E1116`; mực `#14161B` / `#E7EAF0`; nhấn xanh mực `#3A46A8`
  / `#8B99F2`; **hoàng thổ `#B07A2B` / `#D8A455` dành riêng cho những gì mang tính "đóng dấu"**:
  vạch mới, "đã sửa", trích vào sổ, số mốc chưa xem trên spine, **nhãn "ĐÃ ĐÓNG SỔ" trên
  thẻ feed, nhãn "DRAFT" của `/luat`, chỉ số "Được trích ×N" trên hồ sơ** *(ba cái sau chốt
  2026-08-22)*. **Danh sách này là NGUỒN của allowlist trong `e2e/don-vi/mau-token.spec.ts`** —
  hàng rào phải suy từ đây, không được tự nới. **Xanh `#1C7A4F` / đỏ `#B33A2B`
  CẤM dùng trang trí** — chỉ được xuất hiện ở con số lãi/lỗ.
- Chữ: Newsreader (tiêu đề mạch) · Be Vietnam Pro (UI) · IBM Plex Mono (mọi timestamp + con số,
  `tabular-nums` — mốc phải *trông như biên lai*).
- Hai chất liệu: **sổ nghiêm** (card viền cứng, mono, dải figures) vs **khán đài xuề xòa**
  (avatar, bo tròn, placeholder kiểu "Chém gió với chủ mạch…") — tương phản là chủ đích:
  giao diện phát tín hiệu "ở đây được đùa", sự lôi thôi của khán đài tôn cái nghiêm của sổ.

### 9.2 Wireframe chuẩn (mobile-first)

**Mặt BÃO:**
```
┌──────────────────────────────────────────────┐
│ Nhật ký lệnh HPG …        u/ba_muoi_phien    │
│ ①──②──③──④──⑤──⑥──⑦──⑧──◉⑨   ← spine ghim │
│   (số mốc chưa xem: màu hoàng thổ)           │
│ ┌──────────────────────────────────────────┐ │
│ │ ⑨ 21/08 · tổng kết          ▲ 412       │ │ ← chỉ mốc mới nhất
│ │   …  [mở cả mạch ▾]        💬 7          │ │    mở sẵn; bung ra
│ └──────────────────────────────────────────┘ │    thì có vạch mới
│ ✎ [ Mốc 9 vừa đóng sổ — bạn rút ra gì? ]     │ ← mồi theo trạng thái
│ 📈 12 · 🔥 9                (react 1 chạm)   │
│ Sắp xếp: [Hay nhất ▾]                        │
│ ● cây khán đài đầy đủ, chip ‹mốc N›,         │
│ │  reply lồng ≤6 tầng, badge [CHỦ MẠCH] …    │
└──────────────────────────────────────────────┘
```

**Mặt CẶN:**
```
┌──────────────────────────────────────────────┐
│ MẠCH ĐÃ ĐÓNG · +18.2% · 163 ngày · 9 mốc     │ ← "+18.2% · 163 ngày"
│ ① 04/03 vào lệnh …            ▲89    💬 7   │    = Mach.ket_qua
│   ╭─ ngăn kéo (bấm 💬): lát cắt cũ→mới ─╮    │   (ẩn khi NULL)
│   ╰─────────────────────────────────────╯    │
│ ▤ Mốc 2–6 · 5 mốc · 43 bình luận             │
│   ❝ "DCA lúc này là tự sát" +28 ❞  ← mồi bung│
│ ⑦ … ❝trích: "SL theo MA20?" — @hai_lua,     │
│        viết 10/06, trích 21/08❞              │
│ ⑨ 21/08 tổng kết …                           │
│ 💬 247 bình luận · [xem các câu đáng đọc ▾]  │ ← bấm: bung khán đài
│    (bung: khán đài đủ 3 sort + composer cuối)│    đầy đủ tại chỗ
└──────────────────────────────────────────────┘
```

### 9.3 Admin (tự build, tối giản)

Màn hình v1, theo thứ tự ưu tiên: (1) hàng đợi Report — bảng, xem ngữ cảnh, nút ẩn/khoá/ban
ngay trên hàng; (2) tra cứu mạch/user + trang chi tiết với hành động mod; (3) Sub CRUD;
(4) Audit log (bảng đọc). Django admin mặc định giữ làm cửa hậu — không tốn công gì.

---

## 10. Phases

Mỗi phase = một hoặc vài plan con trong `plans/`, chạy đủ 5 chặng theo `D:\Projects\CLAUDE.md`.
Xong phase nào chạy được demo phase đó — không gộp.

### Phase 0 — Skeleton (S)
Monorepo 8.1; `.gitattributes` (eol=lf); docker-compose dev (postgres + minio, kèm CORS minio);
Django boots + healthcheck; 2 app Next boots; `manage.py export_openapi` + codegen Node script
chạy; pytest + eslint xanh; chép `docs/mockup-tham-khao.html` (file do user cung cấp — nếu
chưa có trong repo thì hỏi user, đừng tự chế); `CLAUDE.md` repo với lệnh dev + ghi chú port 8.6.
**Nghiệm thu:** `docker compose -f docker-compose.dev.yml up -d` rồi 3 lệnh dev chạy song song
không lỗi; `pnpm codegen` sinh client từ schema thật, chạy lần 2 không tạo diff; `pytest`
0 fail 0 warning.

> **Cập nhật 2026-08-21:** máy dev không cài Docker (user chốt). Phần `docker compose up` của
> nghiệm thu Phase 0 **HOÃN tới khi có Docker** — chưa ai chạy, không được coi là đã nghiệm thu.
> Dev dùng PostgreSQL 17 local ở `127.0.0.1:5432`; ba lệnh dev song song ĐÃ đo. Lần đầu có Docker
> phải `docker pull` xác minh tag image minio/mc đang ghim trong compose (ghim theo phỏng đoán).

### Phase 1 — Lõi dữ liệu + trang đọc mặt CẶN (L)
Toàn bộ models mục 6 (kể cả MocAnh, trường moderation — build sẵn cột, tính năng dùng sau);
seed command: 2 sub, 1 mạch HPG 9 mốc đã đóng (`ket_qua="+18.2% · 163 ngày"`, figures ở mốc
1 và 9, question_for_crowd ở 1 mốc, 24 bình luận có cây + anchor, 1 Trich ở mốc 7, điểm vote
rải để top-10 wilson có nghĩa), 1 post thường; API đọc (feeds, mach detail, comments 3 sort,
moc comments, revisions); `/m/[slug]-[id]` SSR mặt CẶN; footer disclaimer + trang `/luat`
draft (5.10); hồ sơ user; 2 feed; JSON-LD + sitemap; light/dark.
**Nghiệm thu (checklist phần tử, không so ảnh):** banner đủ thành phần và ẩn `ket_qua` khi
NULL (test cả 2 seed); mốc 1 + dải gập "5 mốc · N bình luận" + 2 mốc cuối; mồi bung = comment
điểm cao nhất trong dải gập; blockquote trích hiện ĐỦ 2 dấu thời gian; ngăn kéo mở đúng lát
cắt cũ→mới; chân trang bung khán đài với 3 sort đổi qua URL param + composer cuối; sort
`hay_nhat` có test chứng minh hệ số tươi đổi thứ hạng và test path-race (2 reply đồng thời
không trùng path) — mọi test mới đều THỬ PHÁ theo luật repo; Lighthouse SEO ≥ 90; JSON-LD
hợp lệ (validator schema.org).

### Phase 2 — Tài khoản + viết (L)
allauth headless (email + Google, mount dưới `/api/` — 7; CSRF_TRUSTED_ORIGINS dev — 8.2);
đăng bài, nối mốc (rate 3/ngày VN có test, test múi giờ occurred_at), sửa mốc (revision đủ 5
trường, diff hiện đổi occurred_at), xoá (bia mộ), đóng sổ + ket_qua + mở lại; comment (khán
đài + ngăn kéo, anchor nullable đúng 5.4), sửa/xoá comment, vote (transaction cập nhật
up/down/score), reaction. **Trang mạch cho mạch open ở phase này tạm dùng layout CẶN bỏ
banner** — mặt BÃO là việc của Phase 3, đừng tự chế trước.
**Nghiệm thu (E2E Playwright, checklist):** đăng ký → đăng bài → nối mốc 2 → spine + ngăn kéo
xuất hiện (định nghĩa "UI mạch bật"); user B comment trong ngăn kéo mốc 1 → hiện đúng cả 2
ống kính, vote từ ngăn kéo đổi số ở khán đài; mốc thứ 4 trong ngày VN bị chặn kèm thông báo;
sửa mốc sau 15ph tạo revision xem được diff gồm ngày; gỡ chip anchor → comment không nằm
trong ngăn kéo nào; POST từ dev origin không dính 403 CSRF.

### Phase 3 — Mặt BÃO + vòng lặp quay lại (M)
Cơ chế render 8.4 ĐỦ 4 điểm (middleware tách anon/logged-in, ISR 1h + on-demand qua
on_commit, `/machs/{id}/me`); face 5.5 + toggle `?view=`; spine + peek + đánh dấu chưa xem;
composer mồi theo trạng thái; follow + vạch mới + seen; notification (dedupe ngày VN) +
chuông poll; trích vào sổ đủ 4 rào (partial unique); email mốc mới.
**Nghiệm thu:** mạch seed nguội: khách ẩn danh nhận bản ISR mặt CẶN (xác nhận qua header
cache), follower nhận BÃO (2 test); trích vào sổ trên mạch nguội → bản anonymous cập nhật
≤10s (đo pipeline on-demand thật — KHÔNG đo bằng đăng mốc, vì đăng mốc xong mạch thành BÃO
dynamic, test sẽ pass rỗng); 2 mốc cùng ngày VN → 1 notification (test cả biên 23:50/00:10 —
chấp nhận 2 thông báo, ghi rõ chủ đích); trích mốc đã có trích hiệu lực bị chặn, gỡ rồi trích
lại được; vạch mới hiện đúng vị trí sau "mở cả mạch".

### Phase 4 — Admin + moderation (M)
App admin tự build (9.3): staff login, report queue + ẩn/khoá/ban (dùng các cột đã có từ
Phase 1), tra cứu, sub CRUD, audit log; shadow-limit 5 bình luận/giờ cho tài khoản <3 ngày;
chặn `/api/admin` ngoài host admin (8.2 — dev mô phỏng bằng middleware kiểm Host).
**Nghiệm thu:** user thường gọi `/api/admin/*` từ origin public nhận 403 (test cả tầng
permission lẫn tầng host); report → queue → ẩn → biến khỏi public nhưng tác giả thấy kèm
nhãn; mạch khoá: đọc được, mọi POST tương tác bị chặn; user bị ban thấy lý do khi đăng nhập;
mỗi hành động 1 dòng AuditLog.

### Phase 5 — Ảnh, lưu LOCAL (M) *(viết lại 2026-08-23)*
Flow 8.5 bản đĩa: `POST /mocs/{id}/anh` multipart một nhịp; **bảy phép kiểm** ở cửa nhận
file; server đọc EXIF từ file gốc rồi **tái mã hoá** (xoá sạch EXIF, vô hiệu hoá polyglot);
thumbnail đồng bộ; trần 10 ảnh/mốc enforce **trong khoá hàng `Moc`**; `DELETE /anh/{id}`
xoá cả file; ảnh của mốc bia mộ / bị ẩn **chuyển sang kho cách ly**; gallery trong thẻ mốc
+ ô chọn ảnh ở cả ba form ghi; Caddy phục vụ `/media/*`; sao lưu gồm cả ảnh.
Không còn minio, không còn CORS.

**Nghiệm thu:** ảnh có EXIF → **server** đọc đúng `DateTimeOriginal` từ file gốc **và**
ảnh đã lưu KHÔNG còn EXIF; ảnh 8MB xử lý ≤5s local; ảnh thứ 11 bị từ chối **kể cả khi
double-click** (trần giữ dưới đua); `.php`/`.html`/`.svg` đổi đuôi `.jpg` bị từ chối và
polyglot JPEG+HTML bị tái mã hoá thành vô hại; bom giải nén bị chặn ở header; user B
không tải/xoá được ảnh của mốc user A; xoá ảnh ⇒ **file biến khỏi đĩa**; mốc bia mộ/bị ẩn
⇒ ảnh rời cả API lẫn kho đang phục vụ; trang mạch có ảnh Lighthouse Performance ≥ 80
mobile *(chưa đo — cần `pnpm lighthouse`, xem "còn nợ" ở plan con)*.

### Phase 6 — Polish ra mắt (M)
OG card tự sinh mỗi mạch (title + ket_qua + spine — ảnh để user khoe lên Facebook, kênh phát
tán chính); email digest (8:00 thứ Bảy VN); RSS mạch; rate-limit chống spam: **đăng ký
≤5/IP/ngày, đăng bài ≤10/user/ngày** (đổi số được trong settings); backup Postgres tự động;
trang 404/500.
**Nghiệm thu:** paste link mạch vào trình xem OG → card đúng title + ket_qua; digest gửi
đúng 8:00 thứ Bảy VN trên seed (giả lập đồng hồ); vượt rate → lỗi đúng, dưới rate → không
chặn oan; script backup chạy + restore thử thành công.

**Chưa làm sau v1 (đừng lấn):** PWA/offline, app native, fields cấu trúc theo sub, đồng tác
giả, search (mọi mức), websocket, mention.

---

## 11. Ngoài phạm vi agent thực thi

Việc của user, agent không tự làm: mua/trỏ tên miền, chọn hosting prod + deploy lần đầu,
viết 30–50 bài/mạch mồi, mời thành viên sáng lập, duyệt bản cuối `/luat`, mọi việc pháp lý.

## 12. Số đo thành công sản phẩm (user theo dõi, không phải việc của agent)

- **Tỷ lệ quay lại tuần 2** — chỉ số duy nhất đáng nhìn 3 tháng đầu (không phải số đăng ký).
- % post trở thành mạch (≥2 mốc); % mạch có bình luận trước mốc 2; % mạch mở có mốc mới
  trong 14 ngày; traffic organic vào mặt CẶN.
