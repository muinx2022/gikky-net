"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpenText } from "lucide-react";
import { api } from "../../../lib/api";
import { getAuthToken } from "../../../lib/auth-storage";
import { useCategories } from "../../../lib/useCategories";
import ForumLayout from "../../../components/ForumLayout";
import TradeForm from "../../../components/TradeForm";

export default function NewTradePage() {
  const router = useRouter();
  const categories = useCategories();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const jwt = getAuthToken();
    if (!jwt) {
      router.replace("/");
      return;
    }
    setAllowed(true);
  }, [router]);

  const handleSubmit = async (data: Record<string, any>) => {
    const jwt = getAuthToken();
    if (!jwt) throw new Error("Chưa đăng nhập");

    const res = await api.post(
      "/api/journal-trades",
      { data },
      {
        headers: { Authorization: `Bearer ${jwt}` },
      }
    );

    const documentId = res.data?.data?.documentId;
    router.push(documentId ? `/journal/${documentId}` : "/journal");
  };

  if (!allowed) return null;

  return (
    <ForumLayout categories={categories}>
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dbeafe] text-[#3b82f6]">
              <BookOpenText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Thêm Trade Mới</h1>
              <p className="text-xs text-slate-500">Ghi lại lệnh giao dịch theo kỷ luật hệ thống</p>
            </div>
          </div>
          <Link
            href="/journal"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Quay lại
          </Link>
        </div>

        <div className="border-t border-slate-100" />
        <div className="px-5 py-3 text-sm text-slate-600">
          Điền thông tin entry/exit, cảm xúc và bài học để theo dõi hiệu suất ổn định hơn.
        </div>

        <div className="border-t border-slate-100" />
        <TradeForm onSubmit={handleSubmit} submitLabel="Lưu Trade Mới" embedded />
      </div>
    </ForumLayout>
  );
}
