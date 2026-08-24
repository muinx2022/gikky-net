# Mod chuyên mục — gán / gỡ, cột trong bảng Chuyên mục

Chốt 2026-08-24 — user duyệt trực tiếp trong phiên.

## Đơn hàng

> "phần chuyên mục, thêm cột mod để assign/reassign/remove assign user trong hệ thống làm
> mod của chuyên mục. phần chọn user, cho suggest để dễ tìm hơn"

Ba câu hỏi đã hỏi và user đã chốt:

| Hỏi | Chốt |
|---|---|
| Quyền thật hay chỉ ghi nhận | **"các mod sẽ thay đổi được trạng thái của post, front sẽ làm phần mod sau"** |
| Mấy mod một chuyên mục | **Nhiều** |
| Ô gợi ý lấy từ đâu | **Mọi tài khoản** |

## §0 — Phạm vi: dựng VAI TRÒ, chưa nối QUYỀN

Câu chốt của user có hai vế và chúng rơi vào hai lượt khác nhau:

- *"các mod sẽ thay đổi được trạng thái của post"* — vai trò này **có quyền thật**, không
  phải một cái nhãn. Nên model phải dựng như một vai trò ngay từ đầu.
- *"front sẽ làm phần mod sau"* — phần thi hành quyền làm sau.

⚠ **Lượt này KHÔNG nối quyền vào bất kỳ endpoint nào, và đó là chủ đích.** Lý do không
phải "để dành cho gọn" mà là: nối quyền nghĩa là **nới `ChiMod`**, cái cổng hiện đòi
`is_staff` cho toàn khu quản trị. Một sub-mod không có `is_staff` hôm nay **còn không vào
nổi khu quản trị**. Nới nó ra là thay đổi bảo mật, và nó kéo theo ít nhất:

1. mọi endpoint kiểm duyệt phải thêm phép kiểm **theo sub** (ẩn mạch ở sub mình mới được);
2. `ban_user` đang từ chối ban một mod khác (409) — luật ấy có áp cho sub-mod không?
3. luật chống tự leo thang: PLAN mục 7 chốt cấp/thu `is_staff` **không có** trong khu quản
   trị vì "một mod cấp quyền mod cho tài khoản khác là bỏ qua mọi phép duyệt". Gán sub-mod
   đụng đúng mối lo ấy ở dạng hẹp hơn.

⇒ Việc gán/gỡ sub-mod **vẫn chỉ `is_staff` làm được** (nó nằm sau `ChiMod` như mọi endpoint
quản trị khác). Phần phân quyền là **plan riêng**, có nghiệm thu và phản biện.

**Phải nói thẳng trong báo cáo:** sau lượt này, gán ai đó làm mod chuyên mục **chưa cho họ
thêm quyền gì**. Ai đọc bảng mà tưởng ngược lại là hiểu sai, và hiểu sai theo hướng nguy
hiểm.

## §1 — Model

`ModSub` trong `core/models/dien_dan.py`, cạnh `Sub`.

```
sub          FK(Sub, CASCADE, related_name="mods")
user         FK(User, CASCADE, related_name="sub_dang_mod")
assigned_at  DateTimeField(default=timezone.now, editable=False)
assigned_by  FK(User, SET_NULL, null=True, related_name="+")
UniqueConstraint(sub, user)
```

- **Bảng nối, không phải FK trên `Sub`** — user chốt "nhiều mod". FK đơn thì thêm người thứ
  hai là một migration đổi cấu trúc.
- `sub`/`user` **CASCADE**: xoá sub thì vai trò hết nghĩa; `User` không bị xoá cứng ở đây
  (GDPR-lite đặt `is_active=False`) nhưng nếu có xoá thật thì vai trò cũng phải đi theo —
  một hàng trỏ vào user không còn là một cái tên trống trên bảng.
- `assigned_by` **SET_NULL**: mod gán người khác rồi tự rời đi thì lịch sử vẫn phải đọc
  được. CASCADE ở đây sẽ **xoá âm thầm** hàng phân công của người còn đang làm.

**Khoá:** không sinh cạnh mới. `ModSub` là lá — `INSERT` lấy `FOR KEY SHARE` trên hàng
`Sub` và `User`, và không đường nào trong repo khoá `ModSub` rồi mới xin `Sub`/`User`. Thứ
tự `Comment/Moc → Mach → MocAnh` không đụng tới.

## §2 — Audit

`AUDIT_GAN_MOD_SUB = "gan_mod_sub"` · `AUDIT_GO_MOD_SUB = "go_mod_sub"`, `target_type =
DICH_SUB`, `meta = {"slug": …, "username": …}`.

Phân công quyền là đúng loại hành động PLAN 5.10 đòi ghi sổ. Không ghi thì câu hỏi "ai cho
người này làm mod" không trả lời được.

## §3 — API

| Đường | Việc |
|---|---|
| `GET /admin/subs` | thêm `mods: list[NguoiDungTomTatOut]` vào `SubQuanTriOut` |
| `POST /admin/subs/{slug}/mods` | body `{username}` → gán. Trả `SubQuanTriOut` của sub đó |
| `DELETE /admin/subs/{slug}/mods/{username}` | gỡ. Trả `SubQuanTriOut` |

Trả **cả hàng sub** thay vì `204`: bảng cần vẽ lại đúng ô vừa đổi, và một `204` buộc
frontend gọi thêm một lượt liệt kê hoặc tự đoán trạng thái mới.

"Reassign" **không phải một endpoint** — với nhiều mod thì nó là gỡ + gán. Dựng một cửa
`PUT` thay cả danh sách nghe gọn hơn nhưng nó là cửa **ghi đè mù**: hai mod mở cùng bảng,
người bấm sau xoá mất người bấm trước thêm vào, không ai thấy gì.

**Từ chối, có lý do:**

- user không tồn tại → **404**;
- đã là mod rồi → **409 `xung_dot`**. Không im lặng thành công: mod bấm gán một người đã có
  trong danh sách cần biết là *đã có*, không phải nghĩ mình vừa thêm.
- user **đang bị ban** hoặc `is_active=False` → **409**. `ChiMod` đã từ chối cả hai loại
  này ở cổng, nên gán họ là dựng sẵn một hàng vô nghĩa; và một cái tên bị ban nằm trong cột
  "Mod" là thông tin sai trên màn hình.

Gợi ý user: **dùng lại `GET /admin/users?q=`**, không đẻ endpoint mới. Nó đã khớp
`username` **hoặc** `display_name` và **cố ý không tìm theo email** (lý do ở docstring của
nó — một ô tìm-theo-email là cách rẻ nhất để tra ngược địa chỉ của một người).

## §4 — Frontend (`apps/admin/app/subs`)

- Cột **Mod**: danh sách chip tên, rỗng thì một dấu "—" mờ.
- Nút **"Mod…"** mỗi hàng → mở `NganKeo`: danh sách mod hiện tại (mỗi cái một nút gỡ) +
  ô tìm có gợi ý.
- Ô gợi ý: gõ → debounce 250ms → `quanTriLietKeNguoiDung({ baseUrl, query: { q, limit: 8 }})`
  → danh sách bấm được. Gọi **thẳng tên hàm**, không qua biến trung gian
  (`e2e/don-vi/type-admin.spec.ts` phân tích tĩnh theo tên hàm).
- Đang gõ dở mà kết quả cũ về sau: **bỏ kết quả cũ** bằng số thứ tự lượt, cùng cách
  `lib/danh-sach.ts` đang làm.

## Tiêu chí nghiệm thu (ĐO ĐƯỢC)

1. `ModSub` có `UniqueConstraint(sub, user)`; gán trùng ném `IntegrityError` ở tầng DB, và
   API đổi nó thành **409**, không phải 500.
2. `GET /admin/subs` trả `mods` đúng, và **số query không tăng theo số sub** (prefetch) —
   đo bằng `assertNumQueries`, ghim ở một sub và ở ba sub ra **cùng một con số**.
3. Gán/gỡ đều ghi **đúng một** hàng `AuditLog` với `action` và `meta.username` đúng.
4. Gán user không tồn tại → 404; đã là mod → 409; user bị ban → 409; user `is_active=False`
   → 409.
5. Gỡ một người **không phải mod** → 404, không phải 200 im lặng.
6. Xoá `Sub` → hàng `ModSub` đi theo; **không** làm chết endpoint nào.
7. **Không endpoint kiểm duyệt nào đổi hành vi** — bài đo ghim rằng một sub-mod **không**
   `is_staff` vẫn nhận 403 ở `/api/admin/me`. Đây là tiêu chí của §0, và nó là cái dễ bị
   phá nhất khi ai đó "tiện tay" nối quyền.
8. `pnpm lint` · `tsc --noEmit` · `codegen:check` · `e2e:don-vi` sạch.

## Thử phá (luật 4)

- Bỏ `UniqueConstraint` → bài đo gán trùng phải ĐỎ.
- Đổi `prefetch_related` thành truy vấn trong vòng lặp → bài đo số query phải ĐỎ.
- Bỏ dòng `ghi_audit` → bài đo audit phải ĐỎ.
- Nới `ChiMod` cho sub-mod → tiêu chí 7 phải ĐỎ.
