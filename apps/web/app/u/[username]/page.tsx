import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TheMach } from "@/components/the-mach";
import { docHoSo } from "@/lib/api";
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

  return (
    <main className={css.khung}>
      <h1 className={css.ten}>{ho_so.display_name || ho_so.username}</h1>
      <p className={css.username}>u/{ho_so.username}</p>
      {ho_so.bio !== "" && <p className={css.bio}>{ho_so.bio}</p>}

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

      <p className={css.username}>Tham gia {ngayCuaThoiDiem(ho_so.date_joined)}</p>

      <h2 className={css.phu_tieu_de}>Mạch của u/{ho_so.username}</h2>
      {ho_so.machs.length === 0 ? (
        <p className={css.rong}>Chưa đăng mạch nào.</p>
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
