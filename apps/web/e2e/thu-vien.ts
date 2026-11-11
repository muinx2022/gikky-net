import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** Dữ liệu TẠM cho section "Bài viết" kiểu thư viện của trang chủ (plan
 * `2026-11-11-homepage-v2-giao-dien-moi.md` §3.3), dùng chung cho `trang-chu-v2.spec.ts` và
 * `trang-chu-giao-dien-moi.spec.ts`.
 *
 * Section chia bài theo SUB của chúng (`lib/nhom-bai-viet.ts`), mà 43 bài viết của `seed_e2e`
 * đều nằm trong sub riêng `e2e-thu-nghiem` — sub ấy không thuộc nhóm nào ⇒ section ẩn hẳn và mọi
 * bài đo "thứ tự ba khối", "đếm link `/m/`" đo RỖNG. Gắn chúng vào sub thật của `seed_dev` thì
 * `seed_dev --reset` ăn `ProtectedError` (vá A3). Nên bài đo TỰ DỰNG vài bài viết MỚI NHẤT trong
 * các sub nhóm và XOÁ SẠCH sau (cùng khuôn nhóm U / O của `trang-chu-v2.spec.ts`): gọi
 * `donThuVien()` rồi `dungThuVien()` ở `beforeAll`, `donThuVien()` ở `afterAll` — dọn cả ở đầu
 * để một lần chạy trước bị ngắt giữa chừng không để lại rác.
 *
 * Phân bố: nhóm 1 = hoi-dap ×2 + chung-khoan ×1; nhóm 2 = vi-mo ×2 + crypto ×1; nhóm 3 =
 * quan-tri-von ×3; dải bản tin = tin-tuc ×3. Bài MỚI NHẤT của hoi-dap có một ảnh gallery thật
 * (đo nhánh `<img>`); các bài còn lại không ảnh (đo ô thay thế). */

const GOC = resolve(__dirname, "..", "..", "..");

export const TIEN_TO_THU_VIEN = "Thư viện e2e —";

export const BAI_THU_VIEN: ReadonlyArray<readonly [string, number]> = [
  ["hoi-dap", 2],
  ["chung-khoan", 1],
  ["vi-mo", 2],
  ["crypto", 1],
  ["quan-tri-von", 3],
  ["tin-tuc", 3],
];

/** Chạy một đoạn Python trong Django shell của `gikky_e2e` (DATABASE_URL kế thừa từ lệnh chạy
 * e2e — KHÔNG đặt ở đây), trả stdout. */
export function py(ma: string): string {
  return execFileSync(process.execPath, [resolve(GOC, "scripts/py.mjs"), "shell", "-c", ma], {
    cwd: GOC,
    stdio: "pipe",
  }).toString();
}

export function donThuVien(): void {
  py(
    [
      "from core.ghi import xoa_anh_moc",
      "from core.models import Mach, MocAnh",
      `loc = Mach.objects.filter(title__startswith=${JSON.stringify(TIEN_TO_THU_VIEN)})`,
      "for a in MocAnh.objects.filter(moc__mach__in=loc): xoa_anh_moc(anh=a)",
      "loc.delete()",
      "",
    ].join("\n"),
  );
}

export function dungThuVien(): void {
  py(
    [
      "from core.anh import xu_ly_anh_tai_len",
      "from core.ghi import tao_mach, them_anh_moc",
      "from core.management.commands.seed_e2e import _png_seed",
      "from core.models import Moc, Sub, User",
      "doi = User.objects.get(username='e2e_tai_khoan_doi')",
      `for slug, so in ${JSON.stringify(BAI_THU_VIEN)}:`,
      "    sub = Sub.objects.get(slug=slug)",
      "    for i in range(so):",
      "        m, _ = tao_mach(sub=sub, author=doi,",
      `            title=${JSON.stringify(TIEN_TO_THU_VIEN + " ")} + slug + ' ' + str(i + 1),`,
      "            body='Nội dung thư viện của bộ e2e, đủ dài để có đoạn trích hai dòng.',",
      "            occurred_at=None, loai=None)",
      "        if slug == 'hoi-dap' and i == so - 1:",
      "            them_anh_moc(moc=Moc.objects.get(mach=m, seq=1), anh=xu_ly_anh_tai_len(_png_seed(800, 600, 3)))",
      "",
    ].join("\n"),
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Nhật ký TẠM cho thẻ nhật ký mới (lệnh · BOT · DEMO · đã đóng sổ · ảnh nhỏ).                  */

/** Ba tác giả tạm, mỗi người MỘT nhật ký MỚI NHẤT (nên chắc chắn nằm trong 8 thẻ đầu của `/`).
 * Vì sao dựng thêm khi `seed_e2e` đã có hai nhật ký mang lệnh: `seed_e2e` dựng MỘT LẦN lúc tạo DB,
 * còn DB e2e sống qua nhiều lần chạy — các bài đo khác đăng thêm nhật ký sau đó có thể đẩy hai
 * bài seed ra khỏi 8 tác giả đầu. Bài đo này cần chúng ở ĐẦU, chắc chắn. (Việc seed CÓ dựng đúng
 * hai nhật ký ấy được ghim ở `api/tests/test_seed_e2e.py` và ở bài `W0` của spec.) */
export const TIEN_TO_NHAT_KY_W = "e2e_w_";
export const NK_BOT = {
  user: `${TIEN_TO_NHAT_KY_W}bot`,
  tieu_de: "W Mua WBOT tại 12.20 — nhật ký lệnh đủ năm số",
  lenh: { ma: "WBOT", gia_vao: "12.20", sl: "11.71", tp: "13.37", nhoi: "12.69", rr: "2.4" },
} as const;
export const NK_DONG = {
  user: `${TIEN_TO_NHAT_KY_W}dong`,
  tieu_de: "W Bán WFX tại 0.8187 — nhật ký chỉ có SL, đã đóng sổ",
  lenh: { ma: "WFX", gia_vao: "0.8187", sl: "0.8223" },
} as const;
export const NK_THUONG = {
  user: `${TIEN_TO_NHAT_KY_W}thuong`,
  tieu_de: "W Nhật ký thường không khai lệnh",
} as const;

export function donNhatKyW(): void {
  py(
    [
      "from core.ghi import xoa_anh_moc",
      "from core.models import Mach, MocAnh, User",
      `loc = Mach.objects.filter(author__username__startswith=${JSON.stringify(TIEN_TO_NHAT_KY_W)})`,
      "for a in MocAnh.objects.filter(moc__mach__in=loc): xoa_anh_moc(anh=a)",
      "loc.delete()",
      `User.objects.filter(username__startswith=${JSON.stringify(TIEN_TO_NHAT_KY_W)}).delete()`,
      "",
    ].join("\n"),
  );
}

export function dungNhatKyW(): void {
  py(
    [
      "from decimal import Decimal",
      "from django.contrib.auth.hashers import make_password",
      "from django.utils import timezone",
      "from core.anh import xu_ly_anh_tai_len",
      "from core.ghi import dong_so, tao_mach, them_anh_moc",
      "from core.lenh import Lenh",
      "from core.management.commands.seed_e2e import _png_seed",
      "from core.models import Mach, Moc, Sub, User",
      "sub = Sub.objects.get(slug='e2e-thu-nghiem')",
      "def nguoi(ten, **them):",
      "    return User.objects.create(username=ten, email=ten + '@vi-du.gikky.net',",
      "        password=make_password('seed-dev-khong-dung-that'), display_name='E2E ' + ten, **them)",
      // Thường TRƯỚC (cũ nhất), bot SAU (mới nhất).
      `u3 = nguoi(${JSON.stringify(NK_THUONG.user)})`,
      "tao_mach(sub=sub, author=u3, loai_mach=Mach.LoaiMach.NHAT_KY,",
      `    title=${JSON.stringify(NK_THUONG.tieu_de)},`,
      "    body='Đoạn nội dung dài để kiểm kẹp ba dòng. ' * 30, occurred_at=None, loai=None)",
      `u2 = nguoi(${JSON.stringify(NK_DONG.user)})`,
      "m2, _ = tao_mach(sub=sub, author=u2, loai_mach=Mach.LoaiMach.NHAT_KY,",
      `    title=${JSON.stringify(NK_DONG.tieu_de)}, body='Đã đóng sổ.', occurred_at=None, loai=None,`,
      `    lenh=Lenh('ban', ${JSON.stringify(NK_DONG.lenh.ma)}, Decimal(${JSON.stringify(NK_DONG.lenh.gia_vao)}), sl=Decimal(${JSON.stringify(NK_DONG.lenh.sl)})))`,
      "dong_so(mach=m2, ket_qua='+1%', bai_hoc='x', khi=timezone.now())",
      `u1 = nguoi(${JSON.stringify(NK_BOT.user)}, la_bot=True)`,
      "m1, _ = tao_mach(sub=sub, author=u1, loai_mach=Mach.LoaiMach.NHAT_KY,",
      `    title=${JSON.stringify(NK_BOT.tieu_de)}, body='Lệnh MUA có ảnh biểu đồ nhỏ.', occurred_at=None, loai=None,`,
      `    lenh=Lenh('mua', ${JSON.stringify(NK_BOT.lenh.ma.toLowerCase())}, Decimal(${JSON.stringify(NK_BOT.lenh.gia_vao)}), sl=Decimal(${JSON.stringify(NK_BOT.lenh.sl)}), tp=Decimal(${JSON.stringify(NK_BOT.lenh.tp)}), nhoi=Decimal(${JSON.stringify(NK_BOT.lenh.nhoi)})))`,
      "them_anh_moc(moc=Moc.objects.get(mach=m1, seq=1), anh=xu_ly_anh_tai_len(_png_seed(900, 600, 5)))",
      "",
    ].join("\n"),
  );
}
