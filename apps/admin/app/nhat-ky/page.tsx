"use client";

import { quanTriLietKeNhatKy, type NhatKyOut } from "@gikky/api-client/admin";
import { useCallback, useEffect, useState } from "react";

import { CongQuanTri } from "../../components/cong-quan-tri";
import { gioVN } from "../../components/dung-mo-ta";
import { GOC_API, moTaLoi } from "../../lib/api";

/** Nhật ký hành động mod — PLAN 5.10 ("mọi hành động mod ghi AuditLog"), 9.3 mục 4.
 *
 * Bảng CHỈ ĐỌC, và không có nút xoá nào: một nhật ký xoá được là một nhật ký không dùng
 * làm bằng chứng được. API cũng không có cửa ghi/xoá — xem `api/quan_tri_nhat_ky.py`.
 */
export default function TrangNhatKy() {
  return (
    <CongQuanTri>
      <BangNhatKy />
    </CongQuanTri>
  );
}

function BangNhatKy() {
  const [items, setItems] = useState<NhatKyOut[] | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [loc, setLoc] = useState("");

  const nap = useCallback(async () => {
    setLoi(null);
    const { data, error } = await quanTriLietKeNhatKy({
      baseUrl: GOC_API,
      cache: "no-store",
      // Chuỗi rỗng ⇒ không lọc. Gửi `action: ""` xuống thì Django coi là falsy và bỏ qua
      // bộ lọc — cùng kết quả, nhưng gửi `undefined` giữ query string sạch.
      query: { limit: 50, action: loc === "" ? undefined : loc },
    });
    if (error !== undefined) setLoi(moTaLoi(error));
    else setItems(data.items);
  }, [loc]);

  useEffect(() => {
    void nap();
  }, [nap]);

  return (
    <>
      <h1>Nhật ký</h1>
      <p>
        <label>
          Lọc theo hành động (khớp BẰNG ĐÚNG){" "}
          <input
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="an_moc, ban_user, …"
          />
        </label>
      </p>
      <p className="mono">
        `an_moc` và `go_an_moc` là hai hành động khác nhau — bộ lọc so bằng đúng, không so
        khớp một phần, để lịch sử ẩn không đọc thành lịch sử gỡ ẩn.
      </p>

      {loi !== null && <div className="loi">{loi}</div>}
      {items === null && <p>Đang tải…</p>}
      {items !== null && items.length === 0 && <p>Không có dòng nào.</p>}

      {items !== null && items.length > 0 && (
        <div className="cuon-ngang">
          <table>
            <thead>
              <tr>
                <th>Lúc</th>
                <th>Ai</th>
                <th>Hành động</th>
                <th>Đích</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{gioVN(d.created_at)}</td>
                  <td className="mono">u/{d.actor.username}</td>
                  <td className="mono">{d.action}</td>
                  <td className="mono">
                    {d.target_type}#{d.target_id ?? "?"}
                  </td>
                  <td className="mono">{JSON.stringify(d.meta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
