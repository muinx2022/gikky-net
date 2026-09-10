"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { FormDangBai } from "../../../components/form-dang-bai";
import { The, TieuDeTrang } from "../../../components/ui";

/** Trang đăng bài độc lập (`/machs/moi`) — dùng chung FormDangBai với ngăn kéo của `/machs`. */
export default function TrangDangBai() {
  const router = useRouter();

  return (
    <>
      <TieuDeTrang
        tieu_de="Đăng bài"
        mo_ta="Soạn một bài mới thay mặt tài khoản đội. Đăng ngay, hoặc hẹn giờ phát hành."
        hanh_dong={
          <Link href="/machs" className="nut">
            ← Danh sách bài
          </Link>
        }
      />
      <The className="p-4">
        <FormDangBai
          dong={() => router.push("/machs")}
          onThanhCong={(machId) => router.push(`/m/${machId}`)}
        />
      </The>
    </>
  );
}
