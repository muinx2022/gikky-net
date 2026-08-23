"use client";

import { datVote } from "@gikky/api-client";
import { useState } from "react";

import { diemCoDau } from "@/lib/dinh-dang";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import {
  LY_DO_CHUA_DANG_NHAP,
  LY_DO_DANG_TAI,
  LY_DO_KHOA,
  type DichVote,
} from "@/lib/vote";

import css from "./cot-vote.module.css";
import { useMach } from "./mach-ngu-canh";
import { usePhien } from "./phien";
import { useTrangThaiToi } from "./trang-thai-toi";

/** Cột vote bên trái thẻ — bố cục Reddit, **sống từ Phase 2** (PLAN 5.7).
 *
 * ### Lạc quan, và cái giá của nó
 *
 * Con số nhảy ngay khi bấm, request đi sau. Nếu server từ chối thì **hoàn lại y nguyên
 * trạng thái trước cú bấm** và nói ra lỗi — không giữ con số lạc quan lại, vì một con số
 * client tự cộng mà server không đồng ý là đúng loài "hỏng im lặng" tệ nhất: nó sống tới
 * lần tải trang sau rồi biến mất không dấu vết.
 *
 * Khi server trả lời, con số được **thay bằng con số của server** (`kq.score`), không phải
 * giữ bản client tính. Hai cú bấm nhanh liên tiếp vì thế hội tụ về sự thật.
 *
 * ### Phiếu của tôi sống qua reload — nợ `VOTE-CUA-TOI`, **trả 2026-08-23**
 *
 * Mũi tên đang chọn đến từ `my_votes` của `GET /machs/{id}/me`, hỏi **ở trình duyệt** sau
 * khi trang đã render (`components/trang-thai-toi.tsx`). Nó tới sau một nhịp, và nhịp ấy
 * là cái giá bắt buộc: `GET /machs/{id}` cố ý không chứa gì per-user để trang còn cache
 * được (PLAN 8.4). Đừng "chữa" một nhịp trễ bằng cách nhét `my_vote` vào response trang
 * mạch — đó đúng là dữ liệu của người này được cache rồi phục vụ cho người kia, HTTP 200,
 * không có gì đỏ.
 *
 * Hai nguồn, một sự thật, và **cú bấm của người dùng luôn thắng**: `phieuTay` (`null` =
 * chưa bấm gì trong lượt xem này) đè lên phiếu server trả về. Không có lớp ấy thì một
 * response `/me` về muộn sẽ nuốt mất cú bấm vừa xong — đúng loại lỗi chỉ xảy ra trên mạng
 * chậm, tức không bao giờ ở máy dev.
 *
 * Ngoài trang mạch (feed, hồ sơ) không ai bọc provider ⇒ phiếu server luôn `0` và hai mũi
 * tên trung tính. Đúng: thẻ ở feed không nằm trong mạch nào, và `/me` là per-MẠCH.
 *
 * ### Nút không bấm được thì phải NÓI vì sao
 *
 * Bài học `error.tsx` của 1c. Ba đường cùng lúc: `disabled` (trình duyệt chặn), `title`
 * (hover thấy), `aria-label` (trình đọc màn hình nghe được — `title` một mình thì không).
 * Và lý do phải ĐÚNG: chưa đăng nhập ≠ mạch bị khoá ≠ **chưa biết mình là ai**.
 *
 * Vế thứ ba là L15, vá 2026-08-23. Câu ở đây từng chỉ kể hai ca trong khi code chỉ cài
 * hai ca, nên nó đúng với code và **sai với người dùng**: suốt nhịp `GET /me` chưa về,
 * người đã đăng nhập bị bảo "Đăng nhập để vote". Xem `LY_DO_DANG_TAI`.
 */
export function CotVote({
  diem,
  nhan,
  cai_gi,
  dich,
  nam_ngang = false,
  testIdDiem = "cot-vote-diem",
}: {
  diem: number;
  /** Tên thứ đang được vote — vào `aria-label` để trình đọc màn hình phân biệt được hai
   * chục cột vote giống hệt nhau trên một trang feed. */
  nhan: string;
  /** Chỉ để bài đo nhắm đúng cột, không đổi kiểu dáng. */
  cai_gi: "mach" | "moc" | "binh-luan";
  /** Bình luận xếp NGANG (khán đài dày, cột dọc mỗi dòng ăn hết bề ngang mobile). */
  nam_ngang?: boolean;
  /** Cho phép khán đài giữ nguyên `data-testid="diem-binh-luan"` đã có từ 1c — con số vẫn
   * ở đúng chỗ cũ, chỉ mọc thêm hai mũi tên quanh nó. */
  testIdDiem?: string;
  /** Đích thật của lá phiếu. `null` ⇒ không vote được (mạch nạp tay thiếu mốc 1, hoặc
   * thẻ này là bia mộ) và mũi tên tắt kèm lý do. */
  dich: DichVote | null;
}) {
  const { toi, dangTai } = usePhien();
  // Mạch bị mod khoá đọc từ ngữ cảnh, không từ prop: cột vote nằm sâu dưới bốn tầng
  // server component, và một prop xâu qua bốn tầng là prop sẽ bị quên ở tầng thứ năm.
  // Ngoài trang mạch (feed, hồ sơ) ngữ cảnh mặc định cho `khoa = false` — đúng, vì thẻ ở
  // đó không nằm trong mạch nào.
  const { khoa } = useMach();
  const { phieuCua } = useTrangThaiToi();
  const [soDiem, datSoDiem] = useState(diem);
  /** `null` = người xem chưa bấm gì trong lượt xem này ⇒ lấy phiếu của server. */
  const [phieuTay, datPhieuTay] = useState<-1 | 0 | 1 | null>(null);
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  const phieu = phieuTay ?? (dich === null ? 0 : phieuCua(dich));
  const dang_nhap = toi?.dang_nhap === true;
  // Thứ tự ba nhánh là thứ tự của sự thật, không phải thứ tự tiện tay: mạch bị khoá thì
  // khoá bất kể ai đang xem; còn lại, **chưa biết** ("đang hỏi `/me`") phải đứng TRƯỚC
  // "chưa đăng nhập", vì trong nhịp ấy `dang_nhap` là `false` cho cả hai loại người và
  // chỉ một trong hai câu là đúng (L15).
  const ly_do = khoa
    ? LY_DO_KHOA
    : dangTai
      ? LY_DO_DANG_TAI
      : !dang_nhap
        ? LY_DO_CHUA_DANG_NHAP
        : null;
  const tat = ly_do !== null || dich === null || dangGui;

  const bam = async (huong: 1 | -1) => {
    if (tat || dich === null) return;
    const truoc = { diem: soDiem, phieu };
    // Bấm lại đúng mũi tên đang chọn = RÚT (PLAN mục 7: `value = 0`).
    const moi = phieu === huong ? 0 : huong;
    datPhieuTay(moi);
    datSoDiem(soDiem - phieu + moi);
    datLoi(null);
    datDangGui(true);
    try {
      const kq = await datVote({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        body: { target_type: dich.loai, target_id: dich.id, value: moi },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      // Sự thật là con số của SERVER, không phải phép cộng của client.
      datSoDiem(kq.data.score);
      datPhieuTay(kq.data.value as -1 | 0 | 1);
    } catch {
      datSoDiem(truoc.diem);
      // Hoàn về đúng trạng thái TRƯỚC cú bấm. Ghi thẳng giá trị chứ không `null`: `null`
      // nghĩa "chưa bấm gì" ⇒ nó sẽ rơi về phiếu của server, mà server có thể chưa trả
      // lời xong — và lúc ấy mũi tên nhảy về trung tính dù người ta đã có phiếu từ trước.
      datPhieuTay(truoc.phieu);
      datLoi("Không ghi được phiếu. Thử lại.");
    } finally {
      datDangGui(false);
    }
  };

  return (
    <div
      className={nam_ngang ? `${css.cot} ${css.ngang}` : css.cot}
      role="group"
      aria-label={`Điểm của ${nhan}`}
      data-testid={`cot-vote-${cai_gi}`}
    >
      <MuiTen
        huong="len"
        nhan={nhan}
        tat={tat}
        lyDo={ly_do}
        chon={phieu === 1}
        onBam={() => void bam(1)}
      />
      <span className={css.diem} data-testid={testIdDiem}>
        {diemCoDau(soDiem)}
      </span>
      <MuiTen
        huong="xuong"
        nhan={nhan}
        tat={tat}
        lyDo={ly_do}
        chon={phieu === -1}
        onBam={() => void bam(-1)}
      />
      {loi !== null && (
        <span className={css.loi} role="alert" data-testid="cot-vote-loi">
          {loi}
        </span>
      )}
    </div>
  );
}

function MuiTen({
  huong,
  nhan,
  tat,
  lyDo,
  chon,
  onBam,
}: {
  huong: "len" | "xuong";
  nhan: string;
  tat: boolean;
  lyDo: string | null;
  chon: boolean;
  onBam: () => void;
}) {
  const viec = huong === "len" ? "Vote lên" : "Vote xuống";
  return (
    <button
      type="button"
      className={chon ? `${css.mui_ten} ${css.chon}` : css.mui_ten}
      disabled={tat}
      // `aria-disabled` **thêm vào** chứ không thay `disabled`: `disabled` thật là thứ
      // chặn cú bấm, `aria-disabled` là thứ một số trình đọc màn hình đọc thành "không
      // dùng được" thay vì bỏ qua phần tử.
      aria-disabled={tat ? "true" : undefined}
      aria-pressed={chon}
      title={lyDo ?? viec}
      aria-label={lyDo === null ? `${viec} (${nhan})` : `${viec} — ${lyDo} (${nhan})`}
      onClick={onBam}
      data-testid={`mui-ten-${huong}`}
    >
      {huong === "len" ? "▲" : "▼"}
    </button>
  );
}
