# Tách bình luận CHUNG khỏi bình luận MỐC — khán đài không trộn

Chốt 2026-08-26, lời user nguyên văn: *"nên có 1 phần cmt chung cho toàn bộ post, không lẫn
cmt của các mock vào, từng mock có cmt riêng thì cứ kệ nó, không trộn chung các mock vào
cmt chung của post"*.

**Mở rộng cùng ngày (chốt sau khi chặng 2 đã khởi động — §F):** *"nếu có reply mới thì
nổi lên và hiển thị theo đúng chiều đọc hội thoại"* — sort `moi_nhat` bump thread theo
hoạt động mới nhất, reply trong thread đọc xuôi cũ → mới.

## Quyết định sản phẩm

- Khu **"Bình luận"** cuối bài (khán đài) chỉ chứa thread có bình luận GỐC
  `anchor_moc_seq IS NULL` — bình luận về **cả bài**.
- Thread neo mốc N sống **duy nhất** trong ngăn kéo mốc N. Không còn render lại ở khán đài.
- Điều này **thay** mô hình cũ của PLAN 5.4 ("ngăn kéo là cửa sổ chiếu vào khán đài"):
  ngăn kéo nay là **phòng**, không phải cửa sổ. PLAN 5.4 luật 2 vế "render tối đa 2 tầng
  reply" chết theo (xem §C1) — vì nhà duy nhất của thread không được cụt hơn nhà cũ.

**Hệ quả phải chấp nhận, nói trước:**
- `tong_thread` / "N cuộc trao đổi" của khu chung nay đếm **chỉ thread chung** — sẽ nhỏ hơn
  hẳn `comment_count` ở chân trang (đếm cả bài). Hai con số đo hai thứ khác nhau, đúng chủ đích.
- ~~Mồi bung của dải gập (`chonMoiBung`) lấy từ trang 1 `hay_nhat` — pool nay chỉ còn thread
  chung, teaser nghèo đi hoặc biến mất (component đã xử lý `null`). Chấp nhận ở lượt này.~~
  **Sửa 2026-08-27 (§G):** thực tế đo được là **chết hẳn**, không phải nghèo đi — luật chọn
  đòi `anchor_moc_seq` trỏ vào mốc trong dải, mà pool khán đài mới toàn thread KHÔNG neo:
  hai điều kiện loại trừ nhau, mồi bung `null` ở MỌI mạch có dải gập. Giết một tính năng
  của PLAN không nằm trong yêu cầu của user ⇒ nối lại nguồn, xem §G.
- Bình luận CHUNG bị neo nhầm mốc từ thời "neo tự động" (vd #37 trên mạch HPG dev) sẽ nằm
  trong ngăn kéo mốc đó. **Không migrate data** — không đoán được ý người viết.

## Phạm vi sửa

### A. Django — lọc ở tầng đọc khán đài

1. `core/doc_noi_dung.py`: thêm hàm lọc đặt CẠNH `lat_cat_ngan_keo` (đối xứng — cùng một
   phép chiếu, hai giá trị của cùng một khoá):
   ```python
   def goc_khong_neo(cay: list[Nut]) -> list[Nut]:
       return [n for n in cay if n.binh_luan.anchor_moc_seq is None]
   ```
2. `api/machs.py::liet_ke_binh_luan_mach` (nhánh THƯỜNG, sau `dung_cay_theo_sort`, trước
   `_cat_goc`): áp `goc_khong_neo` **chỉ khi `mach.entry_count >= 2`**.
   - Vì sao có điều kiện: **post thường không có ngăn kéo** (PLAN 5.1) — lọc ở đó là bình
     luận neo mốc 1 (di sản thời composer neo tự động, prod ĐÃ có thể có) biến mất khỏi
     **mọi** chỗ hiển thị. Post thường giữ nguyên hành vi cũ; khi nó nối mốc 2 thành mạch,
     bình luận neo tự dọn vào ngăn kéo mốc tương ứng — tiến hoá nhất quán.
   - `tong_thread = len(goc đã lọc)`; phân trang (`_cat_goc`) chạy trên danh sách đã lọc —
     keyset `(created_at, id)` không đổi tính chất.
3. Nhánh `?dang_doc=1` **GIỮ NGUYÊN** (tính trên mọi gốc): khối đang TẮT
   (`HIEN_KHOI_DANG_CHU_Y = false`), hợp đồng có bài đo riêng (`test_api_cau_dang_doc.py`).
   Ghi chú vào docstring endpoint: ngày bật lại khối này phải quyết lại tập nguồn của nó.
4. `GET /mocs/{id}/comments` (ngăn kéo) **không đổi**.
5. Docstring endpoint đổi ⇒ `pnpm codegen` + `pnpm codegen:check` sạch.

### B. Frontend — composer khu chung mặc định KHÔNG neo

1. `trang-mach.tsx`: bỏ `anchorMocSeq={moc_moi_nhat?.seq ?? null}` ở **cả hai** chỗ
   (composer mặt BÃO ~dòng 455 và `<KhanDai anchorMocSeq=…>` ~dòng 475) — mặc định `null`.
   Ai muốn gửi vào mốc từ ô chung vẫn chọn được qua select "Neo vào" — và câu đó sẽ hiện
   trong ngăn kéo, KHÔNG hiện ở khu chung (nói bằng chính cái select, không cần copy thêm).
2. Post thường không cho neo: `KhanDai` nhận prop `neoDoiDuoc` (trang-mach truyền
   `la_mach`), composer mặt BÃO chỉ render khi `la_bao` (mà BÃO đòi `entry_count >= 2` —
   kiểm lại `matDeRender`; nếu BÃO có thể xảy ra ở post thường thì cũng truyền theo).
   Select "Neo vào" không render trên post thường.
3. Composer mặt BÃO: bỏ `moi={cauMoiComposer(...)}` (câu mồi nhắc "Mốc 9 vừa lên…" là
   câu của MỐC, sai ngữ nghĩa với ô chung) → placeholder mặc định. `cauMoiComposer` trong
   `lib/mat.ts`: xoá cùng test của nó, hoặc nếu còn chỗ dùng hợp lệ thì giữ — quyết trong
   diff, không để hàm mồ côi im lặng.
4. Prop `anchorMocSeq` của `KhanDai` bỏ hẳn (không còn ai truyền khác null).

### C. Ngăn kéo thành phòng thật

1. Độ sâu render ngăn kéo: `SAU_NGAN_KEO` (3) → dùng **`SAU_KHAN_DAI` (6)**, cùng con số
   với khán đài. Không còn "nhà đầy đủ" nào khác để "tiếp tục thread →" trỏ sang, nên nhà
   duy nhất phải sâu bằng nhà cũ. Hằng `SAU_NGAN_KEO`: xoá hoặc gán = `SAU_KHAN_DAI` kèm
   docstring — không để hai hằng kể hai câu chuyện.
2. `the-moc.tsx`: `BinhLuan` trong ngăn kéo bật **`datNeo`** — ngăn kéo nay là bản CHÍNH.
   Bất biến "mỗi bình luận đúng MỘT nút mang `data-binh-luan-id`/`id=bl-N`" **vẫn giữ**:
   mỗi thread render đúng một nơi (khán đài ⊕ ngăn kéo mốc của nó). Khối "Câu đáng đọc"
   (đang tắt) vẫn `datNeo=false` nên bật lại cũng không sinh trùng id.
3. Tiêu đề ngăn kéo `ngan-keo.tsx:124` ghi "cũ → mới" trong khi server sắp **mới → cũ**
   (`lat_cat_ngan_keo` gõ cứng `moi_truoc=True` từ 2026-08-26) — nhãn phải khớp dữ liệu.
   **§F đổi luật sắp thành "bump theo hoạt động + reply cũ→mới"**, một câu nhãn ngắn không
   tả nổi hai chiều ⇒ **bỏ hẳn hậu tố chiều**: tiêu đề còn "Bình luận neo vào mốc N".
   Docstring luật 2 đầu file sửa theo luật MỚI của §F, không chép lại chiều cũ.
4. **Tự mở ngăn kéo theo hash**: `NganKeoProvider` thêm effect (mount + `hashchange`):
   hash `#bl-N` mà phần tử đích nằm trong `#ngan-keo-<seq>` ⇒ `datDangMo(seq)` rồi
   `scrollIntoView`. Không JS ⇒ như cũ (ngăn kéo đóng) — chấp nhận, ghi chú trong code.

### D. Deep-link khối trích

1. `trang-mach.tsx::id_trong_trang` = **hợp** của `idTrongTrang(hay_nhat.threads)` (khán
   đài, sâu ≤ 6) và id trong mọi lát cắt `lat_cat` (ngăn kéo, sâu ≤ 6). `lat_cat` đã nạp
   sẵn — không thêm lời gọi API nào.
2. Copy nhánh không nhảy được (`khoi-trich.tsx`): "nằm ở trang sau của khán đài" nay có
   thể sai (bình luận nằm sâu trong ngăn kéo chứ không ở trang nào của khán đài) — đổi
   thành câu trung tính, vd "bình luận này chưa nhảy tới được từ trang này". Tên trạng
   thái `"trang_sau"` trong code giữ nguyên (đổi tên là việc khác).
3. *(bổ sung 2026-08-27, chốt của phiên chính sau báo cáo chặng 2)* Phép hợp ở §D1 **tách
   thành hàm thuần** trong `lib/khan-dai.ts` (vd `idTrongTrangGop(hayNhat, latCat)`) để
   don-vi ghim được công thức — nó là hậu duệ trực tiếp của bài học B3/W7 ("trạng thái
   deep-link phải tính trên đúng tập trang sẽ render") và không được sống dưới dạng biểu
   thức inline không ai đo. Kèm bài don-vi THỬ PHÁ cả hai vế (thiếu khán đài / thiếu lát
   cắt đều phải đỏ).
4. *(cùng lượt chốt trên)* Hai bài V15 cũ của `mach-can.spec.ts` khẳng định "bình luận
   được trích nằm trong khán đài `hay_nhat`" — tiền đề chết theo mô hình mới. **Viết
   lại, không xoá trắng**: (a) vế "cuộn được" đo bằng ca thread CHUNG có bình luận được
   trích, nằm trang 1 `hay_nhat` ⇒ nút nhảy hiện + bấm xong phần tử vào viewport; (b) vế
   W7 ("tính trên trang mà link dẫn tới") KHÔNG dựng 51 thread trong e2e nữa — sức nặng
   dồn về bài don-vi của §D3 ghim công thức hợp; ca trích-vào-thread-neo đã có bài riêng
   ở `binh-luan-chung.spec.ts` (tiêu chí 9). Ghi rõ trong spec vì sao W7 teo lại: lát cắt
   ngăn kéo giống nhau trên mọi trang khán đài, phần biến thiên duy nhất còn lại là trang
   1 `hay_nhat` của thread chung.

### E. Dọn UI theo mô hình mới

1. Chip `‹mốc N›` trong `binh-luan.tsx` (data-testid `chip-neo`): **gỡ render**. Ở khán
   đài không còn ca nào hiện; trong ngăn kéo nó lặp lại tiêu đề ngay trên. Test đụng
   `chip-neo` cập nhật theo.
2. Copy trạng thái rỗng khán đài (`khan-dai.tsx`): "Chưa có bình luận nào — mời bạn nêu ý
   kiến." → **"Chưa có bình luận chung nào — mời bạn nêu ý kiến."** — vì `tong_thread === 0`
   nay xảy ra cả khi các mốc đầy bình luận, câu cũ thành nói dối ngay trên trang.

### F. Sắp xếp — bump theo hoạt động, reply xuôi chiều hội thoại (user chốt cùng ngày)

Áp cho **`moi_nhat` của khán đài** và **ngăn kéo** — hai cửa sổ phải cùng một luật.

1. **Khoá "hoạt động mới nhất" của một thread**: `max(created_at)` trên mọi nút **đọc
   được** (`hien_noi_dung`) trong cây con; thread toàn bia mộ (ca có thật, xem docstring
   `dung_cay`) rơi về `created_at` của GỐC. Bia mộ không được bump thread — thứ tự phải
   giải thích được bằng cái người đọc nhìn thấy (cùng nguyên tắc `Nut.up`/`Nut.down` đã
   theo). Tính **một lần** khi dựng cây (bottom-up trong `dung_cay` hoặc một lượt duyệt
   sau đó), không đệ quy lại trong mỗi phép so — `sorted` gọi khoá O(n log n) lần.
2. **`moi_nhat`**: gốc sắp `(hoạt_động DESC, id gốc DESC)`; **con sắp cũ → mới**
   (`sap_theo_thoi_gian(moi_truoc=False)`) — hội thoại đọc từ trên xuống theo thời gian.
3. **`cu_nhat`**: GIỮ NGUYÊN (gốc theo ngày mở ASC, con đã cũ→mới sẵn). Cố ý bất đối
   xứng: "Cũ nhất" nghĩa là "đọc từ đầu", không phải "im lặng lâu nhất lên trước" —
   ghi vào docstring.
4. **`hay_nhat`**: GIỮ NGUYÊN toàn bộ (rank gốc + sibling wilson thuần là chốt của PLAN
   5.3; user chưa đụng tới sort theo điểm).
5. **Ngăn kéo** (`lat_cat_ngan_keo`): gốc theo `(hoạt_động DESC, id DESC)` như khoản 2,
   con cũ → mới. Bỏ `moi_truoc=True` gõ cứng.
6. **Cursor keyset của `moi_nhat` phải đổi theo khoá sort** — không thì trang 2 lặp/sót:
   `ma_hoa_cursor(hoạt_động, id gốc)` và lọc `(hoạt_động(n), n.pk) < (khi, id)` trong
   `_cat_goc`. `cu_nhat` giữ khoá cũ `(created_at gốc, id)`. Hệ quả phải ghi nhận trong
   docstring `_cat_goc`: khoá hoạt động KHÔNG bất biến giữa hai lần gọi (reply mới đẩy
   thread vượt lên vùng đã đọc ⇒ sót; xoá reply mới nhất kéo thread tụt xuống ⇒ có thể
   lặp) — đó là tính chất cố hữu của bump-sort, chấp nhận, khác với lời hứa keyset cũ.
   Rà `test_phan_trang.py` + `test_keyset_khoa_bien_doi.py` theo hành vi mới.
7. Nhãn/chú thích đi kèm: `lib/khan-dai.ts::SORT_MAC_DINH` docstring đang tả `moi_nhat` là
   "ORDER BY (created_at, id) DESC" — cập nhật; nhãn "Mới nhất" trên UI giữ nguyên (vẫn
   đúng nghĩa). Tiêu đề ngăn kéo theo §C3 (bỏ hậu tố chiều).

### G. Mồi bung của dải gập — nối nguồn từ ngăn kéo *(bổ sung 2026-08-27)*

1. Nguồn của `chonMoiBung` đổi từ `hay_nhat.threads` (khán đài — nay không còn thread neo
   nào) sang **các lát cắt ngăn kéo của chính những mốc nằm trong dải gập** (`lat_cat` đã
   nạp sẵn trong `trang-mach.tsx` — không thêm lời gọi API). Về ngữ nghĩa còn ĐÚNG hơn
   trước: teaser trích một câu nói về đúng những mốc đang bị gập.
2. **LUẬT CHỌN giữ nguyên** (`lib/moi-bung.ts` + don-vi `moi-bung.spec.ts`): vẫn đòi neo
   trong dải, vẫn ưu tiên như cũ, vẫn loại trích. Chỉ đổi TẬP ĐẦU VÀO. Gộp thread từ nhiều
   ngăn kéo rồi để luật tự xếp.
3. Tiêu chí nghiệm thu bổ sung **(14)**: mạch có dải gập mà ngăn kéo của mốc trong dải có
   bình luận đọc được ⇒ mồi bung HIỆN (e2e); thử phá: cắt nguồn lát cắt ⇒ bài đo đỏ.

### H. Nợ tại HEAD cản trở kiểm chứng — xử lý trong lượt *(bổ sung 2026-08-27)*

`e2e/danh-tinh.ts` lệch với UI đã đổi ngay trong commit `ec47572` (ô đăng nhập
`o-dinh_danh`, nút tài khoản thêm chữ) ⇒ luồng tài khoản của `pnpm e2e` đỏ sẵn tại HEAD,
kéo theo không kiểm được các bài của lượt này (chúng cần đăng nhập). **Quyết định: nhận
bản vá 2 dòng vào diff của lượt** (helper phải khớp UI thật — đó là việc bảo trì bắt buộc
để bộ đo có nghĩa, không phải tiện tay), khai báo tách bạch trong báo cáo. Chip đã tạo cho
nợ này chỉ giữ lại nếu sau vá còn dư chấn.

**Mở rộng cùng lý lẽ (chốt 2026-08-27, sau lượt e2e 485/6):** dư chấn cùng loài vá nốt
trong lượt — `tai-khoan-va-ghi.spec.ts` M1 ×3 (4 vị trí `o-email` trong chính spec) và
`form-ghi` B7 (link "Đăng nhập" nay là button mở modal — đổi chủ đích của `ec47572`).
**RIÊNG `form-ghi` B1 KHÔNG vá spec khi chưa xác minh**: "markdown `**…**` không còn ra
`<strong>` trên thẻ mốc" có thể là HỒI QUY render thật của lượt Tiptap chứ không phải spec
cũ — vá spec cho khớp là hợp thức hoá một lỗi sản phẩm. Phải đọc đường render
(`ThanHtml` → nhánh markdown) + body seed mốc 1 HPG: là hồi quy thật ⇒ tạo chip riêng, B1
giữ đỏ trong phân rã với nhãn "hồi quy HEAD, có chip"; là đổi chủ đích có bằng chứng ⇒ vá
spec như các bài trên. `/luat` (trang-loi) giữ nguyên đỏ — chip `task_37e05c89` lo.

### KHÔNG đụng (nói tường minh để phản biện soi đúng chỗ)

- `hay_nhat` (rank gốc, sibling wilson, phân trang offset) — giữ nguyên (§F4).
- `cu_nhat` — giữ nguyên (§F3).
- `comment_count` của mạch, `so_binh_luan`/`dem_binh_luan_theo_moc` từng mốc — giữ nguyên.
- Đường ghi `viet_binh_luan` (kiểm neo, 400 reply-kèm-neo) — giữ nguyên.
- `docker-compose`, khu admin — không liên quan.

## Tiêu chí nghiệm thu (chấm ĐẠT/KHÔNG ĐẠT từng dòng)

Chạy trên seed dev (`seed_dev`), mạch HPG = mach 1 (15 thread: 14 neo mốc + 1 chung #14;
CỘNG các bình luận dev đã viết tay sau seed — nghiệm thu đối chiếu bằng `anchor_moc_seq`,
không bằng con số gõ cứng).

1. **API tách đúng**: `GET /api/v1/machs/1/comments?sort=moi_nhat` — mọi
   `threads[*].anchor_moc_seq === null`; `tong_thread` = đúng số thread gốc không neo
   (seed gốc: 1). Lặp cho `cu_nhat`, `hay_nhat`.
2. **Ngăn kéo không đổi**: `GET /api/v1/mocs/{id mốc 9}/comments` vẫn trả đủ các thread neo
   mốc 9 như trước diff (đối chiếu id).
3. **Post thường không lọc**: mạch `entry_count == 1` có bình luận neo mốc 1 (dựng trong
   test) ⇒ khán đài VẪN trả thread đó.
4. **`dang_doc` giữ nguyên**: `test_api_cau_dang_doc.py` xanh không sửa expectation (sửa
   thì phải nêu lý do trong báo cáo).
5. **Trang mạch render đúng** (e2e): khu `cay-khan-dai` chỉ chứa thread không neo; ngăn
   kéo mốc 9 chứa thread neo mốc 9; **không id `bl-N` trùng** và không
   `data-binh-luan-id` trùng trong toàn trang.
6. **Composer chung mặc định không neo**: mở composer khán đài ⇒ select "Neo vào" giá trị
   "cả mạch (không neo)". Gửi ⇒ bình luận hiện ở khu chung, không ở ngăn kéo nào. Chọn
   mốc rồi gửi ⇒ hiện trong ngăn kéo mốc đó, không ở khu chung. (e2e ghi thật qua API dev.)
7. **Ngăn kéo sâu 6**: thread neo có reply sâu 4–6 tầng (dựng trong test/seed e2e) render
   đủ trong ngăn kéo; tiêu đề ngăn kéo là "Bình luận neo vào mốc N" — KHÔNG hậu tố chiều
   (§C3 bản cập nhật; câu "mới → cũ" ở đây là chữ cũ sót, đã sửa 2026-08-27).
8. **Hash mở ngăn kéo**: điều hướng tới `/m/…#bl-<id bình luận neo>` ⇒ ngăn kéo chứa nó
   mở và phần tử vào viewport (e2e).
9. **Khối trích nhảy được**: mạch có trích trỏ vào bình luận thuộc thread neo mốc ⇒ nút
   "nhảy tới ↓" hiện (không rơi nhánh trang_sau) và bấm xong phần tử đích trong viewport.
10. **Bộ số toàn cục**: `pnpm test` xanh · `pnpm e2e` xanh · `pnpm lint` 0 warning ·
    `pnpm build` xanh · `pnpm codegen:check` sạch. Test MỚI nào thêm vào phải có bằng
    chứng THỬ PHÁ (sửa ngược code → đỏ → khôi phục) ghi trong báo cáo.
11. **Bump theo reply** (§F2): dựng mạch có thread A (gốc cũ, reply MỚI NHẤT) và thread B
    (gốc mới hơn A, không reply) ⇒ `sort=moi_nhat` trả A trước B. Xoá reply mới nhất của
    A (bia mộ hoá) ⇒ A tụt xuống sau B — bia mộ không bump.
12. **Reply xuôi hội thoại** (§F2, §F5): trong `sort=moi_nhat` VÀ trong ngăn kéo, `replies`
    của mọi nút sắp `created_at` TĂNG dần. Ca sẵn trên seed HPG: thread #3 phải ra
    `[#4 (09/02), #5 (10/07)]` với #6 lồng dưới #5; ngăn kéo mốc 2 phải ra thứ tự
    `[#3, #7]` (hoạt động 10/07 16:40 của #3 thắng gốc 10/02 của #7).
13. **Cursor `moi_nhat` theo khoá mới** (§F6): tạo >50 thread chung có hoạt động đan xen
    (reply làm khoá hoạt động ≠ khoá gốc), đi hết các trang bằng `cursor_ke_tiep` ⇒ hợp
    các trang = đúng tập, không lặp không sót (trong điều kiện dữ liệu đứng yên), và thứ
    tự nối trang đơn điệu giảm theo `(hoạt_động, id)`.

## §I. Kết quả hai chặng kiểm định + lượt sửa bổ sung *(2026-08-27)*

Nghiệm thu: **ĐẠT** (12/14 trọn; #14 và vế thử-phá-e2e của #10 thiếu bằng chứng). Phản biện:
1 NẶNG + 4 TRUNG BÌNH + 4 NHẸ. Quyết định của phiên chính cho từng phát hiện:

1. **[NẶNG 1 — SỬA, hồi quy của lượt] Deep-link vào bình luận neo nằm trong DẢI GẬP chết
   im lặng.** Effect mở được ngăn kéo nhưng dải gập bọc ngoài vẫn `hidden` (globals.css ép
   `display:none !important`), `scrollIntoView` thành no-op, và `daXuLy` vẫn bị đóng dấu
   nên không thử lại. **Tiêu chí 15 (mới):** điều hướng `#bl-N` (URL trực tiếp · hashchange
   · đổi query cùng route) với N neo mốc TRONG dải gập ⇒ dải tự bung + ngăn kéo tự mở +
   phần tử vào viewport — KHÔNG có cú bấm bung tay nào trong bài đo; cờ đã-xử-lý không
   được đặt khi đích còn `offsetParent === null`. Bài đo tiêu chí 9 hiện hành phải GỠ cú
   `dai-gap-nut.click()` đang che lỗi. Cơ chế: trạng thái bung của dải gập (cả mặt CẶN lẫn
   BÃO nếu dùng chung đường) phải với tới được từ effect deep-link — thiết kế cụ thể do
   người thực thi chọn, miễn tiêu chí 15 đo được và thử phá được.
2. **[TB 3 — SỬA] Gửi bình luận CÓ neo từ ô chung xong màn hình im lặng** (câu chui vào
   ngăn kéo đóng; khu chung còn in "Chưa có bình luận chung nào"). **Tiêu chí 16 (mới):**
   sau khi gửi với neo = mốc N ⇒ ngăn kéo mốc N mở và câu vừa gửi trong viewport (tận
   dụng cơ chế của tiêu chí 15). Bài va-v2 sửa lại để khẳng định hành vi TỐT thay vì
   khẳng định trạng thái im lặng. Chuông `bao_binh_luan`: nếu payload đã có comment id thì
   nối `#bl-<id>` vào link (hưởng cùng cơ chế); nếu phải đổi API thì KHÔNG làm trong lượt
   — mở chip.
3. **[TB 2 — SỬA] Docstring `liet_ke_binh_luan_moc`** còn tả "mới → cũ"/"cửa sổ chiếu vào
   khán đài" và đã ship vào JSDoc TS client — viết lại theo §F5 + §C, chạy `pnpm codegen`.
4. **[TB 4 — KHÔNG sửa trong lượt, treo quyết định] ~96% bình luận chuyển thành HTML
   `hidden`** — đổi hành vi SEO thật so với "mặt CẶN là mặt Google index" (PLAN mục 1).
   Không ai trong lượt này đủ thẩm quyền đánh đổi SEO; mở CHIP để user quyết (chấp nhận /
   bù bằng render tĩnh khác / đảo lại một phần). Ghi nhận: trước lượt, nội dung ngăn kéo
   cũng đã `hidden` — cái ĐỔI là phần khán đài không còn chứa bản hiện của thread neo.
5. **[TB 5 — KHÔNG phải lỗi] Lượt đổi màu trong cây là WIP đã nhận chủ của phiên
   gikky-net-8f** (globals.css · 2 module.css · og.ts · tuong-phan.spec.ts) — phản biện
   không có bối cảnh liên phiên. Xử lý duy nhất: commit stage CHỌN LỌC loại 27 mục của
   phiên khác (danh sách ở báo cáo nghiệm thu §0).
6. **[NHẸ 6/8/9 — SỬA chữ]** docstring `moi-bung.ts` kể nguồn cũ; docstring `hoat_dong`
   ghi thêm trade-off "reply sâu hơn 6 tầng vẫn bump (chấp nhận: 💬 N cũng đếm nó)"; chú
   thích `daXuLy` sửa cho đúng mức (hash không thuộc ngăn kéo thì không được đóng dấu —
   và sau NẶNG-1 thì luật đóng dấu đổi hẳn).
   **[NHẸ 7 — KHÔNG sửa hành vi]** link "tiếp tục thread →" ở đáy ngăn kéo tự trỏ về
   chính nút đang đứng (parity với quirk có sẵn của khán đài ở tầng 6) — ghi chú trong
   code + ở đây; sửa thật = trang permalink thread, việc khác.
7. **[Lỗ hổng quy trình] Thử phá spec trình duyệt:** mọi spec e2e MỚI của lượt (tiêu chí
   5, 6, 8, 9, 14, 15, 16) phải có bằng chứng thử phá — mẹo rẻ: dựng 2 server MỘT lần
   (đúng kỷ luật `DATABASE_URL → gikky_e2e`) rồi chạy `playwright test -g` lọc từng bài
   (reuseExistingServer ăn server đang sống). ⑪ (V3+C3) người làm đã khai — chạy lại xác
   nhận sau khi sửa.
8. **[Sổ sách]** manifest nhóm A ghi dôi `composer.tsx` (không sửa file đó) — đính chính
   ở báo cáo chốt.

## Vùng test phải rà (không phải danh sách đóng)

- Python: `test_api_khan_dai.py`, `test_cay_binh_luan.py`, `test_phan_trang.py`,
  `test_api_so_query.py` (số truy vấn KHÔNG được tăng — lọc in-memory),
  `test_seed_dev.py`, `test_api_ngan_keo.py`, `test_mat.py`.
- e2e: `mach-can.spec.ts` (đọc `data-ban-phu-binh-luan-id` của ngăn kéo — thuộc tính này
  ĐỔI thành `data-binh-luan-id` theo §C2), `khan-dai-va-dem.spec.ts`, `moi-bung.spec.ts`,
  `dai-gap.spec.ts`, `vo-reddit.spec.ts`, `phase-3.spec.ts`, `cache-mach.spec.ts`,
  `va-v2.spec.ts`, `seo-va-trang.spec.ts`.

## Ràng buộc môi trường cho người thực thi

- Cây làm việc đang có thay đổi CỦA PHIÊN KHÁC: `apps/admin/**` (+ `apps/web/e2e/don-vi/check-fx.spec.ts`,
  `scripts/bai-viet/`, `.gitignore`, `plans/2026-08-25-deploy-vps-docker.md`, `plans/2026-08-26-check-fx-admin.md`).
  **Không đụng, không "tiện tay" fix.** Lỗi lint/build phát sinh từ các file đó: ghi nhận
  trong báo cáo, không sửa.
- `pnpm e2e` chiếm cổng 3000 + 8000 và GHI vào `gikky_dev` — trước khi chạy phải chắc
  không còn dev server nào chiếm hai cổng đó.
- ⚠ **Bổ sung 2026-08-27, ràng buộc MẠNH HƠN dòng trên:** `gikky_dev` chứa bài THẬT của
  user (user chốt qua phiên gikky-net-8f: *"cho chạy, nhưng đổi DB khác"*) ⇒ **cấm
  `pnpm e2e` trần vĩnh viễn**. Mọi lượt e2e của việc này chạy trên DB nháp `gikky_e2e`
  qua `DATABASE_URL` đặt trong CÙNG một lệnh, có chốt `if DB ≠ gikky_e2e ⇒ dừng`. Bằng
  chứng không đụng — **ghi kèm MỐC GIỜ, vì con số chỉ đúng tại thời điểm đo**: vân tay
  md5 theo danh sách id 3 bảng, phiên 8f lập chuẩn "trước" (00:14:44), phiên chính đo
  "sau" lúc **02:22:35** — khớp 3/3 — rồi MỚI dựng dev server cho user vào xem. Lúc
  02:33:21 user gõ tay bình luận id 39 qua UI (phiên 3e đo lại 02:33:47 thấy
  `core_comment` +1 hàng, `core_mach`/`core_user` y nguyên từng bit — xác nhận hàng mới
  là NGƯỜI viết, không phải e2e rò). Bài học ghi thành luật: **e2e xong → đo "sau" →
  rồi mới mở cửa cho người dùng** — mốc "sau" mất giá trị chứng minh ngay khi có người
  dùng trang.
- Không commit (luật 3).

## CHỐT 2026-08-27

5 chặng đủ + 1 lượt sửa theo phản biện. Số cuối trên cây bàn giao: `pnpm test` 1495/0 ·
`pnpm e2e` **506 passed · 2 failed** (cả hai là nợ NGOÀI lượt: `/luat` force-dynamic —
chip `task_37e05c89`; `form-ghi` B3 flake proof-rỗng quanh Tiptap từ `64a99e5` — chip
`task_447e375a`, xanh 3/3 khi chạy riêng) · lint 0 warning · build 2/2 0 warning ·
`codegen:check` khớp · 16 tiêu chí ĐẠT (15–16 thêm ở §I, thử phá 7 lượt A–G cho spec
trình duyệt). Nghiệm thu: ĐẠT, tái lập đủ số. Phản biện: 1 NẶNG (đã sửa — tiêu chí 15)
+ 4 TB (2 sửa, 1 treo chip SEO `task_1ad8318f`, 1 là WIP phiên khác) + 4 NHẸ (sửa chữ /
ghi nhận). Chip mở: `task_1ad8318f` (SEO ngăn kéo ẩn) · `task_af648cfe` (đích chuông gộp
ngày) · `task_447e375a` (B3) · `task_9bd1524e` (flaky TheoSub) · `task_37e05c89` (/luat).
CHƯA commit — cây có 38 file của phiên khác, phải stage chọn lọc 36 file của lượt
(danh sách = §5 báo cáo chốt + `binh-luan-chung.spec.ts` + plan này).
