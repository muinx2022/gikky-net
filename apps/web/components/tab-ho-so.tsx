"use client";

import {
  lietKeDaVote,
  lietKeDangTheo,
  lietKeSubDangTheo,
  lietKeUserDangTheo,
  type MachTomTatOut,
  type NguoiDungTomTatOut,
  type SubChiTietOut,
} from "@gikky/api-client";
import {
  Bookmark,
  FileText,
  Layers,
  ThumbsUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { GOC_TRINH_DUYET } from "@/lib/tai-khoan";
import {
  NHAN_TAB_HO_SO,
  TAB_HO_SO,
  laTabRieng,
  type TabHoSo,
} from "@/lib/tab-ho-so";

import { Avatar } from "./avatar";
import { NutBoTheoSub } from "./nut-theo-sub";
import { NutBoTheoUser } from "./nut-theo-user-bo";
import { usePhien } from "./phien";
import css from "./tab-ho-so.module.css";
import { TheMach } from "./the-mach";

const ICON_TAB: Readonly<Record<TabHoSo, LucideIcon>> = {
  "bai-viet": FileText,
  "da-vote": ThumbsUp,
  "dang-theo": Bookmark,
  "chuyen-muc": Layers,
  nguoi: Users,
};

/** Thanh tab của trang hồ sơ.
 *
 * **Client component, và đó là bắt buộc.** Hai tab riêng chỉ hiện trên hồ sơ của chính
 * mình, mà server render trang này **không biết người xem là ai** — nó cố ý không đọc
 * cookie (PLAN 8.4: trang công khai, không nướng dữ liệu per-user vào HTML). Câu hỏi "tôi
 * có phải chủ hồ sơ này không" chỉ trả lời được ở trình duyệt, qua `usePhien()`.
 *
 * Hệ quả nhìn thấy được: lượt render đầu chỉ có tab "Bài viết", hai tab kia xuất hiện khi
 * `/me` về. Đổi lại: không có tab của người này lọt vào HTML phục vụ người kia — cùng lối
 * `components/trang-thai-toi.tsx`.
 */
export function TabHoSoNav({
  username,
  tabHienTai,
}: {
  username: string;
  tabHienTai: TabHoSo;
}) {
  const { toi } = usePhien();
  const la_chu = toi?.dang_nhap === true && toi.username === username;

  return (
    <nav className={css.thanh} aria-label="Mục hồ sơ" data-testid="tab-ho-so">
      {TAB_HO_SO.filter((t) => !laTabRieng(t) || la_chu).map((t) => {
        const Hinh = ICON_TAB[t];
        const dang_chon = t === tabHienTai;
        return (
          <Link
            key={t}
            href={t === "bai-viet" ? `/u/${username}` : `/u/${username}?tab=${t}`}
            className={dang_chon ? `${css.tab} ${css.dang_chon}` : css.tab}
            aria-current={dang_chon ? "page" : undefined}
            data-testid={`tab-ho-so-${t}`}
          >
            <Hinh size={15} strokeWidth={2} aria-hidden />
            {NHAN_TAB_HO_SO[t]}
          </Link>
        );
      })}
    </nav>
  );
}

/** Danh sách mạch của hai tab RIÊNG `đã vote` / `đang theo`.

 * Tab riêng thứ BA (`chuyên mục`) **không** đi qua đây: nó liệt kê `SubChiTietOut` chứ
 * không `MachTomTatOut`, và mỗi dòng mang một nút hành động. Xem `DanhSachSubTheo` cuối
 * file.
 *
 * Nạp ở **trình duyệt**, không ở server: hai cửa `/me/*` trả `no-store` và là dữ liệu
 * per-user tuyệt đối. Kéo chúng vào lượt render server là đúng thứ PLAN 8.4 cấm.
 *
 * Người lạ mở `?tab=da-vote` trên hồ sơ người khác thì không thấy gì cả — thanh tab đã
 * không vẽ tab ấy cho họ, và ở đây `la_chu` sai nên component tự rút. Hai lớp cho cùng một
 * luật, vì lớp thứ nhất chỉ là giao diện.
 */
export function DanhSachRieng({
  username,
  tab,
}: {
  username: string;
  tab: "da-vote" | "dang-theo";
}) {
  const { toi, dangTai } = usePhien();
  const la_chu = toi?.dang_nhap === true && toi.username === username;

  const [items, datItems] = useState<MachTomTatOut[] | null>(null);
  const [loi, datLoi] = useState(false);

  useEffect(() => {
    if (!la_chu) return;
    let con_song = true;
    datItems(null);
    datLoi(false);
    void (async () => {
      try {
        // Hai lời gọi TRỰC TIẾP, không alias qua `const goi = … ? … : …`. Bản trước
        // viết đúng lối alias ấy và **hàng rào `e2e/don-vi/type-frontend.spec.ts`
        // (`GOI_QUA_BIEN`) đỏ vì nó** — hàng rào tìm callee theo TÊN để ép mọi lời gọi
        // kèm `baseUrl` (chống `client` singleton rò session), nên một cái tên đi qua
        // biến làm phân tích tĩnh mù với chính lời gọi đó. Xem `CLAUDE.md`.
        const kq =
          tab === "da-vote"
            ? await lietKeDaVote({ baseUrl: GOC_TRINH_DUYET, cache: "no-store" })
            : await lietKeDangTheo({ baseUrl: GOC_TRINH_DUYET, cache: "no-store" });
        if (!con_song) return;
        if (kq.data === undefined) throw new Error("phản hồi rỗng");
        datItems(kq.data.items);
      } catch {
        if (con_song) datLoi(true);
      }
    })();
    return () => {
      con_song = false;
    };
  }, [la_chu, tab]);

  if (dangTai) return null;
  if (!la_chu) return <ChiChuHoSo />;
  if (loi) {
    return (
      <p className={css.rong} role="alert">
        Không tải được danh sách. Thử lại sau ít giây.
      </p>
    );
  }
  if (items === null) {
    return (
      <p className={css.rong} data-testid="tab-rieng-dang-tai">
        Đang tải…
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className={css.rong} data-testid="tab-rieng-rong">
        {tab === "da-vote"
          ? "Bạn chưa bỏ phiếu cho mạch nào."
          : "Bạn chưa theo mạch nào."}
      </p>
    );
  }
  return (
    <ul className={css.danh_sach} data-testid="tab-rieng-danh-sach">
      {items.map((m) => (
        <TheMach key={m.id} mach={m} />
      ))}
    </ul>
  );
}


/** Hàng rào hiển thị dùng chung cho MỌI tab riêng — một câu, một chỗ.
 *
 * Đây là **lớp thứ hai**: thanh tab đã không vẽ tab riêng cho người lạ. Lớp này bắt ca
 * người ta gõ thẳng `?tab=chuyen-muc` lên URL hồ sơ của người khác. Cả hai lớp đều chỉ là
 * giao diện — hàng rào THẬT là `auth=dang_nhap` trên `/me/*`, và nó chặn theo phiên chứ
 * không theo `username` trên URL.
 */
function ChiChuHoSo() {
  return (
    <p className={css.rong} data-testid="tab-rieng-cam">
      Mục này chỉ chủ hồ sơ xem được.
    </p>
  );
}

/** Tab **Chuyên mục** — danh sách chuyên mục đang theo, mỗi dòng một nút "Hủy".
 *
 * ## Danh sách sống ở ĐÂY, không ở từng dòng
 *
 * Nút "Hủy" nằm trong dòng nhưng **không** tự xoá mình: nó gọi `onBoXong` và component
 * này lọc danh sách. Cho mỗi dòng tự ẩn mình bằng state riêng là một danh sách có hai
 * nguồn sự thật — cái mảng ở đây, và cờ ẩn rải trong từng dòng; lượt tải lại sau đó hai
 * cái nói khác nhau.
 *
 * ## Không có `router.refresh()`
 *
 * Trang hồ sơ render ở server, nhưng danh sách này thì không — nó nạp ở trình duyệt từ
 * `/me/subs` (`no-store`). Gọi `refresh()` là dựng lại cả trang server cho một thay đổi
 * mà server không hề biết tới.
 */
export function DanhSachSubTheo({ username }: { username: string }) {
  const { toi, dangTai } = usePhien();
  const la_chu = toi?.dang_nhap === true && toi.username === username;

  const [items, datItems] = useState<SubChiTietOut[] | null>(null);
  const [loi, datLoi] = useState(false);

  useEffect(() => {
    if (!la_chu) return;
    let con_song = true;
    datItems(null);
    datLoi(false);
    void (async () => {
      try {
        const kq = await lietKeSubDangTheo({
          baseUrl: GOC_TRINH_DUYET,
          cache: "no-store",
        });
        if (!con_song) return;
        if (kq.data === undefined) throw new Error("phản hồi rỗng");
        datItems(kq.data);
      } catch {
        if (con_song) datLoi(true);
      }
    })();
    return () => {
      con_song = false;
    };
  }, [la_chu]);

  if (dangTai) return null;
  if (!la_chu) return <ChiChuHoSo />;
  if (loi) {
    return (
      <p className={css.rong} role="alert">
        Không tải được danh sách. Thử lại sau ít giây.
      </p>
    );
  }
  if (items === null) {
    return (
      <p className={css.rong} data-testid="tab-rieng-dang-tai">
        Đang tải…
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className={css.rong} data-testid="tab-rieng-rong">
        Bạn chưa theo dõi chuyên mục nào. Mở một chuyên mục rồi bấm “Theo dõi”.
      </p>
    );
  }
  return (
    <ul className={css.danh_sach_sub} data-testid="tab-sub-danh-sach">
      {items.map((s) => (
        <li key={s.slug} className={css.dong_sub} data-testid="dong-sub">
          <div className={css.sub_chu}>
            <Link href={`/s/${s.slug}`} className={css.sub_ten}>
              {s.ten}
            </Link>
            <p className={`${css.sub_slug} mono`}>s/{s.slug}</p>
            {s.mo_ta !== "" && <p className={css.sub_mo_ta}>{s.mo_ta}</p>}
          </div>
          <NutBoTheoSub
            slug={s.slug}
            onBoXong={() => datItems((truoc) => (truoc ?? []).filter((x) => x.slug !== s.slug))}
          />
        </li>
      ))}
    </ul>
  );
}

/** Tab **Người** — danh sách người đang theo, mỗi dòng một nút "Hủy".

 * Cùng khuôn `DanhSachSubTheo` và cùng hai luật của nó:
 *
 * - **danh sách sống ở ĐÂY**, nút trong dòng chỉ gọi `onBoXong`. Cho mỗi dòng tự ẩn mình
 *   bằng state riêng là một danh sách có hai nguồn sự thật;
 * - **không `router.refresh()`**: danh sách này nạp ở trình duyệt từ `/me/dang-theo-user`
 *   (`no-store`), server không hề biết tới nó.
 */
export function DanhSachUserTheo({ username }: { username: string }) {
  const { toi, dangTai } = usePhien();
  const la_chu = toi?.dang_nhap === true && toi.username === username;

  const [items, datItems] = useState<NguoiDungTomTatOut[] | null>(null);
  const [loi, datLoi] = useState(false);

  useEffect(() => {
    if (!la_chu) return;
    let con_song = true;
    datItems(null);
    datLoi(false);
    void (async () => {
      try {
        const kq = await lietKeUserDangTheo({
          baseUrl: GOC_TRINH_DUYET,
          cache: "no-store",
        });
        if (!con_song) return;
        if (kq.data === undefined) throw new Error("phản hồi rỗng");
        datItems(kq.data);
      } catch {
        if (con_song) datLoi(true);
      }
    })();
    return () => {
      con_song = false;
    };
  }, [la_chu]);

  if (dangTai) return null;
  if (!la_chu) return <ChiChuHoSo />;
  if (loi) {
    return (
      <p className={css.rong} role="alert">
        Không tải được danh sách. Thử lại sau ít giây.
      </p>
    );
  }
  if (items === null) {
    return (
      <p className={css.rong} data-testid="tab-rieng-dang-tai">
        Đang tải…
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className={css.rong} data-testid="tab-rieng-rong">
        Bạn chưa theo dõi ai. Mở hồ sơ một người rồi bấm “Theo dõi” để nhận thông báo khi
        họ đăng bài mới.
      </p>
    );
  }
  return (
    <ul className={css.danh_sach_sub} data-testid="tab-user-danh-sach">
      {items.map((u) => (
        <li key={u.username} className={css.dong_sub} data-testid="dong-user">
          <Avatar ten={u.username} hienThi={u.display_name} url={u.avatar_url} co={36} />
          <div className={css.sub_chu}>
            <Link href={`/u/${u.username}`} className={css.sub_ten} {...CHU_NGUOI_DUNG}>
              {u.display_name || u.username}
            </Link>
            <p className={`${css.sub_slug} mono`} {...CHU_NGUOI_DUNG}>
              u/{u.username}
            </p>
          </div>
          <NutBoTheoUser
            username={u.username}
            onBoXong={() =>
              datItems((truoc) => (truoc ?? []).filter((x) => x.username !== u.username))
            }
          />
        </li>
      ))}
    </ul>
  );
}
