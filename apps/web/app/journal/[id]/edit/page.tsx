"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpenText, Pencil } from "lucide-react";
import { api } from "../../../../lib/api";
import { getAuthToken } from "../../../../lib/auth-storage";
import { useAuth } from "../../../../components/AuthContext";
import ForumLayout from "../../../../components/ForumLayout";
import TradeForm from "../../../../components/TradeForm";

export default function EditTradePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser, hydrated } = useAuth();
  const [trade, setTrade] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    const jwt = getAuthToken();
    if (!jwt) {
      router.replace("/");
      return;
    }

    if (!id) return;

    api
      .get(`/api/journal-trades/${id}`, {
        params: { populate: ["author", "screenshots"] },
        headers: { Authorization: `Bearer ${jwt}` },
      })
      .then((res) => {
        const t = res.data?.data;
        if (!t) {
          setNotAllowed(true);
          return;
        }
        if (currentUser && t.author?.id !== currentUser.id) {
          setNotAllowed(true);
          return;
        }
        setTrade(t);
      })
      .catch(() => setNotAllowed(true))
      .finally(() => setLoading(false));
  }, [id, hydrated, currentUser, router]);

  const handleSubmit = async (data: Record<string, any>) => {
    const jwt = getAuthToken();
    if (!jwt) throw new Error("Chưa đăng nhập");
    await api.put(`/api/journal-trades/${id}`, { data }, { headers: { Authorization: `Bearer ${jwt}` } });
    router.push(`/journal/${id}`);
  };

  if (!hydrated) return null;

  if (loading) {
    return (
      <ForumLayout>
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </ForumLayout>
    );
  }

  if (notAllowed || !trade) {
    return (
      <ForumLayout>
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-500">Không tìm thấy trade hoặc bạn không có quyền chỉnh sửa.</p>
          <Link href="/journal" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Quay lại nhật ký
          </Link>
        </div>
      </ForumLayout>
    );
  }

  return (
    <ForumLayout>
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dbeafe] text-[#3b82f6]">
              <BookOpenText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Chỉnh Sửa Trade</h1>
              <p className="text-xs text-slate-500">{trade.symbol} - cập nhật thông tin vào lệnh và kết quả</p>
            </div>
          </div>
          <Link
            href={`/journal/${id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Quay lại
          </Link>
        </div>

        <div className="border-t border-slate-100" />
        <div className="px-5 py-3 text-sm text-slate-600 inline-flex items-center gap-2">
          <Pencil size={14} className="text-blue-500" />
          Lưu ý: thông tin sau khi sửa sẽ cập nhật ngay trong nhật ký giao dịch.
        </div>

        <div className="border-t border-slate-100" />
        <TradeForm initialData={trade} onSubmit={handleSubmit} submitLabel="Lưu Thay Đổi" embedded />
      </div>
    </ForumLayout>
  );
}
