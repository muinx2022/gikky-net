"use client";

import {
  quanTriDatAnMach,
  quanTriDatKhoaMach,
  quanTriLietKeMach,
  type MachDongOut,
  type QuanTriLietKeMachData,
} from "@gikky/api-client/admin";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { Icon } from "../../components/icon";
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
import { GOC_API, headerGhi, moTaLoi } from "../../lib/api";
import { useDanhSach } from "../../lib/danh-sach";

/** Số hàng mỗi trang. Một hằng cho CẢ HAI phía: `limit` gửi lên server và mẫu số để
 * `useDanhSach` chia ra `so_trang`. Hai con số này lệch nhau thì thanh phân trang báo
 * sai số trang mà không có gì nổ — chỉ là một cái "Trang 1/12" trên một bảng 6 trang. */
const MOI_TRANG = 25;

/** Bảng mạch — cửa để mod tìm thứ **chưa ai tố**.
 *
 * Trước Phase 8 khu quản trị chỉ mở được một mạch khi biết chính xác `id`, hoặc khi nó
 * xuất hiện trong một hàng báo cáo. Nghĩa là mod xử lý được thứ có người tố và không xử
 * lý được thứ mod tự phát hiện.
 *
 * ## Bảng này thấy CẢ mạch đã bị ẩn
 *
 * Và đó là lý do nó tồn tại: gỡ ẩn chỉ làm được từ một chỗ nhìn thấy thứ đã ẩn. Lọc
 * `hidden_at__isnull=True` cho "sạch" là làm mù đúng cửa duy nhất gỡ được.
 *
 * ## Bộ lọc nằm trong URL
 *
 * Ô tìm trên thanh trên đẩy tới `/machs?q=…`, và mod dán link cho nhau được. `useSearchParams`
 * đòi một `<Suspense>` bao ngoài khi Next prerender trang — đó là lý do có hai component.
 */
type LocTrangThai = NonNullable<
  NonNullable<QuanTriLietKeMachData["query"]>["trang_thai"]
>;

// Thứ tự khai = thứ tự trong ô chọn. `chua_go` đứng ngay dưới `tat_ca` vì hai cái đó là
// hai lựa chọn "xem rộng"; ba nhóm rời nhau ở dưới là để soi từng trục một.
const CHU_LOC: Record<LocTrangThai, string> = {
  // "kể cả đã ẩn" nói ra thành chữ: trên một site đã kiểm duyệt nhiều thì phần lớn dòng
  // đầu bảng LÀ bài đã ẩn — người chọn mục này mà không biết sẽ tưởng bảng hỏng.
  tat_ca: "Tất cả (kể cả đã ẩn)",
  chua_go: "Đang hiển thị (chưa bị ẩn)",
  mo: "Đang mở",
  dong: "Đã đóng sổ",
  bi_khoa: "Bị khoá",
  bi_an: "Bị ẩn",
};

export default function TrangMach() {
  return (
    <Suspense
      fallback={
        <The>
          <Skeleton />
        </The>
      }
    >
      <BangMach />
    </Suspense>
  );
}

function BangMach() {
  const router = useRouter();
  const tham_so = useSearchParams();
  const { lamMoi } = useQuanTri();

  const q = tham_so.get("q") ?? "";
  const sub = tham_so.get("sub") ?? "";
  const tac_gia = tham_so.get("tac_gia") ?? "";
  /** Mặc định **"Đang hiển thị"** = mọi bài CHƯA BỊ ẨN, không phải "Tất cả".
   *
   * Trên một site đã kiểm duyệt nhiều thì phần lớn bài MỚI NHẤT là bài vừa bị ẩn — và
   * bảng sắp mới-trước, nên mở `/machs` ra là một màn hình toàn nhãn "đã ẩn". Mod vào đây
   * để nhìn nội dung đang sống; thứ đã gỡ thì lọc khi cần (user chốt 2026-08-23).
   *
   * ⚠ **Từng là `"mo"`, và đó là một lỗi thật** *(sửa 2026-08-24)*. `mo` là trục **sổ**
   * — "tác giả đã đóng sổ hay chưa" — không dính gì tới chuyện bài có bị gỡ không. Nên
   * mặc định ấy giấu luôn mọi mạch **đã đóng sổ** và **bị khoá**, dù chúng đang hiển thị
   * bình thường trên site. User bắt được ngay hôm sau: một bài HPG `status=closed`,
   * không ẩn không khoá, **vắng mặt ở trang 1** mà tìm theo tiêu đề thì lại ra.
   *
   * Đóng sổ là kết thúc bình thường do chính tác giả bấm, không phải một phán quyết của
   * mod. Trục cần giấu chỉ có một: **ẩn**.
   *
   * ⚠ **Trừ khi đang TÌM.** `?q=` mà cũng bó vào "chưa bị ẩn" thì mod gõ đúng tiêu đề bài
   * mình vừa ẩn sẽ nhận về "không có gì khớp" — đúng lúc họ cần tìm nó nhất để gỡ ẩn.
   * Duyệt thì mặc định hẹp, tìm thì mặc định rộng. */
  const mac_dinh: LocTrangThai = q === "" ? "chua_go" : "tat_ca";
  const trang_thai = (tham_so.get("trang_thai") ?? mac_dinh) as LocTrangThai;

  const [o_tim, datOTim] = useState(q);

  // Ô lọc phải theo URL, không chỉ khởi tạo một lần. Ô tìm trên thanh trên đẩy tới
  // `/machs?q=…` bằng điều hướng phía client — component KHÔNG mount lại, nên `useState(q)`
  // giữ nguyên giá trị cũ: bộ lọc đang chạy mà ô lọc trông như trống. Người dùng thấy một
  // bảng đã lọc và một ô rỗng, rồi kết luận bảng đang hiện tất cả.
  useEffect(() => datOTim(q), [q]);
  const [dang_chay, datDangChay] = useState(false);
  const [loi_hanh_dong, datLoiHanhDong] = useState<string | null>(null);

  const nap = useCallback(
    (cursor: string | null) =>
      quanTriLietKeMach({
        baseUrl: GOC_API,
        cache: "no-store",
        query: {
          q,
          sub: sub === "" ? null : sub,
          tac_gia: tac_gia === "" ? null : tac_gia,
          trang_thai,
          limit: MOI_TRANG,
          cursor,
        },
      }),
    [q, sub, tac_gia, trang_thai],
  );

  const ds = useDanhSach<MachDongOut>(nap, MOI_TRANG);

  const datLoc = (khoa: string, gia_tri: string) => {
    const moi = new URLSearchParams(tham_so.toString());
    // Bỏ tham số khi nó TRÙNG MẶC ĐỊNH — URL sạch thì link dán cho nhau đọc được. Nhưng
    // mặc định của `trang_thai` đổi theo việc có `?q=` hay không, nên **luôn ghi tường
    // minh** nó: bỏ đi lúc đang tìm là bộ lọc tự nhảy từ "đang mở" sang "tất cả".
    const bo_duoc =
      khoa === "trang_thai" ? q === "" && gia_tri === "chua_go" : gia_tri === "";
    if (bo_duoc) moi.delete(khoa);
    else moi.set(khoa, gia_tri);
    router.push(`/machs${moi.size > 0 ? `?${moi}` : ""}`);
  };

  const chay = useCallback(
    async (viec: () => Promise<{ error?: unknown }>) => {
      datDangChay(true);
      datLoiHanhDong(null);
      try {
        const { error } = await viec();
        if (error !== undefined) {
          datLoiHanhDong(moTaLoi(error));
          return;
        }
        await ds.napLai();
        await lamMoi();
      } finally {
        datDangChay(false);
      }
    },
    [ds, lamMoi],
  );

  const co_bo_loc =
    q !== "" || sub !== "" || tac_gia !== "" || trang_thai !== mac_dinh;

  return (
    <>
      <TieuDeTrang
        mo_ta={
          trang_thai === "chua_go"
            ? "Đang xem bài CHƯA BỊ ẨN — gồm cả bài đã khoá và đã đóng sổ. Bài đã ẩn nằm ở bộ lọc bên dưới."
            : "Mỗi bài là một “mạch”: bài gốc cộng các mốc tác giả nối thêm về sau."
        }
      />
      <HienLoi loi={loi_hanh_dong ?? ds.loi} />

      <The>
        <div className="flex flex-wrap items-center gap-2 border-b border-vien p-3">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              datLoc("q", o_tim.trim());
            }}
          >
            <label className="sr-only" htmlFor="loc-q">
              Lọc theo tiêu đề
            </label>
            <input
              id="loc-q"
              className="o-nhap w-56"
              placeholder="Tiêu đề chứa…"
              value={o_tim}
              onChange={(e) => datOTim(e.target.value)}
              data-testid="loc-q"
            />
            <button type="submit" className="nut">
              Lọc
            </button>
          </form>

          <label className="sr-only" htmlFor="loc-trang-thai">
            Lọc theo trạng thái
          </label>
          <select
            id="loc-trang-thai"
            className="nut cursor-pointer"
            value={trang_thai}
            onChange={(e) => datLoc("trang_thai", e.target.value)}
            data-testid="loc-trang-thai"
          >
            {(Object.keys(CHU_LOC) as LocTrangThai[]).map((x) => (
              <option key={x} value={x}>
                {CHU_LOC[x]}
              </option>
            ))}
          </select>

          {(sub !== "" || tac_gia !== "") && (
            <span className="mono flex items-center gap-2 text-xs text-muc-mo">
              {sub !== "" && <span>s/{sub}</span>}
              {tac_gia !== "" && <span>u/{tac_gia}</span>}
            </span>
          )}

          {co_bo_loc && (
            <button
              type="button"
              className="nut nut-nho ml-auto"
              onClick={() => {
                datOTim("");
                router.push("/machs");
              }}
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        {ds.items === null ? (
          <Skeleton />
        ) : ds.items.length === 0 ? (
          <KhoiRong co_bo_loc={co_bo_loc} chua_co="Chưa có bài viết nào." />
        ) : (
          <KhungBang>
            <HangTieuDe
              cot={[
                "Bài viết",
                "Chuyên mục",
                "Tác giả",
                "Số mốc",
                "Bình luận",
                "Điểm",
                "Tạo lúc",
                "",
              ]}
            />
            <tbody>
              {ds.items.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-vien last:border-0 hover:bg-nen-mo/50"
                  data-testid={`hang-mach-${m.id}`}
                >
                  <td className="max-w-md px-3 py-2.5">
                    <Link
                      href={`/m/${m.id}`}
                      className="font-medium text-nhan hover:underline"
                    >
                      {m.title}
                    </Link>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {m.da_bi_an && <NhanTrangThai tone="xau">đã ẩn</NhanTrangThai>}
                      {m.da_khoa && <NhanTrangThai tone="xau">bị khoá</NhanTrangThai>}
                      {m.status === "closed" && (
                        <NhanTrangThai tone="nhan">đã đóng sổ</NhanTrangThai>
                      )}
                    </span>
                  </td>
                  <td className="mono px-3 py-2.5 text-xs">
                    <Link
                      href={`/machs?sub=${m.sub_slug}`}
                      className="hover:underline"
                    >
                      s/{m.sub_slug}
                    </Link>
                  </td>
                  <td className="mono px-3 py-2.5 text-xs">
                    <Link
                      href={`/u/${m.tac_gia.username}`}
                      className="hover:underline"
                    >
                      u/{m.tac_gia.username}
                    </Link>
                  </td>
                  <td className="mono px-3 py-2.5">{m.entry_count}</td>
                  <td className="mono px-3 py-2.5">{m.comment_count}</td>
                  <td className="mono px-3 py-2.5">{m.diem}</td>
                  <td className="mono px-3 py-2.5 text-xs text-muc-mo">
                    {gioVN(m.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    {/* Ba icon MỘT HÀNG (user chốt 2026-08-24). `flex-nowrap` + `shrink-0`
                        là cặp không tách được: bỏ `flex-nowrap` thì cột hẹp lại đẩy nút
                        thứ ba xuống dòng; bỏ `shrink-0` thì ba nút co lại chồng lên nhau.
                        Nhãn chuyển sang icon để hàng đủ hẹp mà không phải nới cột.

                        **Luật ba đường** (L30): icon một mình thì trình đọc màn hình
                        không đọc được gì (icon `aria-hidden`), nên `aria-label` + `title`
                        là bắt buộc, không phải trang trí — và cả hai đổi theo trạng thái,
                        vì cùng một nút vừa "Ẩn" vừa "Gỡ ẩn". */}
                    <span className="flex flex-nowrap items-center justify-end gap-1">
                      <button
                        type="button"
                        className="nut nut-nho shrink-0 px-1.5"
                        disabled={dang_chay}
                        data-testid={`nut-an-${m.id}`}
                        title={m.da_bi_an ? "Gỡ ẩn" : "Ẩn"}
                        aria-label={m.da_bi_an ? `Gỡ ẩn: ${m.title}` : `Ẩn: ${m.title}`}
                        onClick={() =>
                          chay(() =>
                            quanTriDatAnMach({
                              baseUrl: GOC_API,
                              headers: headerGhi(),
                              path: { mach_id: m.id },
                              body: { an: !m.da_bi_an, ly_do: "" },
                            }),
                          )
                        }
                      >
                        <Icon ten={m.da_bi_an ? "hien" : "an"} className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="nut nut-nho shrink-0 px-1.5"
                        disabled={dang_chay}
                        data-testid={`nut-khoa-${m.id}`}
                        title={m.da_khoa ? "Mở khoá" : "Khoá"}
                        aria-label={
                          m.da_khoa ? `Mở khoá: ${m.title}` : `Khoá: ${m.title}`
                        }
                        onClick={() =>
                          chay(() =>
                            quanTriDatKhoaMach({
                              baseUrl: GOC_API,
                              headers: headerGhi(),
                              path: { mach_id: m.id },
                              body: { khoa: !m.da_khoa, ly_do: "" },
                            }),
                          )
                        }
                      >
                        <Icon
                          ten={m.da_khoa ? "mo-khoa" : "khoa"}
                          className="size-4"
                        />
                      </button>
                      <a
                        href={m.duong_dan_cong_khai}
                        target="_blank"
                        rel="noreferrer"
                        className="nut nut-nho shrink-0 px-1.5"
                        title="Mở trang công khai"
                        aria-label={`Mở trang công khai của: ${m.title}`}
                      >
                        <Icon ten="mo-ngoai" className="size-4" />
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
          onTruoc={ds.truoc}
          onSau={ds.sau}
          ten_muc="bài"
        />
      </The>
    </>
  );
}
