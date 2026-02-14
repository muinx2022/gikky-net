"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Send } from "lucide-react";
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
          setError("Please sign in to edit post.");
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
          setError("Post not found.");
          setLoading(false);
          return;
        }

        setPostOwnerId(post.author?.id ?? null);
        setPostModerationStatus(post.moderationStatus ?? null);

        if (post.author?.id && post.author.id !== me.id) {
          setError("You do not have permission to edit this post.");
          setLoading(false);
          return;
        }

        if (post.moderationStatus === "delete") {
          setError("This post was hidden by moderator and cannot be edited.");
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
      setError("Title and content are required.");
      showToast("Title and content are required.", "error");
      return;
    }

    const jwt = getAuthToken();
    if (!jwt) {
      setError(`Please sign in to ${isEditMode ? "edit" : "create"} post.`);
      showToast(`Please sign in to ${isEditMode ? "edit" : "create"} post.`, "error");
      return;
    }

    if (isEditMode) {
      if (postModerationStatus === "delete") {
        const message = "This post was hidden by moderator and cannot be edited.";
        setError(message);
        showToast(message, "error");
        return;
      }

      if (postOwnerId && currentUserId && postOwnerId !== currentUserId) {
        const message = "You do not have permission to edit this post.";
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
            status === "draft" ? "Draft saved successfully" : "Post created successfully"
          );
          router.push(`/profile/posts/${post.documentId}/edit`);
          return;
        }
        showToast(status === "draft" ? "Draft saved successfully" : "Post created successfully", "success");
        router.push("/profile/posts");
        return;
      }

      await runMutationWithRelationFallback("update");

      showToast(status === "draft" ? "Draft saved successfully" : "Post updated successfully", "success");
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEditMode ? "Edit Post" : "Create Post"}</h1>
            {isEditMode ? (
              <button
                type="button"
                onClick={() => router.push("/profile/posts")}
                className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <ArrowLeft size={14} />
                Back to My Posts
              </button>
            ) : null}
          </div>

          {loading ? <p className="text-slate-600 dark:text-slate-400">Loading...</p> : null}

          {!loading ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitPost("published");
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Post title"
                  className="w-full px-4 py-2 border border-slate-400 rounded-sm bg-white text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="relative">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Categories (multi-level)</label>
                <button
                  type="button"
                  onClick={() => setCategoryPickerOpen((prev) => !prev)}
                  className="flex min-h-10 w-full flex-wrap items-center gap-2 rounded-sm border border-slate-400 bg-white px-3 py-2 text-left text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  {selectedCategoryIds.length === 0 ? (
                    <span className="text-slate-500 dark:text-slate-400">Select categories</span>
                  ) : (
                    categoryOptions
                      .filter((option) => selectedCategoryIds.includes(option.value))
                      .map((option) => (
                        <span
                          key={option.value}
                          className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {option.label}
                        </span>
                      ))
                  )}
                </button>

                {categoryPickerOpen ? (
                  <div className="absolute z-20 mt-1 w-full rounded-sm border border-slate-300 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <input
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Search categories"
                      className="mb-2 w-full rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <div className="max-h-56 overflow-auto">
                      {filteredCategoryOptions.length === 0 ? (
                        <p className="px-2 py-1 text-sm text-slate-500 dark:text-slate-400">No categories found.</p>
                      ) : (
                        filteredCategoryOptions.map((option) => {
                          const isSelected = selectedCategoryIds.includes(option.value);
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
                              }}
                              className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                                isSelected
                                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Content</label>
                <TiptapEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Write your post..."
                  className="bg-white dark:bg-slate-900"
                  uploadMode="deferred"
                  onPendingUploadsChange={setPendingUploads}
                />
              </div>

              <div className="relative">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Tags</label>
                <button
                  type="button"
                  onClick={() => setTagPickerOpen((prev) => !prev)}
                  className="flex min-h-10 w-full flex-wrap items-center gap-2 rounded-sm border border-slate-400 bg-white px-3 py-2 text-left text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  {selectedTagIds.length === 0 ? (
                    <span className="text-slate-500 dark:text-slate-400">Select tags</span>
                  ) : (
                    tags
                      .filter((tag) => selectedTagIds.includes(String(tag.id)))
                      .map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          #{tag.name}
                        </span>
                      ))
                  )}
                </button>

                {tagPickerOpen ? (
                  <div className="absolute z-20 mt-1 w-full rounded-sm border border-slate-300 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <input
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      placeholder="Search tags"
                      className="mb-2 w-full rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <div className="max-h-56 overflow-auto">
                      {filteredTags.length === 0 ? (
                        <p className="px-2 py-1 text-sm text-slate-500 dark:text-slate-400">No tags found.</p>
                      ) : (
                        filteredTags.map((tag) => {
                          const isSelected = selectedTagIds.includes(String(tag.id));
                          return (
                            <button
                              type="button"
                              key={tag.id}
                              onClick={() => {
                                setSelectedTagIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== String(tag.id))
                                    : [...prev, String(tag.id)]
                                );
                                setTagPickerOpen(false);
                              }}
                              className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                                isSelected
                                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                              }`}
                            >
                              #{tag.name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}
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
                  {submitting && submitMode === "draft" ? "Saving..." : "Save Draft"}
                </button>
                <button
                  type="submit"
                  disabled={submitting || (isEditMode && postModerationStatus === "delete")}
                  className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <Send size={14} />
                  {submitting && submitMode === "published"
                    ? isEditMode
                      ? "Updating..."
                      : "Creating..."
                    : isEditMode
                      ? "Publish Update"
                      : "Create Post"}
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
