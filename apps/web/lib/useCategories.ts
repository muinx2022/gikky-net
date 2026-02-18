"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

export interface Category {
  id: number;
  documentId: string;
  name: string;
  description: string;
  slug?: string;
  parent?: { id?: number } | null;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api
      .get("/api/categories", {
        params: {
          sort: ["sortOrder:asc", "name:asc"],
          populate: "parent",
          filters: { parent: { $null: true } },
        },
      })
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => {});
  }, []);

  return categories;
}
