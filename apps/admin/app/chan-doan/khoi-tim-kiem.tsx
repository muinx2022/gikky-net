"use client";

import {
  quanTriChanDoanTimKiem,
  type ChanDoanTimKiemOut,
} from "@gikky/api-client/admin";
import { useEffect, useState } from "react";

import { GOC_API } from "../../lib/api";

/** Khối "Tìm kiếm" của trang chẩn đoán — trả `P-20260827-2` (2026-08-30).
 *
 * ## Câu hỏi nó trả lời, và vì sao trước đây không ai trả lời được
 *
 * Chỉ mục Meilisearch có thể lệch Postgres **im lặng tuyệt đối**: đường ghi index nuốt
 * lỗi có chủ đích (`core/tim_kiem.py` — mất index còn hơn mất bài), còn lớp lọc thứ hai ở
 * `api/tim_kiem.py` che mọi hậu quả nhìn thấy được (index lệch chỉ làm trang *thiếu
 * dòng*, không làm nó *sai*). Cộng lại: không màn hình nào nói được *"index có khớp DB
 * không"*, và một `MEILI_KEY` hết quyền chạy được hàng tuần trước khi ai đó tình cờ nhận
 * ra bình luận không tìm được.
 *
 * Khối này **chỉ đọc và nói to**. Nó không sửa gì — sửa là việc của
 * `manage.py reindex_tim_kiem`, và câu chú dưới mỗi dòng lệch nói thẳng ra điều đó.
 *
 * ## Ba trạng thái, KHÔNG phải hai
 *
 * `so_tai_lieu = null` là **không đọc được**, khác hẳn `0` ("đọc được, và nó rỗng"). Gộp
 * hai thứ ấy là để một khoá thiếu quyền trông y hệt một index chưa dựng — tức đúng cái
 * hỏng cần thấy nhất được vẽ như trạng thái bình thường nhất.
 *
 * ## Lệch vài đơn vị KHÔNG phải sự cố
 *
 * Meilisearch nhận tài liệu bất đồng bộ, nên ngay sau một lượt đăng bài con số chênh
 * trong khoảnh khắc. Màn hình nói ra điều đó thay vì hét lên — một cảnh báo kêu mỗi lần
 * có người đăng bài là một cảnh báo sẽ bị bỏ qua, kể cả ngày nó đúng.
 */
export function KhoiTimKiem() {
  const [du, datDu] = useState<ChanDoanTimKiemOut | null>(null);
  const [loi, datLoi] = useState<string | null>(null);

  useEffect(() => {
    let con_hieu_luc = true;
    void (async () => {
      const kq = await quanTriChanDoanTimKiem({
        baseUrl: GOC_API,
        cache: "no-store",
      });
      if (!con_hieu_luc) return;
      if (kq.data === undefined) {
        // 401/403 ở đây là chuyện của `CongQuanTri` (nó gác cả khu); mọi mã khác là một
        // trục trặc thật, và nói ra vẫn tốt hơn một khối trống mãi mãi.
        datLoi("Không đọc được số liệu chẩn đoán tìm kiếm.");
        return;
      }
      datDu(kq.data);
    })();
    return () => {
      con_hieu_luc = false;
    };
  }, []);

  if (loi !== null) {
    return (
      <p className="text-sm text-muc-mo" data-testid="chan-doan-tim-kiem-loi">
        {loi}
      </p>
    );
  }
  if (du === null) {
    return (
      <p className="text-sm text-muc-mo" data-testid="chan-doan-tim-kiem-dang-tai">
        đang đọc…
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm" data-testid="chan-doan-tim-kiem">
      <p>
        Meilisearch:{" "}
        <strong className="mono" data-testid="chan-doan-meili-song">
          {du.meili_song ? "sống" : "KHÔNG trả lời"}
        </strong>
      </p>

      <table className="w-full text-left">
        <thead>
          <tr className="text-muc-mo">
            <th className="py-1 font-medium">index</th>
            <th className="py-1 font-medium">Meilisearch</th>
            <th className="py-1 font-medium">Postgres (công khai)</th>
          </tr>
        </thead>
        <tbody>
          {du.cac_index.map((i) => (
            <tr key={i.ten} data-testid="chan-doan-index" data-index={i.ten}>
              <td className="mono py-1">{i.ten}</td>
              <td className="mono py-1" data-testid="chan-doan-so-tai-lieu">
                {i.so_tai_lieu === null ? "không đọc được" : i.so_tai_lieu}
              </td>
              <td className="mono py-1">{i.so_hang_postgres}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Nguyên tắc 9: khớp thì KHÔNG phô một khối "mọi thứ ổn". Chỉ lệch mới có chữ, và
          chữ ấy nói luôn phải làm gì. */}
      {du.co_lech ? (
        <div className="space-y-1" data-testid="chan-doan-lech">
          {du.cac_index
            .filter((i) => i.lech)
            .map((i) => (
              <p key={i.ten} className="text-sm">
                <strong className="mono">{i.ten}</strong>: {i.ghi_chu}
              </p>
            ))}
        </div>
      ) : (
        <p className="text-sm text-muc-mo" data-testid="chan-doan-khop">
          Chỉ mục khớp Postgres.
        </p>
      )}
    </div>
  );
}
