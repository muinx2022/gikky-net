"use client";

import {
  danhDauDaXem,
  xemMachCuaToi,
  type MachCuaToiOut,
} from "@gikky/api-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import type { DichVote } from "@/lib/vote";

/** Nửa **per-user** của trang mạch — `GET /machs/{id}/me`, hỏi ở TRÌNH DUYỆT.
 *
 * ## Vì sao ở client, và vì sao đó là điều bắt buộc chứ không phải một lựa chọn
 *
 * Trang mạch có bản cache (PLAN 8.4, `lib/api.ts::TUOI_CACHE_MACH`). Mọi thứ nướng vào
 * HTML của nó sẽ được phục vụ lại cho **người tiếp theo mở cùng URL**. Phiếu của tôi, tôi
 * có theo mạch không, tôi đọc tới mốc nào — cả ba là dữ liệu của một người, nên cả ba đi
 * qua đây, **sau khi** trang đã render.
 *
 * Đó cũng là lý do `GET /machs/{id}` cố ý không chứa trường nào per-user
 * (`api/tests/test_api_mach.py::MANH_PER_USER` là hàng rào cho chuyện đó, ở phía Django).
 * Đừng "chữa" độ trễ một nhịp ở đây bằng cách xin server nhét sẵn `my_vote` vào response
 * trang mạch: đó đúng là dữ liệu người này được cache rồi giao cho người kia, HTTP 200,
 * không có gì đỏ.
 *
 * ## `POST /seen` chạy SAU khi đã đọc xong, và không được ghi đè con số đang render
 *
 * PLAN 5.5: *"Mốc mới nhất mở sẵn được tính là đã xem (client gọi `POST /machs/{id}/seen`
 * khi trang mở)"*. Nhưng **vạch mới của chính lượt xem này** phải kẻ theo vị trí đọc lúc
 * MỞ trang, không phải lúc sau. Nên thứ tự là: đọc `/me` → giữ nguyên con số ấy trong
 * state → rồi mới `POST /seen`, và **kết quả của `POST` không được đổ ngược vào state**.
 * Làm ngược lại thì vạch mới biến mất ngay trước mắt người vừa mở trang, tức nó không bao
 * giờ xuất hiện với bất kỳ ai.
 *
 * Ngoài trang mạch (feed, hồ sơ) không ai bọc provider này — `useTrangThaiToi()` trả
 * trạng thái rỗng, và `CotVote` ở đó vẽ hai mũi tên trung tính. Đúng: thẻ ở feed không
 * nằm trong mạch nào.
 */

type NguCanh = {
  /** `null` = chưa hỏi xong, hoặc ngoài trang mạch. */
  trangThai: MachCuaToiOut | null;
  dangTai: boolean;
  /** Phiếu của tôi trên một đích, `0` khi chưa vote (hoặc chưa biết). */
  phieuCua: (dich: DichVote) => -1 | 0 | 1;
  /** Hỏi lại `/me` — gọi sau khi theo/bỏ theo, hoặc sau khi đăng nhập. */
  taiLai: () => Promise<void>;
  /** Cập nhật **lạc quan** cờ theo mạch, không đợi một vòng `/me` nữa. */
  datTheoMach: (dangTheo: boolean) => void;
};

const RONG: NguCanh = {
  trangThai: null,
  dangTai: false,
  phieuCua: () => 0,
  taiLai: async () => {},
  datTheoMach: () => {},
};

const Ngu = createContext<NguCanh>(RONG);

export function TrangThaiToiProvider({
  machId,
  children,
}: {
  machId: number;
  children: React.ReactNode;
}) {
  const [trangThai, datTrangThai] = useState<MachCuaToiOut | null>(null);
  const [dangTai, datDangTai] = useState(true);
  // `POST /seen` đúng MỘT lần cho mỗi lượt mở trang. `taiLai()` sau khi bấm "Theo mạch"
  // không được kéo theo một lượt ghi vị trí đọc nữa — nó là một hành động khác.
  const daBaoDaXem = useRef(false);

  const taiLai = useCallback(async () => {
    // `/machs/{id}/me` không có đường 401: khách nhận 200 kèm `dang_nhap: false`. Nên
    // `data` vắng mặt chỉ có thể là hỏng mạng, và ca đó UI hiện như khách — trang mạch
    // không phải chỗ báo sự cố hạ tầng.
    const kq = await xemMachCuaToi({
      baseUrl: GOC_TRINH_DUYET,
      cache: "no-store",
      path: { mach_id: machId },
    });
    datTrangThai(kq.data ?? null);
    datDangTai(false);
    return kq.data ?? null;
  }, [machId]);

  useEffect(() => {
    let con_song = true;
    void (async () => {
      const toi = await taiLai();
      if (!con_song || toi === null || !toi.dang_nhap) return;
      if (daBaoDaXem.current) return;
      daBaoDaXem.current = true;
      // `entry_seq` vắng mặt = "đã xem tới mốc mới nhất" (`api/theo_doi.py`). Người chưa
      // theo mạch nhận 200 kèm `following: false` và không có gì được ghi — đó là câu trả
      // lời đúng, không phải lỗi, nên không có nhánh xử lý nào ở đây.
      //
      // ⚠ Kết quả **cố ý bị bỏ**: xem docstring đầu file.
      try {
        await danhDauDaXem({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { mach_id: machId },
          body: { entry_seq: null },
        });
      } catch {
        // Ghi vị trí đọc hỏng thì lần sau vạch mới hiện lại từ chỗ cũ. Phiền, không sai —
        // và một dòng lỗi đỏ trên trang vì một cái bookmark là phiền hơn nhiều.
      }
    })();
    return () => {
      con_song = false;
    };
  }, [machId, taiLai]);

  const phieuCua = useCallback(
    (dich: DichVote): -1 | 0 | 1 => {
      const v = trangThai?.my_votes.find(
        (x) => x.target_type === dich.loai && x.target_id === dich.id,
      );
      return v === undefined ? 0 : v.value === 1 ? 1 : -1;
    },
    [trangThai],
  );

  const datTheoMach = useCallback((dangTheo: boolean) => {
    datTrangThai((cu) => (cu === null ? cu : { ...cu, following: dangTheo }));
  }, []);

  return (
    <Ngu.Provider
      value={{
        trangThai,
        dangTai,
        phieuCua,
        taiLai: async () => {
          await taiLai();
        },
        datTheoMach,
      }}
    >
      {children}
    </Ngu.Provider>
  );
}

export function useTrangThaiToi(): NguCanh {
  return useContext(Ngu);
}
