"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Send, ChevronDown, Check, Hash, X as XIcon } from "lucide-react";
import ForumLayout from "./ForumLayout";
import TiptapEditor from "./TiptapEditor";
import { useToast } from "./Toast";
import { api } from "../lib/api";
import { getAuthToken } from "../lib/auth-storage";
import { uploadMedia } from "../lib/upload";

interface Category {
  id: number;
  documentId: string;
  name: string;
  description: string;
  sortOrder?: number;
  slug?: string;
  parent?: {
    id: number;
    name: string;
  } | null;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface Tag {
  id: number;
  documentId: string;
  name: string;
}

interface PostDetail {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  status: "draft" | "published" | "archived";
  moderationStatus?: "block-comment" | "delete" | null;
  categories?: Array<{ id?: number; documentId?: string }>;
  tags?: Array<{ id?: number; documentId?: string; name?: string }>;
  author?: { id: number };
}

const getPlainText = (html: string) =>
  (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasRenderableContent = (html: string) => {
  const plain = getPlainText(html);
  if (plain) return true;
  const raw = (html || "").toLowerCase();
  return /<(img|video|iframe)\b/.test(raw);
};

const toSlug = (value: string) => {
  const normalized = (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (normalized) return normalized;
  return `post-${Date.now()}`;
};

const getApiErrorMessage = (err: unknown): string => {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message === "string"
  ) {
    return (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message as string;
  }

  if (err instanceof Error) return err.message;
  return "";
};

export default function PostEditorScreen({ documentId }: { documentId?: string }) {
  const router = useRouter();
  const isEditMode = Boolean(documentId);
  const { showToast, ToastContainer } = useToast();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"draft" | "published">("published");
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [pendingUploads, setPendingUploads] = useState<
    Array<{ id: string; file: File; kind: "image" | "video"; blobUrl: string }>
  >([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [postOwnerId, setPostOwnerId] = useState<number | null>(null);
  const [postModerationStatus, setPostModerationStatus] = useState<"block-comment" | "delete" | null>(null);

  const categoryOptions = useMemo(() => {
    const byParent = new Map<number | null, Category[]>();

    categories.forEach((category) => {
      const parentId = category.parent?.id ?? null;
      const siblings = byParent.get(parentId) || [];
      siblings.push(category);
      byParent.set(parentId, siblings);
    });

    const sortCategories = (items: Category[]) =>
      [...items].sort((a, b) => {
        const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

    const options: CategoryOption[] = [];
    const visited = new Set<number>();

    const walk = (parentId: number | null, depth: number) => {
      const children = sortCategories(byParent.get(parentId) || []);
      for (const child of children) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);

        const indent = depth > 0 ? `${"  ".repeat(depth)}-> ` : "";
        options.push({
          value: String(child.id),
          label: `${indent}${child.name}`,
        });

        walk(child.id, depth + 1);
      }
    };

    walk(null, 0);

    for (const category of sortCategories(categories)) {
      if (!visited.has(category.id)) {
        options.push({
          value: String(category.id),
          label: category.name,
        });
      }
    }

    return options;
  }, [categories]);

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [tags, tagSearch]);

  const filteredCategoryOptions = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categoryOptions;
    return categoryOptions.filter((option) => option.label.toLowerCase().includes(q));
  }, [categoryOptions, categorySearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryPickerRef.current && !categoryPickerRef.current.contains(e.target as Node)) {
        setCategoryPickerOpen(false);
        setCategorySearch("");
      }
    };
    if (categoryPickerOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [categoryPickerOpen]);

  useEffect(() => {
    const flash = sessionStorage.getItem("post-editor-toast");
    if (!flash) return;

    sessionStorage.removeItem("post-editor-toast");
    showToast(flash, "success");
  }, [showToast]);

  useEffect(() => {
    const load = async () => {
      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          api.get("/api/categories", {
            params: {
              sort: ["sortOrder:asc", "name:asc"],
              populate: "parent",
            },
          }),
          api.get("/api/tags", {
            params: {
              sort: "name:asc",
            },
          }),
        ]);
        setCategories(categoriesRes.data?.data || []);
        setTags(tagsRes.data?.data || []);

        if (!documentId) {
          setLoading(false);
          return;
        }

        const jwt = getAuthToken();
        if (!jwt) {
          setError("Vui lòng đăng nhập để chỉnh sửa bài viết.");
          setLoading(false);
          return;
        }

        const [meRes, postRes] = await Promise.all([
          api.get("/api/users/me", {
            headers: { Authorization: `Bearer ${jwt}` },
          }),
          (async () => {
            try {
              return await api.get(`/api/posts/${documentId}`, {
                params: { populate: "*", status: "draft" },
                headers: { Authorization: `Bearer ${jwt}` },
              });
            } catch {
              return api.get(`/api/posts/${documentId}`, {
                params: { populate: "*", status: "published" },
                headers: { Authorization: `Bearer ${jwt}` },
              });
            }
          })(),
        ]);

        const me = meRes.data as { id: number };
        const post = postRes.data?.data as PostDetail;
        setCurrentUserId(me?.id ?? null);

        if (!post) {
          setError("Không tìm thấy bài viết.");
          setLoading(false);
          return;
        }

        setPostOwnerId(post.author?.id ?? null);
        setPostModerationStatus(post.moderationStatus ?? null);

        if (post.author?.id && post.author.id !== me.id) {
          setError("Bạn không có quyền chỉnh sửa bài viết này.");
          setLoading(false);
          return;
        }

        if (post.moderationStatus === "delete") {
          setError("Bài viết này đã bị kiểm duyệt viên ẩn và không thể chỉnh sửa.");
          setLoading(false);
          return;
        }

        setTitle(post.title || "");
        setContent(post.content || "");
        const fetchedCategoryIds = (post.categories || [])
          .map((category) => {
            if (category.id) return String(category.id);
            if (category.documentId) {
              const matchedCategory = (categoriesRes.data?.data || []).find(
                (item: Category) => item.documentId === category.documentId
              );
              return matchedCategory?.id ? String(matchedCategory.id) : "";
            }
            return "";
          })
          .filter(Boolean);
        setSelectedCategoryIds(fetchedCategoryIds);

        const fetchedTags = (post.tags || []).map((tag) => {
          if (tag.id) return String(tag.id);
          if (tag.documentId) {
            const matchedTag = (tagsRes.data?.data || []).find(
              (item: Tag) => item.documentId === tag.documentId
            );
            return matchedTag?.id ? String(matchedTag.id) : "";
          }
          return "";
        }).filter(Boolean);
        setSelectedTagIds(fetchedTags);
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || err?.message || "Failed to load.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [documentId]);

  const submitPost = async (status: "draft" | "published") => {
    setError("");

    if (!title.trim() || !hasRenderableContent(content)) {
      setError("Tiêu đề và nội dung là bắt buộc.");
      showToast("Tiêu đề và nội dung là bắt buộc.", "error");
      return;
    }

    const jwt = getAuthToken();
    if (!jwt) {
      setError(`Vui lòng đăng nhập để ${isEditMode ? "chỉnh sửa" : "tạo"} bài viết.`);
      showToast(`Vui lòng đăng nhập để ${isEditMode ? "chỉnh sửa" : "tạo"} bài viết.`, "error");
      return;
    }

    if (isEditMode) {
      if (postModerationStatus === "delete") {
        const message = "Bài viết này đã bị kiểm duyệt viên ẩn và không thể chỉnh sửa.";
        setError(message);
        showToast(message, "error");
        return;
      }

      if (postOwnerId && currentUserId && postOwnerId !== currentUserId) {
        const message = "Bạn không có quyền chỉnh sửa bài viết này.";
        setError(message);
        showToast(message, "error");
        return;
      }
    }

    const selectedCategories = categories.filter((category) =>
      selectedCategoryIds.includes(String(category.id))
    );
    const selectedTags = tags.filter((tag) => selectedTagIds.includes(String(tag.id)));
    const categoriesById = selectedCategories.map((category) => category.id);
    const categoriesByDocumentId = selectedCategories.map((category) => category.documentId).filter(Boolean);
    const tagsById = selectedTags.map((tag) => tag.id);
    const tagsByDocumentId = selectedTags.map((tag) => tag.documentId).filter(Boolean);

    try {
      setSubmitting(true);
      setSubmitMode(status);

      let finalContent = content;
      const usedPending = pendingUploads.filter((item) => finalContent.includes(item.blobUrl));

      for (const item of usedPending) {
        const uploaded = await uploadMedia(item.file, { folder: "forgefeed/editor" });
        finalContent = finalContent.split(item.blobUrl).join(uploaded.url);
      }

      const baseData = {
        title: title.trim(),
        slug: toSlug(title),
        content: finalContent,
        status,
      };

      const runMutationWithRelationFallback = async (mode: "create" | "update") => {
        const createOrUpdate = async (
          requestMode: "create" | "update",
          categoriesValue: number[] | string[],
          tagsValue: number[] | string[]
        ) => {
          if (requestMode === "create") {
            return api.post(
              `/api/posts${status === "published" ? "?status=published" : ""}`,
              { data: { ...baseData, categories: categoriesValue, tags: tagsValue } },
              { headers: { Authorization: `Bearer ${jwt}` } }
            );
          }

          return api.put(
            `/api/posts/${documentId}`,
            { data: { ...baseData, categories: categoriesValue, tags: tagsValue } },
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
        };

        const createOrUpdatePublished = async (
          requestMode: "create" | "update",
          categoriesValue: number[] | string[],
          tagsValue: number[] | string[]
        ) => {
          if (status !== "published") return null;
          if (requestMode === "create") return null;

          return api.put(
            `/api/posts/${documentId}?status=published`,
            { data: { ...baseData, categories: categoriesValue, tags: tagsValue } },
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
        };

        if (mode === "create") {
          try {
            return await createOrUpdate("create", categoriesById, tagsById);
          } catch (err) {
            const errorMessage = getApiErrorMessage(err);
            const shouldRetryWithCategoryDocumentId =
              categoriesByDocumentId.length > 0 &&
              errorMessage.includes("relation(s) of type api::category.category associated with this entity do not exist");
            const shouldRetryWithTagDocumentId =
              tagsByDocumentId.length > 0 &&
              errorMessage.includes("relation(s) of type api::tag.tag associated with this entity do not exist");

            if (!shouldRetryWithCategoryDocumentId && !shouldRetryWithTagDocumentId) throw err;

            return createOrUpdate(
              "create",
              shouldRetryWithCategoryDocumentId ? (categoriesByDocumentId || []) : categoriesById,
              shouldRetryWithTagDocumentId ? tagsByDocumentId : tagsById
            );
          }
        }

        try {
          const response = await createOrUpdate("update", categoriesById, tagsById);
          await createOrUpdatePublished("update", categoriesById, tagsById);
          return response;
        } catch (err) {
          const errorMessage = getApiErrorMessage(err);
          const shouldRetryWithCategoryDocumentId =
            categoriesByDocumentId.length > 0 &&
            errorMessage.includes("relation(s) of type api::category.category associated with this entity do not exist");
          const shouldRetryWithTagDocumentId =
            tagsByDocumentId.length > 0 &&
            errorMessage.includes("relation(s) of type api::tag.tag associated with this entity do not exist");

          if (!shouldRetryWithCategoryDocumentId && !shouldRetryWithTagDocumentId) throw err;

          const categoryRetryValue = shouldRetryWithCategoryDocumentId ? (categoriesByDocumentId || []) : categoriesById;
          const tagRetryValue = shouldRetryWithTagDocumentId ? tagsByDocumentId : tagsById;
          const response = await createOrUpdate("update", categoryRetryValue, tagRetryValue);
          await createOrUpdatePublished("update", categoryRetryValue, tagRetryValue);
          return response;
        }
      };

      if (!isEditMode) {
        const response = await runMutationWithRelationFallback("create");

        const post = response.data?.data;
        if (post?.documentId) {
          sessionStorage.setItem(
            "post-editor-toast",
            status === "draft" ? "Đã lưu nháp thành công" : "Đã tạo bài viết thành công"
          );
          router.push(`/profile/posts/${post.documentId}/edit`);
          return;
        }
        showToast(status === "draft" ? "Đã lưu nháp thành công" : "Đã tạo bài viết thành công", "success");
        router.push("/profile/posts");
        return;
      }

      await runMutationWithRelationFallback("update");

      showToast(status === "draft" ? "Đã lưu nháp thành công" : "Đã cập nhật bài viết thành công", "success");
    } catch (err: unknown) {
      const rawMessage = getApiErrorMessage(err) || `Failed to ${isEditMode ? "update" : "create"} post.`;
      setError(rawMessage || `Failed to ${isEditMode ? "update" : "create"} post.`);
      showToast(rawMessage || `Failed to ${isEditMode ? "update" : "create"} post.`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ForumLayout categories={categories}>
      <div className="pt-5 md:pt-6 max-w-3xl">
        <div className="rounded border border-slate-400 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEditMode ? "Chỉnh sửa bài" : "Tạo bài viết"}</h1>
            {isEditMode ? (
              <button
                type="button"
                onClick={() => router.push("/profile/posts")}
                className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <ArrowLeft size={14} />
                Về bài viết của tôi
              </button>
            ) : null}
          </div>

          {loading ? <p className="text-slate-600 dark:text-slate-400">Đang tải...</p> : null}

          {!loading ? (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submitPost("published");
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tiêu đề</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tiêu đề bài viết"
                  className="w-full px-4 py-2 border border-slate-400 rounded-sm bg-white text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Category picker — Reddit subreddit style */}
              <div className="relative" ref={categoryPickerRef}>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Chuyên mục
                </label>

                {/* Trigger / inline search */}
                <div
                  onClick={() => { if (!categoryPickerOpen) setCategoryPickerOpen(true); }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-full border-2 bg-white px-3 py-2 transition-colors dark:bg-slate-900 ${
                    categoryPickerOpen
                      ? "border-blue-500"
                      : "border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <span className="text-xs text-slate-400">
                      {selectedCategoryIds.length === 0 ? "?" : categoryOptions.find(o => selectedCategoryIds.includes(o.value))?.label.replace(/^[\s›]+/, "").charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {categoryPickerOpen ? (
                    <input
                      autoFocus
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Tìm chuyên mục..."
                      className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
                    />
                  ) : selectedCategoryIds.length === 0 ? (
                    <span className="flex-1 text-sm text-slate-400 dark:text-slate-500">Chọn chuyên mục</span>
                  ) : (
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      {categoryOptions
                        .filter((opt) => selectedCategoryIds.includes(opt.value))
                        .map((opt) => {
                          const letter = opt.label.replace(/^[\s›]+/, "").charAt(0).toUpperCase();
                          return (
                            <span
                              key={opt.value}
                              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 pl-1 pr-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                                {letter}
                              </span>
                              {opt.label.replace(/^[\s›]+/, "")}
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedCategoryIds((prev) => prev.filter((id) => id !== opt.value));
                                }}
                                className="ml-0.5 text-blue-400 hover:text-blue-700 dark:hover:text-blue-200"
                              >
                                <XIcon size={10} />
                              </button>
                            </span>
                          );
                        })}
                    </div>
                  )}

                  <ChevronDown
                    size={16}
                    className={`ml-auto shrink-0 text-slate-400 transition-transform ${categoryPickerOpen ? "rotate-180" : ""}`}
                  />
                </div>

                {categoryPickerOpen && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="max-h-60 overflow-auto py-1">
                      {filteredCategoryOptions.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-slate-400">Không tìm thấy chuyên mục.</p>
                      ) : (
                        filteredCategoryOptions.map((option) => {
                          const isSelected = selectedCategoryIds.includes(option.value);
                          const cleanLabel = option.label.replace(/^[\s›]+/, "");
                          const isChild = option.label.startsWith(" ");
                          const letter = cleanLabel.charAt(0).toUpperCase();
                          return (
                            <button
                              type="button"
                              key={option.value}
                              onClick={() => {
                                setSelectedCategoryIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== option.value)
                                    : [...prev, option.value]
                                );
                                setCategoryPickerOpen(false);
                                setCategorySearch("");
                              }}
                              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                isSelected
                                  ? "bg-blue-50 dark:bg-blue-900/20"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800"
                              } ${isChild ? "pl-8" : ""}`}
                            >
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                                  isSelected ? "bg-blue-500" : "bg-slate-400 dark:bg-slate-600"
                                }`}
                              >
                                {letter}
                              </div>
                              <span
                                className={`flex-1 text-sm font-medium ${
                                  isSelected
                                    ? "text-blue-700 dark:text-blue-300"
                                    : "text-slate-700 dark:text-slate-200"
                                }`}
                              >
                                {cleanLabel}
                              </span>
                              {isSelected && <Check size={15} className="shrink-0 text-blue-500" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nội dung</label>
                <TiptapEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Viết bài của bạn..."
                  className="bg-white dark:bg-slate-900"
                  uploadMode="deferred"
                  onPendingUploadsChange={setPendingUploads}
                />
              </div>

              {/* Tags — Reddit flair chip style */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tags</label>
                  <span className="text-xs text-slate-400">(tùy chọn)</span>
                  {selectedTagIds.length > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      {selectedTagIds.length} đã chọn
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  {/* Search */}
                  <div className="relative mb-3">
                    <Hash size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      placeholder="Tìm tag..."
                      className="w-full rounded-lg bg-slate-50 py-1.5 pl-7 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                  </div>

                  {/* Tag chips */}
                  {filteredTags.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">Không tìm thấy tag.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {filteredTags.map((tag) => {
                        const isSelected = selectedTagIds.includes(String(tag.id));
                        return (
                          <button
                            type="button"
                            key={tag.id}
                            onClick={() =>
                              setSelectedTagIds((prev) =>
                                isSelected
                                  ? prev.filter((id) => id !== String(tag.id))
                                  : [...prev, String(tag.id)]
                              )
                            }
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                              isSelected
                                ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                            }`}
                          >
                            <Hash size={10} />
                            {tag.name}
                            {isSelected && <XIcon size={10} className="ml-0.5 opacity-70" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => submitPost("draft")}
                  disabled={submitting || (isEditMode && postModerationStatus === "delete")}
                  className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <Save size={14} />
                  {submitting && submitMode === "draft" ? "Đang lưu..." : "Lưu nháp"}
                </button>
                <button
                  type="submit"
                  disabled={submitting || (isEditMode && postModerationStatus === "delete")}
                  className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <Send size={14} />
                  {submitting && submitMode === "published"
                    ? isEditMode
                      ? "Đang cập nhật..."
                      : "Đang tạo..."
                    : isEditMode
                      ? "Đăng cập nhật"
                      : "Tạo bài viết"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
      <ToastContainer />
    </ForumLayout>
  );
}
