"use client";

import {
  quanTriDatAnBinhLuan,
  quanTriLietKeBinhLuan,
  type BinhLuanDongOut,
  type QuanTriLietKeBinhLuanData,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ONhoChon, ThanhHangLoat, useChonHang } from "../../components/hang-loat";
import { useQuanTri } from "../../components/khung/ngu-canh";
import {
  HangTieuDe,
  HienLoi,
  KhoiRong,
  KhungBang,
  NhanTrangThai,
  Skeleton,
  ThanhPhanTrang,
  The,
  TieuDeTrang,
  gioVN,
} from "../../components/ui";
import { GOC_API, MA_CHUA_DANG_NHAP, headerGhi, maLoi } from "../../lib/api";
import { useDanhSach } from "../../lib/danh-sach";
import { useHanhDong } from "../../lib/hanh-dong";
import { locCanLam, tomTatHangLoat } from "../../lib/hang-loat";

/** Số hàng mỗi trang. Một hằng cho CẢ HAI phía: `limit` gửi lên server và mẫu số để
 * `useDanhSach` chia ra `so_trang`. Hai con số này lệch nhau thì thanh phân trang báo
 * sai số trang mà không có gì nổ — chỉ là một cái "Trang 1/12" trên một bảng 6 trang. */
const MOI_TRANG = 25;

/** Bảng bình luận — gồm **cả bia mộ và bình luận đã bị ẩn**.
 *
 * Bia mộ có mặt vì `deleted_at` không xoá `body` khỏi DB (PLAN 5.3 giữ chỗ khi bình luận
 * có reply hoặc đã từng được trích), và mod đôi khi cần đọc đúng cái tác giả rút lại sau
 * khi bị tố. Không có bảng này thì thứ duy nhất đọc được nó là `manage.py shell`.
 *
 * Bộ lọc ở đây là **state cục bộ**, không phải URL — khác trang mạch. Lý do: không có lối
 * nào từ ngoài đẩy tới đây kèm bộ lọc (ô tìm trên thanh trên đi tới `/machs`), nên một
 * bộ lọc trong URL chỉ thêm một tầng đồng bộ không ai dùng.
 */
type LocTrangThai = NonNullable<
  NonNullable<QuanTriLietKeBinhLuanData["query"]>["trang_thai"]
>;

const CHU_LOC: Record<LocTrangThai, string> = {
  tat_ca: "Tất cả",
  hien: "Đang hiện",
  bi_an: "Bị ẩn",
  bia_mo: "Bia mộ",
};

export default function TrangBinhLuan() {
  const { lamMoi } = useQuanTri();
  const [q, datQ] = useState("");
  const [o_tim, datOTim] = useState("");
  const [trang_thai, datTrangThai] = useState<LocTrangThai>("tat_ca");
  /** Câu tổng kết của lượt hàng loạt gần nhất, hoặc `null`. Sống tới lượt sau — xem
   * `ThanhHangLoat`. */
  const [tom_tat, datTomTat] = useState<string | null>(null);

  const nap = useCallback(
    (cursor: string | null) =>
      quanTriLietKeBinhLuan({
        baseUrl: GOC_API,
        cache: "no-store",
        query: { q, trang_thai, limit: MOI_TRANG, cursor },
      }),
    [q, trang_thai],
  );

  const ds = useDanhSach<BinhLuanDongOut>(nap, MOI_TRANG);
  const chon = useChonHang(ds.items);

  const {
    dang_chay,
    loi: loi_hanh_dong,
    het_phien,
    chay,
  } = useHanhDong(async () => {
    await ds.napLai();
    await lamMoi();
  });

  // Câu tóm tắt kể về MỘT lượt — đổi trang hay đổi bộ lọc thì xoá. Nút ĐƠN trên hàng
  // thì cố ý KHÔNG xoá ("Lỗi ở: …" là danh sách việc mod đang sửa tay từng cái). Hai
  // ràng buộc đầy đủ ghi ở chỗ cùng tên trong `app/machs/page.tsx`.
  useEffect(() => datTomTat(null), [nap, ds.trang]);

  /** Ẩn / gỡ ẩn **tuần tự** từng bình luận đã chọn.
   *
   * `for … await`, KHÔNG `Promise.all`. Hai lý do, cả hai đã có giá phải trả ghi trong
   * `CLAUDE.md`: mỗi lời gọi khoá hàng `Comment` rồi hàng `Mach` (`cap_nhat_dem_mach`),
   * nên 25 request đồng thời trên cùng một bài là 25 giao dịch tranh đúng một hàng khoá;
   * và một cú bấm không nên dội 25 request cùng lúc vào server.
   *
   * Lỗi con thì ghi lại rồi đi tiếp — mod bấm một lần cho 25 hàng thì một hàng hỏng không
   * được làm hỏng 24 hàng còn lại. Ngoại lệ duy nhất là `chua_dang_nhap`: phiên đã hết
   * thì mọi lời gọi sau đều hỏng y hệt, nên chạy tiếp chỉ để đếm ra 24 lỗi giống nhau.
   */
  const anHangLoat = (an: boolean) => {
    datTomTat(null);
    return chay(async () => {
      const muc_tieu = locCanLam(ds.items ?? [], chon.da_chon, (c) => c.da_bi_an, an);
      let da_doi = 0;
      let von_vay = 0;
      const that_bai: number[] = [];
      for (const id of muc_tieu) {
        const { data, error } = await quanTriDatAnBinhLuan({
          baseUrl: GOC_API,
          headers: headerGhi(),
          path: { comment_id: id },
          // `ly_do: ""` — đồng nhất với nút đơn trên từng hàng.
          body: { an, ly_do: "" },
        });
        if (error === undefined) {
          // `da_doi=false` = một mod khác đổi trước — không được đếm là "đã đổi".
          if (data?.da_doi === true) da_doi += 1;
          else von_vay += 1;
          continue;
        }
        if (maLoi(error) === MA_CHUA_DANG_NHAP) {
          // Dừng sớm: mọi hàng chưa xử lý (kể cả hàng vừa chết vì phiên) vào `bo_do` —
          // KHÔNG vào cột thành công. Nhánh này từng đếm nhầm "10/10 thành công" cho
          // một lượt dừng ở hàng thứ 4.
          const bo_do = muc_tieu.length - da_doi - von_vay - that_bai.length;
          datTomTat(tomTatHangLoat({ da_doi, von_vay, that_bai, bo_do }));
          return { error };
        }
        that_bai.push(id);
      }
      datTomTat(tomTatHangLoat({ da_doi, von_vay, that_bai, bo_do: 0 }));
      return {};
    });
  };

  const co_bo_loc = q !== "" || trang_thai !== "tat_ca";

  return (
    <>
      <TieuDeTrang mo_ta="Gồm cả bia mộ và bình luận đã bị ẩn." />
      <HienLoi loi={loi_hanh_dong ?? ds.loi} het_phien={het_phien} />

      <The>
        <div className="flex flex-wrap items-center gap-2 border-b border-vien p-3">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              // Backstop cho nút submit `disabled`: bộ lọc ở trang này là state trực
              // tiếp nên đổi `nap` là TỨC THÌ — giữa một lượt hàng loạt thì không được.
              if (dang_chay) return;
              datQ(o_tim.trim());
            }}
          >
            <label className="sr-only" htmlFor="loc-q-binh-luan">
              Lọc theo nội dung
            </label>
            <input
              id="loc-q-binh-luan"
              className="o-nhap w-56"
              placeholder="Nội dung chứa…"
              value={o_tim}
              onChange={(e) => datOTim(e.target.value)}
              data-testid="loc-q-binh-luan"
            />
            <button type="submit" className="nut" disabled={dang_chay}>
              Lọc
            </button>
          </form>

          <label className="sr-only" htmlFor="loc-trang-thai-binh-luan">
            Lọc theo trạng thái
          </label>
          {/* `disabled={dang_chay}` trên cả cụm lọc: đổi bộ lọc giữa một lượt hàng loạt
              là đổi `nap` trong khi vòng lặp còn chạy trên bảng cũ — khoá tới khi xong. */}
          <select
            id="loc-trang-thai-binh-luan"
            className="nut cursor-pointer"
            value={trang_thai}
            disabled={dang_chay}
            onChange={(e) => datTrangThai(e.target.value as LocTrangThai)}
            data-testid="loc-trang-thai-binh-luan"
          >
            {(Object.keys(CHU_LOC) as LocTrangThai[]).map((x) => (
              <option key={x} value={x}>
                {CHU_LOC[x]}
              </option>
            ))}
          </select>

          {co_bo_loc && (
            <button
              type="button"
              className="nut nut-nho ml-auto"
              disabled={dang_chay}
              onClick={() => {
                datOTim("");
                datQ("");
                datTrangThai("tat_ca");
              }}
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        <ThanhHangLoat
          so_chon={chon.da_chon.size}
          dang_chay={dang_chay}
          tom_tat={tom_tat}
          xoaChon={chon.xoaChon}
        >
          <button
            type="button"
            className="nut nut-nho"
            disabled={dang_chay}
            onClick={() => void anHangLoat(true)}
            data-testid="nut-hl-an"
          >
            Ẩn
          </button>
          <button
            type="button"
            className="nut nut-nho"
            disabled={dang_chay}
            onClick={() => void anHangLoat(false)}
            data-testid="nut-hl-go-an"
          >
            Gỡ ẩn
          </button>
        </ThanhHangLoat>

        {ds.items === null ? (
          <Skeleton />
        ) : ds.items.length === 0 ? (
          <KhoiRong co_bo_loc={co_bo_loc} chua_co="Chưa có bình luận nào." />
        ) : (
          <KhungBang>
            <HangTieuDe
              cot={[
                <ONhoChon
                  key="chon"
                  chon={
                    ds.items.length > 0 && chon.da_chon.size === ds.items.length
                  }
                  doi={chon.chonCaTrang}
                  khoa={dang_chay}
                  nhan="Chọn cả trang"
                  testid="chon-tat-ca"
                />,
                "Nội dung",
                "Tác giả",
                "Bài viết",
                "Điểm",
                "Lúc",
                "",
              ]}
            />
            <tbody>
              {ds.items.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-vien last:border-0 hover:bg-nen-mo/50"
                  data-testid={`hang-binh-luan-${c.id}`}
                >
                  <td className="px-3 py-2.5">
                    <ONhoChon
                      chon={chon.da_chon.has(c.id)}
                      doi={(v) => chon.doi(c.id, v)}
                      khoa={dang_chay}
                      nhan={`Chọn bình luận: ${c.trich_yeu}`}
                      testid={`chon-binh-luan-${c.id}`}
                    />
                  </td>
                  <td className="max-w-lg px-3 py-2.5">
                    <span className="block">{c.trich_yeu}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {c.da_bi_an && <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>}
                      {c.da_xoa && <NhanTrangThai tone="chu-y">bia mộ</NhanTrangThai>}
                    </span>
                  </td>
                  <td className="mono px-3 py-2.5 text-xs">
                    <Link
                      href={`/u/${c.tac_gia.username}`}
                      className="hover:underline"
                    >
                      u/{c.tac_gia.username}
                    </Link>
                  </td>
                  <td className="max-w-xs px-3 py-2.5 text-xs">
                    <Link
                      href={`/m/${c.mach_id}`}
                      className="text-nhan hover:underline"
                    >
                      {c.mach_title}
                    </Link>
                  </td>
                  <td className="mono px-3 py-2.5">{c.score}</td>
                  <td className="mono px-3 py-2.5 text-xs text-muc-mo">
                    {gioVN(c.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        className="nut nut-nho"
                        disabled={dang_chay}
                        data-testid={`nut-an-binh-luan-${c.id}`}
                        onClick={() =>
                          chay(() =>
                            quanTriDatAnBinhLuan({
                              baseUrl: GOC_API,
                              headers: headerGhi(),
                              path: { comment_id: c.id },
                              body: { an: !c.da_bi_an, ly_do: "" },
                            }),
                          )
                        }
                      >
                        {c.da_bi_an ? "Gỡ ẩn" : "Ẩn"}
                      </button>
                      {/* **Luật ba đường** (L30): mũi tên `↗` một mình đọc lên thành
                          "liên kết, mũi tên đông bắc" — đúng ký tự, không có thông tin
                          nào. `title` cho người rê chuột, `aria-label` kèm trích yếu cho
                          trình đọc màn hình. Cùng mẫu với `/machs`. */}
                      <a
                        href={c.duong_dan_cong_khai}
                        target="_blank"
                        rel="noreferrer"
                        className="nut nut-nho"
                        title="Mở trang công khai"
                        aria-label={`Mở trang công khai của bình luận: ${c.trich_yeu}`}
                      >
                        ↗
                      </a>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </KhungBang>
        )}

        <ThanhPhanTrang
          trang={ds.trang}
          so_trang={ds.so_trang}
          tong={ds.tong}
          co_truoc={ds.co_truoc}
          co_sau={ds.co_sau}
          dang_tai={ds.dang_tai}
          // Khoá lật trang trong lúc vòng lặp hàng loạt còn chạy — xem ghi chú cùng chỗ
          // ở `app/machs/page.tsx`.
          khoa={dang_chay}
          onTruoc={ds.truoc}
          onSau={ds.sau}
          ten_muc="bình luận"
        />
      </The>
    </>
  );
}
