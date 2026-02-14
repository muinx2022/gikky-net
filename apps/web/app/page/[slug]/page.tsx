"use client";

import { use, useEffect, useState } from "react";
import ForumLayout from "../../../components/ForumLayout";
import { api } from "../../../lib/api";

interface Category {
  id: number;
  documentId: string;
  name: string;
  description: string;
  slug?: string;
  parent?: { id?: number } | null;
}

interface StaticPage {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  ftType: "front" | "footer";
}

export default function StaticPageDetail({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState<StaticPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [categoriesRes, pageRes] = await Promise.all([
          api.get("/api/categories", {
            params: {
              sort: ["sortOrder:asc", "name:asc"],
              populate: "parent",
              filters: { parent: { $null: true } },
            },
          }),
          api.get("/api/pages", {
            params: {
              filters: {
                slug: {
                  $eq: slug,
                },
              },
              pagination: {
                page: 1,
                pageSize: 1,
              },
              status: "published",
            },
          }),
        ]);

        setCategories(categoriesRes.data?.data || []);
        setPage(pageRes.data?.data?.[0] || null);
      } catch (error) {
        console.error("Failed to load static page:", error);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [slug]);

  return (
    <ForumLayout categories={categories}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : !page ? (
          <p className="text-slate-500">Page not found.</p>
        ) : (
          <>
            <h1 className="mb-4 text-2xl font-bold text-slate-900">{page.title}</h1>
            <div
              className="max-w-none text-[15px] leading-7 text-slate-700 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_a]:text-blue-600 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          </>
        )}
      </div>
    </ForumLayout>
  );
}
