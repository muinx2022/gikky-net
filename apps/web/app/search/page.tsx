"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ForumLayout from "../../components/ForumLayout";
import { api } from "../../lib/api";

interface SearchResultItem {
  documentId: string;
  title: string;
  slug: string;
  excerpt?: string;
  contentPlain?: string;
  createdAt?: string;
  author?: string;
}

const PAGE_SIZE = 20;

function SearchContent() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") || "").trim();

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!q) {
        setResults([]);
        setTotal(0);
        return;
      }
      setLoading(true);
      try {
        const response = await api.get("/api/search", {
          params: { q, page, pageSize: PAGE_SIZE },
        });
        if (!active) return;
        setResults(response.data?.data || []);
        setTotal(response.data?.meta?.pagination?.total || 0);
      } catch (error) {
        if (!active) return;
        setResults([]);
        setTotal(0);
        console.error("Search failed:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [q, page]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h1 className="text-2xl font-bold text-slate-900">Tìm kiếm</h1>
      {q ? <p className="text-sm text-slate-500">Kết quả cho: "{q}"</p> : <p className="text-sm text-slate-500">Nhập vào ô tìm kiếm.</p>}

      {loading ? (
        <p className="text-slate-500">Đang tìm...</p>
      ) : results.length === 0 ? (
        <p className="text-slate-500">Không tìm thấy kết quả.</p>
      ) : (
        <div className="divide-y divide-slate-200">
          {results.map((item) => (
            <Link key={item.documentId} href={`/p/${item.slug}--${item.documentId}`} className="block py-4">
              <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.excerpt || item.contentPlain || ""}</p>
              {item.author ? <p className="mt-1 text-xs text-slate-400">bởi {item.author}</p> : null}
            </Link>
          ))}
        </div>
      )}

      {q && pageCount > 1 && (
        <div className="flex items-center gap-2 pt-2">
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Trước
          </button>
          <span className="text-sm text-slate-500">
            {page}/{pageCount}
          </span>
          <button
            className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
          >
            Tiếp
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <ForumLayout>
      <Suspense fallback={<p className="text-slate-500">Đang tải...</p>}>
        <SearchContent />
      </Suspense>
    </ForumLayout>
  );
}
