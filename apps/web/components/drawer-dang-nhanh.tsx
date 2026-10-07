"use client";

import { noiMoc, taoMach, type SubChiTietOut } from "@gikky/api-client";
import { ImagePlus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { cauLoiTaiAnh, KIEU_NHAN, taiAnhLanLuot } from "@/lib/anh";
import { docCacSubOTrinhDuyet } from "@/lib/api";
import { MA_LOI, cauLoi, layDuLieu, LoiGhi } from "@/lib/ghi";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import { duongDanMach } from "@/lib/url";
import { gioPhutVN } from "@/lib/vong-doi";

import { ChonAnh } from "./chon-anh";
import css from "./drawer-dang-nhanh.module.css";
import { useModalDangNhap } from "./modal-dang-nhap";
import { usePhien } from "./phien";
import { SoanThao } from "./soan-thao";
import {
  TruongMoc,
  mocRong,
  thanMoc,
  DAI_BODY_MOC,
  type NoiDungMoc,
} from "./truong-moc";

export type ThongTinMachHienTai = {
  machId: number;
  tieuDeMach: string;
  soMoc: number;
  tranMocMoiNgay?: number;
};

type NguCanhDrawerDangNhanh = {
  moDrawer: () => void;
  moDrawerNoiMoc: (mach: ThongTinMachHienTai) => void;
  dongDrawer: () => void;
  dangMo: boolean;
  dangMachHienTai: ThongTinMachHienTai | null;
  dangKyMachHienTai: (mach: ThongTinMachHienTai | null) => void;
};

const DrawerCtx = createContext<NguCanhDrawerDangNhanh>({
  moDrawer: () => {},
  moDrawerNoiMoc: () => {},
  dongDrawer: () => {},
  dangMo: false,
  dangMachHienTai: null,
  dangKyMachHienTai: () => {},
});

export function useDrawerDangNhanh(): NguCanhDrawerDangNhanh {
  return useContext(DrawerCtx);
}

export function DrawerDangNhanhProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { toi } = usePhien();
  const { moModal } = useModalDangNhap();
  const pathname = usePathname();
  const router = useRouter();

  const [dangMo, setDangMo] = useState(false);
  const [lanMo, setLanMo] = useState(0);
  const [dangMachHienTai, setDangMachHienTai] =
    useState<ThongTinMachHienTai | null>(null);

  // Form states - Tạo bài viết
  const [cacSub, setCacSub] = useState<readonly SubChiTietOut[]>([]);
  const [subDangChon, setSubDangChon] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tatBinhLuan, setTatBinhLuan] = useState(false);
  const [riengTu, setRiengTu] = useState(false);
  const [anhs, setAnhs] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  // Form states - Nối mốc
  const [moc, setMoc] = useState<NoiDungMoc>(mocRong);
  const [mocAnhs, setMocAnhs] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const dangNhapRoi = toi?.dang_nhap === true;
  const tranAnh = toi?.tran_anh_moi_moc ?? 10;

  // Khi chuyển trang khác mà không phải /m/... thì reset đăng ký mạch hiện tại
  useEffect(() => {
    if (!pathname.startsWith("/m/")) {
      setDangMachHienTai(null);
    }
  }, [pathname]);

  // Nạp danh sách chuyên mục
  useEffect(() => {
    let vanCon = true;
    docCacSubOTrinhDuyet()
      .then((subs) => {
        if (!vanCon) return;
        setCacSub(subs);
        if (subs.length > 0) {
          const khop = pathname.match(/^\/s\/([^/?#]+)/);
          const slugUrl = khop ? khop[1] : null;
          if (slugUrl && subs.some((s) => s.slug === slugUrl)) {
            setSubDangChon(slugUrl);
          } else {
            setSubDangChon((hienTai) =>
              hienTai && subs.some((s) => s.slug === hienTai)
                ? hienTai
                : subs[0].slug,
            );
          }
        }
      })
      .catch(() => {});
    return () => {
      vanCon = false;
    };
  }, [pathname, subDangChon]);

  const moDrawer = useCallback(() => {
    if (!dangNhapRoi) {
      moModal();
      return;
    }
    setDangMachHienTai(null);
    setDangMo(true);
    setLoi(null);
    setLanMo((c) => c + 1);
  }, [dangNhapRoi, moModal]);

  const moDrawerNoiMoc = useCallback(
    (mach: ThongTinMachHienTai) => {
      if (!dangNhapRoi) {
        moModal();
        return;
      }
      setDangMachHienTai(mach);
      setMoc(mocRong());
      setMocAnhs([]);
      setDangMo(true);
      setLoi(null);
      setLanMo((c) => c + 1);
    },
    [dangNhapRoi, moModal],
  );

  const dongDrawer = useCallback(() => {
    setDangMo(false);
    setLoi(null);
    setDangMachHienTai(null);
    setMoc(mocRong());
    setMocAnhs([]);
  }, []);

  const dangKyMachHienTai = useCallback((mach: ThongTinMachHienTai | null) => {
    setDangMachHienTai(mach);
  }, []);

  // Khoá cuộn body và lắng nghe phím Escape khi drawer mở
  useEffect(() => {
    if (!dangMo) return;
    const scrollCu = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dongDrawer();
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = scrollCu;
      window.removeEventListener("keydown", handleKey);
    };
  }, [dangMo, dongDrawer]);

  // Xử lý chọn ảnh
  const xuLyChonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const dsMoi: File[] = [];
    const dsUrlMoi: string[] = [];

    const conLai = tranAnh - anhs.length;
    for (let i = 0; i < Math.min(files.length, conLai); i++) {
      const f = files[i];
      if (f.type.startsWith("image/")) {
        dsMoi.push(f);
        dsUrlMoi.push(URL.createObjectURL(f));
      }
    }

    setAnhs((cu) => [...cu, ...dsMoi]);
    setPreviewUrls((cu) => [...cu, ...dsUrlMoi]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const xoaAnh = (index: number) => {
    const url = previewUrls[index];
    if (url) URL.revokeObjectURL(url);
    setAnhs((cu) => cu.filter((_, i) => i !== index));
    setPreviewUrls((cu) => cu.filter((_, i) => i !== index));
  };

  // Chuyển sang form đầy đủ /dang-mach
  const chuyenSangDangChiTiet = () => {
    try {
      sessionStorage.setItem(
        "gikky_draft_dang_mach",
        JSON.stringify({
          sub: subDangChon,
          title: title.trim(),
          body: body.trim(),
          tatBinhLuan,
          riengTu,
        }),
      );
    } catch {
      // bỏ qua nếu private mode
    }
    dongDrawer();
    router.push(
      `/dang-mach${subDangChon ? `?sub=${encodeURIComponent(subDangChon)}` : ""}`,
    );
  };

  // Submit bài
  const xuLyGui = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (dangGui) return;
    setDangGui(true);
    setLoi(null);

    try {
      if (dangMachHienTai) {
        // Nối mốc vào bài hiện tại
        if (moc.body.trim() === "") {
          throw new Error("Nội dung mốc không được để trống.");
        }
        if (moc.body.length > DAI_BODY_MOC) {
          throw new LoiGhi(
            400,
            "",
            `Nội dung mốc vượt quá ${DAI_BODY_MOC.toLocaleString("vi-VN")} ký tự (hiện có ${moc.body.length.toLocaleString("vi-VN")} ký tự). Vui lòng rút gọn trước khi lưu.`,
          );
        }

        const mocMoi = layDuLieu(
          await noiMoc({
            baseUrl: GOC_TRINH_DUYET,
            headers: await headerGhi(),
            path: { mach_id: dangMachHienTai.machId },
            body: thanMoc(moc),
          }),
          "Không nối mốc được.",
        );

        if (mocAnhs.length > 0) {
          const kqAnh = await taiAnhLanLuot(mocMoi.id, mocAnhs);
          const loiAnh = cauLoiTaiAnh(kqAnh);
          if (loiAnh !== null) {
            setLoi(`Mốc đã nối, nhưng ${loiAnh}`);
            setDangGui(false);
            return;
          }
        }

        // Dọn form và reload trang để xem mốc mới
        setMoc(mocRong());
        setMocAnhs([]);
        dongDrawer();
        window.location.reload();
      } else {
        // Tạo mạch mới
        if (title.trim() === "" || body.trim() === "") {
          throw new Error("Cần nhập tiêu đề và nội dung bài viết.");
        }

        const mach = layDuLieu(
          await taoMach({
            baseUrl: GOC_TRINH_DUYET,
            headers: await headerGhi(),
            body: {
              sub: subDangChon,
              title: title.trim(),
              body: body.trim(),
              tat_binh_luan: tatBinhLuan,
              rieng_tu: riengTu,
            },
          }),
          "Không đăng được bài.",
        );

        if (anhs.length > 0 && mach.mocs[0]) {
          const kqAnh = await taiAnhLanLuot(mach.mocs[0].id, anhs);
          const loiAnh = cauLoiTaiAnh(kqAnh);
          if (loiAnh !== null) {
            setLoi(`Bài đã đăng, nhưng ${loiAnh}`);
            setDangGui(false);
            return;
          }
        }

        // Dọn form và chuyển hướng tới bài mới
        setTitle("");
        setBody("");
        setAnhs([]);
        setPreviewUrls([]);
        setTatBinhLuan(false);
        setRiengTu(false);
        dongDrawer();
        window.location.assign(duongDanMach(mach.slug, mach.id));
      }
    } catch (e2) {
      const thoiGianCho =
        e2 instanceof LoiGhi && e2.ma === MA_LOI.QUA_HAN_MUC_MOC && e2.thuLaiTu !== null
          ? ` Viết tiếp được từ ${gioPhutVN(e2.thuLaiTu)}.`
          : "";
      setLoi(
        cauLoi(e2, "Không gọi được máy chủ. Kiểm tra kết nối rồi thử lại.") + thoiGianCho,
      );
      setDangGui(false);
    }
  };

  const laNoiMoc = dangMachHienTai !== null;
  const duDieuKien = laNoiMoc
    ? moc.body.trim() !== "" && moc.body.length <= DAI_BODY_MOC
    : subDangChon !== "" && title.trim() !== "" && body.trim() !== "";

  return (
    <DrawerCtx.Provider
      value={{
        moDrawer,
        moDrawerNoiMoc,
        dongDrawer,
        dangMo,
        dangMachHienTai,
        dangKyMachHienTai,
      }}
    >
      {children}

      {/* Backdrop overlay mờ — bấm ra ngoài để ẩn */}
      <div
        className={`${css.overlay} ${dangMo ? css.overlay_hien : ""}`}
        onClick={dongDrawer}
        aria-hidden={!dangMo}
      />

      {/* Panel trượt từ bên phải (kiểu Cloudflare) */}
      <aside
        className={`${css.drawer} ${dangMo ? css.drawer_hien : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={laNoiMoc ? "Nối mốc nhanh" : "Đăng bài nhanh"}
      >
        <div className={css.dau}>
          <div className={css.tieu_de_khu}>
            <h2 className={css.tieu_de}>
              {laNoiMoc
                ? `Nối mốc ${dangMachHienTai.soMoc + 1}`
                : "Đăng bài nhanh"}
            </h2>
            <p className={css.mo_ta}>
              {laNoiMoc
                ? `Vào bài: ${dangMachHienTai.tieuDeMach}${dangMachHienTai.tranMocMoiNgay ? ` (tối đa ${dangMachHienTai.tranMocMoiNgay} mốc/ngày)` : ""}`
                : "Chia sẻ nhanh nhận định hoặc câu hỏi vào cộng đồng"}
            </p>
          </div>
          <button
            type="button"
            className={css.nut_dong}
            onClick={dongDrawer}
            aria-label="Đóng bảng đăng nhanh"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <form
          onSubmit={xuLyGui}
          className={css.than}
          data-testid={laNoiMoc ? "form-noi-moc" : "form-dang-nhanh"}
        >
          {loi && (
            <p className={css.loi} role="alert">
              {loi}
            </p>
          )}

          {laNoiMoc ? (
            <>
              <TruongMoc
                key={`noi-moc-${dangMachHienTai.machId}-${lanMo}`}
                gia_tri={moc}
                datGiaTri={setMoc}
                tienTo="noi-moc"
                nhanThan={`Nội dung mốc ${dangMachHienTai.soMoc + 1}`}
                goiYThan="Chuyện gì vừa xảy ra, và bạn định làm gì tiếp?"
              />
              <ChonAnh
                files={mocAnhs}
                datFiles={setMocAnhs}
                tran={tranAnh}
                tienTo="noi-moc"
                dangGui={dangGui}
                nhan={`Ảnh đính kèm mốc ${dangMachHienTai.soMoc + 1}`}
                moTa={`Ảnh đính kèm riêng cho mốc ${dangMachHienTai.soMoc + 1}.`}
              />
            </>
          ) : (
            <>
              {/* Chọn chuyên mục dạng chip */}
              <div className={css.khoi_sub}>
                <span className={css.nhan}>Chuyên mục</span>
                <div className={css.danh_sach_sub}>
                  {cacSub.map((s) => (
                    <button
                      key={s.slug}
                      type="button"
                      className={`${css.chip_sub} ${
                        subDangChon === s.slug ? css.chip_sub_chon : ""
                      }`}
                      onClick={() => setSubDangChon(s.slug)}
                    >
                      s/{s.slug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tiêu đề bài viết */}
              <div className={css.o}>
                <span className={css.nhan}>Tiêu đề</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={160}
                  placeholder="Tiêu đề ngắn gọn nói rõ điều bạn muốn thảo luận"
                  className={css.input}
                  required
                />
              </div>

              {/* Nội dung bài viết */}
              <div className={css.o}>
                <div className={css.hang_nhan}>
                  <span className={css.nhan}>Nội dung</span>
                  {body.length > 0 && (
                    <span className={css.dem_ky_tu}>
                      {body.length.toLocaleString("vi-VN")}/50.000 ký tự
                    </span>
                  )}
                </div>
                <SoanThao
                  key={`dang-nhanh-${lanMo}`}
                  giaTri={body}
                  datGiaTri={setBody}
                  moi="Chia sẻ nhận định, câu hỏi hoặc góc nhìn của bạn..."
                  testId="dang-nhanh-body"
                />
              </div>

              {/* Chọn ảnh */}
              <div className={css.khoi_anh}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={KIEU_NHAN}
                  multiple
                  onChange={xuLyChonFile}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className={css.nut_chon_anh}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={anhs.length >= tranAnh}
                >
                  <ImagePlus size={16} strokeWidth={2} />
                  <span>
                    Đính kèm ảnh {anhs.length > 0 && `(${anhs.length}/${tranAnh})`}
                  </span>
                </button>

                {previewUrls.length > 0 && (
                  <div className={css.danh_sach_anh}>
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className={css.the_anh_preview}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Ảnh đính kèm ${idx + 1}`}
                          className={css.anh_preview}
                        />
                        <button
                          type="button"
                          className={css.nut_xoa_anh}
                          onClick={() => xoaAnh(idx)}
                          aria-label="Xoá ảnh này"
                        >
                          <X size={13} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={css.khoi_tuy_chon}>
                <label className={css.tuy_chon}>
                  <input
                    type="checkbox"
                    checked={tatBinhLuan}
                    onChange={(e) => setTatBinhLuan(e.target.checked)}
                    data-testid="dang-nhanh-tat-binh-luan"
                  />
                  <span>Tắt bình luận cho bài viết này (có thể mở lại sau)</span>
                </label>

                <label className={css.tuy_chon}>
                  <input
                    type="checkbox"
                    checked={riengTu}
                    onChange={(e) => setRiengTu(e.target.checked)}
                    data-testid="dang-nhanh-rieng-tu"
                  />
                  <span>🔒 Nhật ký riêng tư (Chỉ mình tôi xem, có thể công khai sau)</span>
                </label>
              </div>
            </>
          )}
        </form>

        <div className={css.chan}>
          {laNoiMoc ? (
            <button
              type="button"
              className={css.link_chi_tiet}
              onClick={dongDrawer}
              data-testid="noi-moc-huy"
            >
              Huỷ
            </button>
          ) : (
            <button
              type="button"
              className={css.link_chi_tiet}
              onClick={chuyenSangDangChiTiet}
              data-testid="link-dang-chi-tiet"
            >
              Bạn muốn đăng chi tiết?
            </button>
          )}
          <button
            type="button"
            className={css.nut_gui}
            onClick={(e) => {
              const form = (e.currentTarget.parentElement?.previousElementSibling as HTMLFormElement);
              form?.requestSubmit();
            }}
            disabled={dangGui || !duDieuKien}
            data-testid={laNoiMoc ? "noi-moc-gui" : "dang-nhanh-gui"}
          >
            {dangGui ? "Đang gửi…" : laNoiMoc ? "Nối mốc" : "Đăng bài"}
          </button>
        </div>
      </aside>
    </DrawerCtx.Provider>
  );
}
