"use client";

import {
  quanTriLietKeSub,
  quanTriTaiAnhMoc,
  quanTriTaoMachHenGio,
  quanTriXemMach,
  type SubQuanTriOut,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SoanThaoQuanTri } from "../../../components/soan-thao-quan-tri";
import { HienLoi, Skeleton, The, TieuDeTrang } from "../../../components/ui";
import { GOC_API, headerGhi, moTaLoi } from "../../../lib/api";
import { useHanhDong } from "../../../lib/hanh-dong";
import { TAC_GIA_DOI, TAC_GIA_MAC_DINH } from "../../../lib/tac-gia-doi";
import {
  bayGioDatetimeLocalVN,
  datetimeLocalSangIsoVN,
  homNayVN,
} from "../../../lib/thoi-gian";

/** Bốn con số là **BẢN SAO** của `api/core/models/moc.py` + `api/api/schemas_ghi.py` —
 * cùng lý lẽ (và cùng giá phải trả) với khối hằng ở `app/m/[machId]/moc/[mocId]/page.tsx`:
 * `maxLength` không đi qua client sinh từ OpenAPI, nên hoặc gõ lại, hoặc bỏ hẳn phép chặn
 * sớm và để server trả 400. Lệch thì hậu quả là một câu 400 thay cho một dòng chữ đỏ tại
 * chỗ, không phải mất dữ liệu.
 *
 * Trần ẢNH thì **không** gõ lại, và ở trang này thì không gõ được kể cả muốn: trần ấy về
 * từ `tran_anh_moi_moc` trên payload của một mốc **đã tồn tại**, mà bài đang soạn thì chưa
 * có mốc nào. Server là chốt (400/409 nếu vượt); bịa một con số ở đây là dạy sai mod.
 */
const DAI_TITLE = 160;
const DAI_LOAI = 20;
const DAI_CAU_MOI = 200;
const SO_FIGURE_TOI_DA = 6;
const DAI_FIGURE = 24;

type Figure = { label: string; value: string };

/** Bài vừa tạo xong — dùng cho nhánh "ảnh hỏng thì ở lại".
 *
 * `da_len_ngay` là câu trả lời của SERVER, không phải suy đoán của form: mốc hẹn không ở
 * tương lai thì `tao_mach_hen_gio` đặt `hen_gio=False` và bài lên sóng NGAY kèm chuông.
 * Ô `min` chặn ca ấy ở phía UI, nhưng đồng hồ máy mod lệch (hoặc mod bấm gửi vài phút sau
 * khi chọn giờ) vẫn lọt — và lúc đó "đã hẹn" là một câu nói dối. */
type DaTao = { mach_id: number; moc_id: number | null; da_len_ngay: boolean };

/** Soạn MỘT bài mới từ khu quản trị — `plans/2026-09-04-dang-bai-tu-admin.md`.
 *
 * ## Nó KHÔNG phải bản admin của form công khai
 *
 * Cửa ghi là `POST /admin/machs/hen-gio`, không phải `POST /api/v1/machs`, và khác biệt
 * nằm ở hai trường mà cửa công khai cố ý không nhận: `author` (đăng thay mặt tài khoản
 * đội) và `published_at` (hẹn giờ). Xem docstring `api/quan_tri_hen_gio.py` cho lý do vì
 * sao hai trường ấy không được có mặt ở cửa công khai.
 *
 * ## Ba chỗ dễ làm sai, ghi ra để không ai "dọn" mất
 *
 * 1. **Giờ hẹn đi qua `datetimeLocalSangIsoVN`, cấm `toISOString()`.** Ô
 *    `datetime-local` là giờ naive; `toISOString()` đọc múi giờ của MÁY mod. Lệch 7 tiếng,
 *    và lệch im lặng — bài vẫn lên, chỉ là lên lúc 15:00 thay vì 08:00.
 * 2. **Ảnh đính kèm gửi SAU khi có `moc_id`**, mà `moc_id` chỉ biết được sau 201: phản hồi
 *    `KetQuaHenGioOut` mang `id` của *mạch*, nên phải đọc lại mạch để lấy mốc `seq === 1`.
 *    Sửa schema chỉ để mang thêm `moc_id` là nới một hợp đồng API cho tiện một màn hình.
 * 3. **Tấm ảnh hỏng KHÔNG cuốn bài theo.** Bài đã 201 thì nó đã nằm trong DB — không có
 *    đường xoá từ đây, và báo "thất bại" là nói dối. Câu lỗi nói hai vế, và trang **ở
 *    lại** kèm đường đi tới bài vừa tạo: mod cần đọc lỗi trước khi rời.
 *
 * ## Vì sao nút gửi tắt hẳn sau khi đã tạo
 *
 * Cửa này **không idempotent** và cũng không thể idempotent: bấm lần thứ hai là một bài
 * thứ hai, không phải một lần thử lại. Nên sau 201 nút không sống lại nữa, kể cả khi vế
 * ảnh hỏng — thứ còn thiếu (mấy tấm ảnh) sửa được ở trang mốc, còn một bài trùng thì phải
 * đi ẩn tay.
 *
 * **Ngoại lệ có chủ đích: lỗi mạng không có 201.** Ở đó chưa ai biết bài đã tồn tại chưa
 * (mất mạng đúng lúc response bay về là nó đã commit rồi), nên khoá cứng nút là nhốt mod
 * lại trong ca họ THẬT SỰ cần gửi lại. Nút sống lại, và câu lỗi gánh phần còn lại: nó nói
 * thẳng "không chắc đã tạo hay chưa — soát /machs trước khi bấm lại".
 *
 * ## Ảnh: cửa tạo bài mở cho mọi staff, và từ 2026-09-04 hai cửa ảnh cũng vậy
 *
 * `tai_anh_moc_quan_tri` và `tai_anh_noi_dung_quan_tri` (`api/quan_tri_sua_bai.py`) không
 * còn chặn `chan_neu_khong_phai_superuser` nữa (`plans/2026-09-04-noi-quyen-chen-anh-
 * staff.md`) — mọi staff chèn ảnh được, cùng cửa với `POST /admin/machs/hen-gio`. Ô ảnh
 * và nút 🖼 trong TipTap vì vậy mở cho mọi staff, không cần đọc `mod.is_superuser`.
 */
export default function TrangDangBai() {
  const router = useRouter();

  const [subs, datSubs] = useState<SubQuanTriOut[] | null>(null);
  const [loi_nap, datLoiNap] = useState<string | null>(null);

  const [sub, datSub] = useState("");
  const [title, datTitle] = useState("");
  const [author, datAuthor] = useState<string>(TAC_GIA_MAC_DINH);
  const [body, datBody] = useState("");
  const [ngay, datNgay] = useState("");
  const [loai, datLoai] = useState("");
  const [cau_moi, datCauMoi] = useState("");
  const [figures, datFigures] = useState<Figure[]>([]);
  const [anhs, datAnhs] = useState<File[]>([]);

  const [hen, datHen] = useState(false);
  const [o_gio, datOGio] = useState("");

  const [nhac, datNhac] = useState<string | null>(null);
  const [da_tao, datDaTao] = useState<DaTao | null>(null);

  const nap = useCallback(async () => {
    datLoiNap(null);
    const { data, error } = await quanTriLietKeSub({
      baseUrl: GOC_API,
      cache: "no-store",
    });
    if (error !== undefined) {
      datLoiNap(moTaLoi(error));
      return;
    }
    datSubs(data);
    // Chọn sẵn chuyên mục đầu tiên. Ô `<select>` không có mục rỗng, nên để `sub` là chuỗi
    // rỗng trong khi ô đang hiện một chuyên mục là nút gửi tắt mà không ai hiểu vì sao.
    if (data.length > 0) datSub((cu) => (cu === "" ? data[0].slug : cu));
  }, []);

  useEffect(() => {
    void nap();
  }, [nap]);

  /** Trang này không có gì để làm tươi sau một hành động: nó tạo ra một bài rồi đi khỏi.
   * `useHanhDong` vẫn dùng vì hai thứ khác của nó — khoá nút lúc đang chạy, và nhánh màn
   * hình `het_phien` (một câu "chua_dang_nhap" trần là ngõ cụt). */
  const khongLamGi = useCallback(async () => {}, []);
  const { dang_chay, loi, het_phien, chay } = useHanhDong(khongLamGi);

  const du = sub !== "" && title.trim() !== "" && body.trim() !== "";
  const khoa = dang_chay || da_tao !== null;

  /** Mốc "bây giờ" theo giờ VN, dùng cho cả `min` của ô giờ lẫn câu mô tả bên dưới nút.
   *
   * So bằng phép so CHUỖI, cố ý: hai vế cùng dạng `YYYY-MM-DDTHH:MM` nên thứ tự từ điển
   * đúng bằng thứ tự thời gian, và không có `new Date(...)` nào để lỡ tay đọc múi giờ máy.
   * Vẫn chỉ là hàng rào lịch sự — `bayGioDatetimeLocalVN` đọc đồng hồ máy mod. */
  const bay_gio_vn = bayGioDatetimeLocalVN();
  const gio_qua_khu = hen && o_gio !== "" && o_gio <= bay_gio_vn;

  async function gui() {
    datNhac(null);
    if (!du) {
      datNhac("Cần chuyên mục, tiêu đề và thân bài.");
      return;
    }
    // Bật công tắc mà bỏ trống ô giờ ⇒ nói tại chỗ, KHÔNG gửi. Gửi rồi ăn lỗi server là
    // không được: `published_at` rỗng trên đường ấy nghĩa là *đăng ngay*, tức bài lên sóng
    // trong khi mod đang định hẹn nó.
    if (hen && o_gio === "") {
      datNhac("Đã bật hẹn giờ — chọn giờ phát hành, hoặc tắt công tắc để đăng ngay.");
      return;
    }

    // Hàng nào còn trống MỘT trong hai vế thì bỏ hẳn — `kiem_figures` ở server đòi cả
    // `label` lẫn `value` không rỗng, nên gửi một cặp dở dang là 400 kèm một câu lỗi thô
    // cho một ô mod chỉ mới bấm "Thêm cặp". Cùng luật với trang sửa mốc và
    // `apps/web/components/truong-moc.tsx::thanMoc`.
    const cap = figures
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label !== "" && f.value !== "");

    // Đổi giờ TRƯỚC khi vào `chay(...)`, và bắt lấy cú ném.
    //
    // `datetimeLocalSangIsoVN` NÉM khi chuỗi lệch dạng — và ô `datetime-local` đẻ ra chuỗi
    // lệch dạng thật: vài trình duyệt cho gõ năm 5 chữ số. Gọi nó bên trong callback của
    // `chay(...)` thì cú ném đi thẳng ra ngoài (`useHanhDong` không có `catch`) thành một
    // unhandled rejection: `dang_chay` vẫn về `false` nhờ `finally`, nhưng màn hình CÂM —
    // không câu lỗi nào, và mod chỉ thấy bấm nút mà không có gì xảy ra.
    let published_at: string | null = null;
    if (hen) {
      try {
        published_at = datetimeLocalSangIsoVN(o_gio);
      } catch {
        datNhac("Giờ hẹn không hợp lệ — chọn lại.");
        return;
      }
    }

    await chay(async () => {
      const kq = await quanTriTaoMachHenGio({
        baseUrl: GOC_API,
        headers: headerGhi(),
        body: {
          sub,
          title: title.trim(),
          author,
          body,
          occurred_at: ngay === "" ? null : ngay,
          loai: loai === "" ? null : loai,
          question_for_crowd: cau_moi === "" ? null : cau_moi,
          figures: cap.length === 0 ? null : cap,
          published_at,
        },
      });
      // Hai nhánh dưới đây là "KHÔNG BIẾT", không phải "chưa gửi được": mất mạng đúng lúc
      // response bay về là bài đã commit ở server rồi. Cửa này không idempotent, nên câu
      // chữ phải chặn phản xạ bấm lại — nút vẫn sống lại (có thể lượt ấy thật sự chưa tới
      // server), nhưng mod phải đi soát trước.
      const CHUA_RO =
        " — mở /machs kiểm tra TRƯỚC khi bấm lại, kẻo tạo trùng một bài thứ hai.";
      if (kq.error !== undefined) {
        return { error: `Không chắc bài đã được tạo hay chưa: ${moTaLoi(kq.error)}${CHUA_RO}` };
      }
      if (kq.data === undefined) {
        return { error: `Máy chủ trả phản hồi rỗng${CHUA_RO}` };
      }
      const mach_id = kq.data.id;
      // Server mới là nơi biết bài này ĐANG HẸN hay ĐÃ LÊN: mốc quá khứ ⇒ `hen_gio=False`
      // ⇒ lên sóng ngay kèm chuông thật. Đọc `da_hen_gio` thay vì tin vào công tắc `hen`.
      const da_len_ngay = hen && !kq.data.da_hen_gio;
      // Từ đây trở xuống bài ĐÃ tồn tại. Ghi ngay, trước cả vế ảnh: mọi nhánh lỗi phía
      // dưới đều phải để lại một đường đi tới bài, và phải chặn cú bấm thứ hai.
      datDaTao({ mach_id, moc_id: null, da_len_ngay });

      if (anhs.length === 0) {
        // Ca "tưởng hẹn mà đã lên" thì Ở LẠI: điều hướng ngay là cuốn mất dòng cảnh báo
        // trước khi mod kịp đọc, mà đó đúng là dòng họ cần đọc nhất.
        if (!da_len_ngay) router.push(`/m/${mach_id}`);
        return {};
      }

      const xem = await quanTriXemMach({
        baseUrl: GOC_API,
        cache: "no-store",
        path: { mach_id },
      });
      const moc1 = xem.data?.mocs.find((m) => m.seq === 1);
      if (moc1 === undefined) {
        return {
          error:
            "Đã tạo bài, nhưng không đọc được mốc 1 để gửi ảnh" +
            (xem.error !== undefined ? `: ${moTaLoi(xem.error)}` : "."),
        };
      }
      datDaTao({ mach_id, moc_id: moc1.id, da_len_ngay });

      // Tuần tự, KHÔNG `Promise.all`: trần ảnh/mốc được enforce trong khoá hàng `Moc` ở
      // server, nên gửi song song chỉ là mấy transaction xếp hàng chờ nhau — và
      // `position` lại phụ thuộc request nào tới trước.
      const con_lai = [...anhs];
      for (const f of anhs) {
        const anh = await quanTriTaiAnhMoc({
          baseUrl: GOC_API,
          headers: headerGhi(),
          path: { moc_id: moc1.id },
          body: { file: f },
        });
        if (anh.error !== undefined) {
          // Cắt dần theo từng tấm 201 — giữ đúng những tấm CHƯA lên để mod biết còn thiếu
          // gì; danh sách này chỉ để đọc, trang không gửi lại chúng nữa.
          datAnhs(con_lai);
          return { error: `Đã tạo bài, nhưng ${f.name}: ${moTaLoi(anh.error)}` };
        }
        con_lai.shift();
      }
      datAnhs([]);
      if (!da_len_ngay) router.push(`/m/${mach_id}`);
      return {};
    });
  }

  return (
    <>
      <TieuDeTrang
        tieu_de="Đăng bài"
        mo_ta="Soạn một bài mới thay mặt tài khoản đội. Đăng ngay, hoặc hẹn giờ phát hành."
        hanh_dong={
          <Link href="/machs" className="nut">
            ← Danh sách bài
          </Link>
        }
      />

      <HienLoi loi={loi ?? loi_nap} het_phien={het_phien} />

      {da_tao !== null && (
        <The className="mb-4">
          {da_tao.da_len_ngay && (
            <p
              className="border-b border-vien px-4 pt-4 pb-3 text-sm text-chu-y"
              role="alert"
              data-testid="canh-bao-da-len-ngay"
            >
              Giờ đã chọn nằm trong quá khứ — bài đã <strong>PHÁT HÀNH NGAY</strong>,
              không phải hẹn. Chuông đã bắn cho người theo tài khoản đội. Muốn giấu lại
              thì ẩn bài ở trang bên dưới.
            </p>
          )}
          <p className="p-4 text-sm" data-testid="da-tao-bai">
            Bài đã được tạo.{" "}
            <Link href={`/m/${da_tao.mach_id}`} className="text-nhan hover:underline">
              Mở bài #{da_tao.mach_id}
            </Link>
            {da_tao.moc_id !== null && (
              <>
                {" · "}
                <Link
                  href={`/m/${da_tao.mach_id}/moc/${da_tao.moc_id}`}
                  className="text-nhan hover:underline"
                >
                  Thêm ảnh ở mốc 1
                </Link>
              </>
            )}
          </p>
        </The>
      )}

      {subs === null ? (
        loi_nap === null ? (
          <The>
            <Skeleton />
          </The>
        ) : (
          // `HienLoi` phía trên đã nói ra chuyện gì xảy ra; chỗ này trả lời câu còn lại —
          // *bấm gì bây giờ*. Không có nút này thì lối ra duy nhất là F5, và F5 ở một
          // trang soạn thảo là thứ không ai muốn tập thói quen bấm.
          <The>
            <div className="p-4">
              <button
                type="button"
                className="nut"
                onClick={() => void nap()}
                data-testid="thu-lai-nap-sub"
              >
                Thử lại
              </button>
            </div>
          </The>
        )
      ) : subs.length === 0 ? (
        <The>
          <p className="p-4 text-sm text-muc-mo" data-testid="chua-co-sub">
            Chưa có chuyên mục nào — bài viết phải nằm trong một chuyên mục.{" "}
            <Link href="/subs" className="text-nhan hover:underline">
              Tạo chuyên mục
            </Link>{" "}
            trước đã.
          </p>
        </The>
      ) : (
        <form
          data-testid="form-dang-bai-admin"
          onSubmit={(e) => {
            e.preventDefault();
            void gui();
          }}
        >
          <The tieu_de="Nội dung" className="mb-4">
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="o-sub">
                  Chuyên mục
                </label>
                <select
                  id="o-sub"
                  className="o-nhap cursor-pointer"
                  value={sub}
                  disabled={khoa}
                  onChange={(e) => datSub(e.target.value)}
                  data-testid="o-sub"
                >
                  {subs.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      s/{s.slug} — {s.ten}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="o-title">
                  Tiêu đề
                </label>
                <input
                  id="o-title"
                  type="text"
                  className="o-nhap"
                  value={title}
                  maxLength={DAI_TITLE}
                  disabled={khoa}
                  placeholder="Tiêu đề ngắn gọn, nói rõ bài này theo dõi điều gì"
                  onChange={(e) => datTitle(e.target.value)}
                  data-testid="o-title"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="o-tac-gia">
                  Đăng dưới tên
                </label>
                <select
                  id="o-tac-gia"
                  className="o-nhap cursor-pointer"
                  value={author}
                  disabled={khoa}
                  onChange={(e) => datAuthor(e.target.value)}
                  data-testid="o-tac-gia"
                >
                  {TAC_GIA_DOI.map((t) => (
                    <option key={t.username} value={t.username}>
                      u/{t.username} — {t.nhan}
                    </option>
                  ))}
                </select>
                <p className="mono mt-1 text-xs text-muc-mo">
                  Chỉ hai tài khoản đội. Không đăng dưới tên người dùng thật, kể cả tên
                  bạn.
                </p>
              </div>

              <div>
                <span className="mb-1 block text-sm font-medium">Thân bài (mốc 1)</span>
                {/* `giaTri=""` cố định: editor chỉ đọc `content` lúc dựng, và trang này
                    không bao giờ prefill — mỗi lượt mở là một bài trắng. */}
                {/* `choPhepAnh` không truyền — mặc định `true` (2026-09-04): mọi staff
                    chèn ảnh được, không riêng superuser. */}
                <SoanThaoQuanTri giaTri="" datGiaTri={datBody} khoa={khoa} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="o-ngay">
                  Ngày sự việc <span className="text-muc-mo">(tuỳ chọn)</span>
                </label>
                <input
                  id="o-ngay"
                  type="date"
                  className="o-nhap"
                  value={ngay}
                  max={homNayVN()}
                  disabled={khoa}
                  onChange={(e) => datNgay(e.target.value)}
                  data-testid="o-ngay"
                />
                <p className="mono mt-1 text-xs text-muc-mo">
                  Cấm ngày tương lai (theo giờ VN) — server chặn lần cuối. Bỏ trống thì
                  server lấy hôm nay.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="o-loai">
                  Loại <span className="text-muc-mo">(tuỳ chọn)</span>
                </label>
                <input
                  id="o-loai"
                  type="text"
                  className="o-nhap"
                  value={loai}
                  maxLength={DAI_LOAI}
                  placeholder="vào lệnh, nâng dừng lỗ…"
                  disabled={khoa}
                  onChange={(e) => datLoai(e.target.value)}
                  data-testid="o-loai"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="o-cau-moi">
                  Câu mồi cho khán đài <span className="text-muc-mo">(tuỳ chọn)</span>
                </label>
                <input
                  id="o-cau-moi"
                  type="text"
                  className="o-nhap"
                  value={cau_moi}
                  maxLength={DAI_CAU_MOI}
                  disabled={khoa}
                  onChange={(e) => datCauMoi(e.target.value)}
                  data-testid="o-cau-moi"
                />
              </div>

              <OFigures figures={figures} datFigures={datFigures} khoa={khoa} />
            </div>
          </The>

          <The tieu_de="Ảnh đính kèm" className="mb-4">
            <div className="space-y-2 p-4">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={khoa}
                className="text-sm"
                data-testid="o-anh"
                onChange={(e) => {
                  const chon = e.target.files;
                  if (chon === null) return;
                  datAnhs([...anhs, ...chon]);
                  e.target.value = "";
                }}
              />
              <p className="mono text-xs text-muc-mo">
                JPEG, PNG hoặc WebP · gửi SAU khi bài được tạo. Trần ảnh/mốc do server
                giữ — bài chưa tồn tại thì chưa biết được, nên ở đây không chặn số tấm.
              </p>
              {anhs.length > 0 && (
                <ul className="mono space-y-1 text-xs" data-testid="ds-anh">
                  {anhs.map((f, i) => (
                    <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2">
                      <span>{f.name}</span>
                      <button
                        type="button"
                        className="nut nut-nho"
                        disabled={khoa}
                        onClick={() => datAnhs(anhs.filter((_, k) => k !== i))}
                        data-testid={`nut-bo-anh-${i}`}
                      >
                        Bỏ
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </The>

          <The tieu_de="Phát hành" className="mb-4">
            <div className="space-y-3 p-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hen}
                  disabled={khoa}
                  onChange={(e) => datHen(e.target.checked)}
                  data-testid="o-bat-hen-gio"
                />
                Hẹn giờ phát hành
              </label>

              {hen && (
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="o-hen-gio">
                    Giờ phát hành (Việt Nam)
                  </label>
                  {/* `min` là hàng rào LỊCH SỰ, không phải chốt: nó đọc đồng hồ máy mod
                      (xem `bayGioDatetimeLocalVN`), nên máy chạy sai giờ vẫn chọn được
                      một mốc server coi là quá khứ. Chốt là server, và ca lọt lưới được
                      nói ra sau 201 qua `da_hen_gio`. Cùng tinh thần `max={homNayVN()}`
                      ở ô ngày sự việc phía trên. */}
                  <input
                    id="o-hen-gio"
                    type="datetime-local"
                    className="o-nhap"
                    value={o_gio}
                    min={bay_gio_vn}
                    disabled={khoa}
                    onChange={(e) => datOGio(e.target.value)}
                    data-testid="o-hen-gio-dang-bai"
                  />
                  <p className="mono mt-1 text-xs text-muc-mo">
                    Giờ Việt Nam, không phải giờ máy bạn. Mốc trong quá khứ được server
                    hiểu là phát hành ngay.
                  </p>
                </div>
              )}

              {/* Ba câu, không hai: "đã bật hẹn giờ" KHÔNG đồng nghĩa "bài sẽ nằm chờ".
                  Mốc không ở tương lai ⇒ `tao_mach_hen_gio` đặt `hen_gio=False` và bài lên
                  sóng ngay kèm chuông thật — hứa "không lên feed, không chuông" ở ca ấy là
                  câu sai duy nhất trên màn hình này mà mod không có cách nào kiểm. */}
              <p
                className={`text-sm ${gio_qua_khu ? "text-chu-y" : "text-muc-mo"}`}
                data-testid="mo-ta-phat-hanh"
              >
                {!hen
                  ? "Bài lên sóng ngay, kèm chuông cho người theo tài khoản đội."
                  : gio_qua_khu
                    ? "Giờ đã chọn không nằm ở tương lai — server sẽ PHÁT HÀNH NGAY kèm chuông, đây không phải một bài hẹn."
                    : "Bài nằm ẩn tới giờ đã hẹn: không lên feed, không chuông, URL công khai còn 404."}
              </p>

              {nhac !== null && (
                <p className="text-sm text-chu-y" role="status" data-testid="nhac-dang-bai">
                  {nhac}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="nut nut-chinh"
                  disabled={khoa || !du}
                  title={
                    da_tao !== null
                      ? "Bài đã tạo — bấm lại là một bài thứ hai"
                      : du
                        ? undefined
                        : "Cần chuyên mục, tiêu đề và thân bài"
                  }
                  data-testid="nut-dang-bai-admin"
                >
                  {dang_chay ? "Đang gửi…" : hen ? "Hẹn giờ đăng" : "Đăng ngay"}
                </button>
                <Link href="/machs" className="nut">
                  Huỷ
                </Link>
              </div>
            </div>
          </The>
        </form>
      )}
    </>
  );
}

/** Dải số của mốc 1 — tối đa 6 cặp `{label, value}`, mỗi ô ≤24 ký tự.
 *
 * Bản thứ hai của khối cùng tên ở `app/m/[machId]/moc/[mocId]/page.tsx`, **cố ý**: gom
 * chúng lại là dựng một component dùng chung cho hai form có vòng đời khác hẳn nhau (một
 * cái prefill từ server và biết "có gì đổi không", một cái luôn trắng), và cái giá là một
 * props surface phải diễn tả cả hai. Thuần hiển thị, server chỉ validate hình dạng
 * (`core/models/moc.py::kiem_figures`).
 */
function OFigures({
  figures,
  datFigures,
  khoa,
}: {
  figures: Figure[];
  datFigures: (moi: Figure[]) => void;
  khoa: boolean;
}) {
  const doi = (i: number, phan: "label" | "value", gia_tri: string) => {
    datFigures(figures.map((f, k) => (k === i ? { ...f, [phan]: gia_tri } : f)));
  };

  return (
    <div>
      <span className="mb-1 block text-sm font-medium">
        Dải số <span className="text-muc-mo">tối đa {SO_FIGURE_TOI_DA} cặp</span>
      </span>
      <ul className="space-y-2" data-testid="ds-figures">
        {figures.map((f, i) => (
          <li key={i} className="flex flex-wrap gap-2">
            <input
              type="text"
              className="o-nhap max-w-40"
              value={f.label}
              maxLength={DAI_FIGURE}
              placeholder="GIÁ VÀO"
              disabled={khoa}
              onChange={(e) => doi(i, "label", e.target.value)}
              data-testid={`o-figure-label-${i}`}
              aria-label={`Nhãn ô ${i + 1}`}
            />
            <input
              type="text"
              className="o-nhap max-w-40"
              value={f.value}
              maxLength={DAI_FIGURE}
              placeholder="27.80"
              disabled={khoa}
              onChange={(e) => doi(i, "value", e.target.value)}
              data-testid={`o-figure-value-${i}`}
              aria-label={`Giá trị ô ${i + 1}`}
            />
            <button
              type="button"
              className="nut nut-nho"
              disabled={khoa}
              onClick={() => datFigures(figures.filter((_, k) => k !== i))}
              data-testid={`nut-bo-figure-${i}`}
            >
              Bỏ
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="nut nut-nho mt-2"
        disabled={khoa || figures.length >= SO_FIGURE_TOI_DA}
        onClick={() => datFigures([...figures, { label: "", value: "" }])}
        data-testid="nut-them-figure"
      >
        Thêm cặp
      </button>
    </div>
  );
}
