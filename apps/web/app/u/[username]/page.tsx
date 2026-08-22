import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TheMach } from "@/components/the-mach";
import { docHoSo } from "@/lib/api";
import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { ngayCuaThoiDiem } from "@/lib/dinh-dang";

import css from "./ho-so.module.css";

// Xem ghi chú ở `app/m/[slugId]/page.tsx`. Trang này KHÔNG đọc `searchParams` nên nếu
// không có dòng dưới, Next sẽ tiền dựng nó lúc `next build` và bắt Django phải sống lúc
// build — một ràng buộc không ai khai ở đâu cả.
export const dynamic = "force-dynamic";

type ThamSo = { username: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<ThamSo>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `u/${username}` };
}

export default async function TrangHoSo({ params }: { params: Promise<ThamSo> }) {
  const { username } = await params;
  const ho_so = await docHoSo(username);
  if (ho_so === null) notFound();

  // Nợ 1b #6: hồ sơ CẮT ở `limit` và **không có cursor** — phần dôi ra không có đường
  // nào lấy tiếp. Cắt âm thầm thì người xem tưởng mình đã thấy hết mạch của người ta,
  // nên chỗ này phải nói ra bằng chữ. Điều kiện so `so_mach` với ĐỘ DÀI DANH SÁCH THẬT
  // chứ không so với hằng 20: `limit` là tham số, đóng đinh con số ở hai chỗ là hai sự
  // thật.
  const bi_cat = ho_so.so_mach - ho_so.machs.length;

  // PLAN nguyên tắc 9, vế "áp cho CẢ hồ sơ" *(chốt 2026-08-22)*: user chưa hoạt động
  // không được in `Mạch 0 · Mốc 0 · Bình luận 0 · Được trích ×0`.
  //
  // **Ẩn cả KHỐI, không ẩn từng ô.** Ẩn từng ô cho ra một khối chỉ số một-ô-lẻ trông như
  // bị vỡ, và ba trong bốn ô vẫn nói "0" ở đúng những hồ sơ vắng nhất. Điều kiện là "cả
  // bốn con số đều 0" chứ không phải một cái nào riêng: người có 1 mạch mà 0 bình luận
  // thì `Bình luận 0` là thông tin thật về một hồ sơ có nội dung.
  //
  // `Được trích ×0` là con số độc nhất trong nhóm: PLAN 5.6 gọi nó là phần thưởng chủ
  // lực, nên in `×0` vào mặt người mới là nói với họ rằng họ đang ở cuối bảng trước khi
  // kịp viết chữ nào.
  const da_hoat_dong =
    ho_so.so_mach > 0 ||
    ho_so.so_moc > 0 ||
    ho_so.so_binh_luan > 0 ||
    ho_so.duoc_trich > 0;

  return (
    <main className={css.khung}>
      {/* Ba nút dưới mang dấu `CHU_NGUOI_DUNG` (Y3): chúng in chữ do chính người dùng gõ,
          nên hàng rào "ứng dụng không được quả quyết / không được rò kiểm duyệt" phải
          loại chúng ra — xem `lib/chu-nguoi-dung.ts`. */}
      <h1 className={css.ten} {...CHU_NGUOI_DUNG}>
        {ho_so.display_name || ho_so.username}
      </h1>
      <p className={css.username} {...CHU_NGUOI_DUNG}>
        u/{ho_so.username}
      </p>
      {ho_so.bio !== "" && (
        <p className={css.bio} {...CHU_NGUOI_DUNG}>
          {ho_so.bio}
        </p>
      )}

      {da_hoat_dong ? (
        <dl className={css.chi_so} data-testid="chi-so">
          <div className={css.mot_chi_so}>
            <dt>Mạch</dt>
            <dd data-testid="chi-so-mach">{ho_so.so_mach}</dd>
          </div>
          <div className={css.mot_chi_so}>
            <dt>Mốc</dt>
            <dd data-testid="chi-so-moc">{ho_so.so_moc}</dd>
          </div>
          <div className={css.mot_chi_so}>
            <dt>Bình luận</dt>
            <dd data-testid="chi-so-binh-luan">{ho_so.so_binh_luan}</dd>
          </div>
          {/* PLAN 5.9 gọi đúng tên chỉ số này là "Được trích vào sổ ×N" — nó là phần
              thưởng chủ lực của người bình luận (PLAN 5.6), không phải một con số thống kê
              nữa. Đếm theo SỐ CHỦ MẠCH KHÁC NHAU đã trích (rào 3), không phải số lần. */}
          <div className={`${css.mot_chi_so} ${css.trich}`}>
            <dt>Được trích vào sổ</dt>
            <dd data-testid="chi-so-duoc-trich">×{ho_so.duoc_trich}</dd>
          </div>
        </dl>
      ) : (
        // W4: câu cũ ("Tài khoản này chưa đăng mạch hay bình luận nào.") là một
        // KHẲNG ĐỊNH SAI trong ca thứ hai — bốn con số trên đều đếm nội dung **hiện
        // được**, nên một user viết cả năm rồi bị mod ẩn sạch cũng rơi vào nhánh này.
        // Câu thay thế chỉ nói về cái MÀN HÌNH đang có, không nói về quá khứ của người
        // ta, và vì thế cũng không rò ra việc có nội dung vừa bị gỡ.
        <p className={css.chua_hoat_dong} data-testid="ho-so-chua-hoat-dong">
          Chưa có hoạt động nào hiện ở hồ sơ này.
        </p>
      )}

      <p className={css.username}>Tham gia {ngayCuaThoiDiem(ho_so.date_joined)}</p>

      {/* Chỉ khúc `u/{username}` mang dấu, không phải cả `<h2>`: "Mạch của" là chữ của
          ứng dụng và phải ở lại trong phép quét. */}
      <h2 className={css.phu_tieu_de}>
        Mạch của <span {...CHU_NGUOI_DUNG}>u/{ho_so.username}</span>
      </h2>
      {ho_so.machs.length === 0 ? (
        // X1 — **cửa anh em của W4, cách đó 8 dòng, cùng file.** W4 xoá một khẳng định
        // về quá khứ ở khối chỉ số rồi để nguyên đúng khẳng định ấy ở đây: `users.py`
        // lọc `hidden_at__isnull=True`, nên user bị mod ẩn sạch bài cũng có
        // `machs = []`. Ca dễ gặp hơn cả ca A12: người chỉ bình luận + có 3 mạch bị ẩn
        // ⇒ `da_hoat_dong = true` ⇒ khối chỉ số HIỆN, và câu sai vẫn in ngay dưới nó.
        // Cùng nguyên tắc với W4: chỉ nói về màn hình, không nói về quá khứ người ta,
        // và vì thế cũng không rò ra việc có nội dung vừa bị gỡ.
        <p className={css.rong} data-testid="ho-so-khong-mach">
          Chưa có mạch nào hiện ở đây.
        </p>
      ) : (
        <ul className={css.danh_sach}>
          {ho_so.machs.map((m) => (
            <TheMach key={m.id} mach={m} />
          ))}
        </ul>
      )}

      {bi_cat > 0 && (
        <p className={css.bi_cat} data-testid="ho-so-bi-cat">
          Danh sách trên mới là {ho_so.machs.length} mạch mới nhất. Còn {bi_cat} mạch nữa
          chưa hiện được — hồ sơ chưa có trang tiếp.
        </p>
      )}
    </main>
  );
}
