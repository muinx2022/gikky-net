"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText, Heart, LogOut, PlusCircle, Search, Shield, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import NotificationDropdown from "./NotificationDropdown";
import LoginModal from "./LoginModal";
import { useAuth } from "./AuthContext";
import { api } from "../lib/api";

interface Category {
  id: number;
  documentId: string;
  name: string;
  description: string;
  slug?: string;
  parent?: { id?: number } | null;
}

interface Tag {
  id: number;
  documentId: string;
  name: string;
}

interface ForumLayoutProps {
  children: React.ReactNode;
  categories?: Category[];
}

interface FooterPageLink {
  id: number;
  documentId: string;
  title: string;
  slug: string;
}

interface SearchSuggestItem {
  documentId: string;
  title: string;
  slug: string;
  excerpt?: string;
}

const HEADER_HEIGHT = 64;
const SUBNAV_HEIGHT = 44;
const SEARCH_SUGGEST_MIN_CHARS = 3;
const SEARCH_SUGGEST_DEBOUNCE_MS = 420;

export default function ForumLayout({ children, categories = [] }: ForumLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const homeActive = pathname === "/";
  const popularActive = pathname === "/popular";
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [footerPages, setFooterPages] = useState<FooterPageLink[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestItem[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [searchingSuggest, setSearchingSuggest] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const { currentUser, isModerator, hydrated, handleLoginSuccess, handleLogout } = useAuth();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const loadFooterPages = async () => {
      try {
        const response = await api.get("/api/pages", {
          params: {
            sort: "title:asc",
            filters: {
              ftType: {
                $eq: "footer",
              },
            },
            status: "published",
          },
        });
        setFooterPages(response.data?.data || []);
      } catch (error) {
        console.error("Failed to load footer pages:", error);
      }
    };

    loadFooterPages();
  }, []);

  useEffect(() => {
    api.get("/api/tags", { params: { sort: "name:asc", "pagination[limit]": 30 } })
      .then((res) => setTags(res.data?.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(event.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchValue.trim();
    if (!q || q.length < SEARCH_SUGGEST_MIN_CHARS) {
      setSuggestions([]);
      setSearchingSuggest(false);
      return;
    }

    const t = setTimeout(async () => {
      setSearchingSuggest(true);
      try {
        const response = await api.get("/api/search/suggest", {
          params: { q, limit: 8 },
        });
        setSuggestions(response.data?.data || []);
      } catch (error) {
        console.error("Suggest failed:", error);
        setSuggestions([]);
      } finally {
        setSearchingSuggest(false);
      }
    }, SEARCH_SUGGEST_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [searchValue]);

  const runSearch = (q: string) => {
    const next = q.trim();
    if (!next) return;
    setSuggestOpen(false);
    router.push(`/search?q=${encodeURIComponent(next)}`);
  };

  const toCategorySlug = (category: Category) => {
    if (category.slug) return category.slug;
    return category.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  };

  const formatCategoryTitle = (name: string) =>
    name
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <div className="forum-shell min-h-screen">
      <header className="sticky top-0 z-40 h-16 border-b border-slate-700 bg-[#0b1220]">
        <div className="mx-auto flex h-full w-full max-w-[1340px] items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#3b82f6] text-white">
                <span className="text-sm font-black">G</span>
              </div>
              <span className="text-3xl font-black tracking-tight text-white">Gikky</span>
            </Link>

            <div ref={searchWrapRef} className="relative hidden w-[420px] max-w-full md:block">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search posts, topics..."
                value={searchValue}
                onFocus={() => setSuggestOpen(true)}
                onChange={(e) => {
                  setSearchValue(e.currentTarget.value);
                  setSuggestOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch(searchValue);
                  }
                }}
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 pl-9 pr-24 text-sm text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => runSearch(searchValue)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-[#2563eb] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1d4ed8]"
              >
                Search
              </button>
              {suggestOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-slate-700 bg-[#0f172a] shadow-xl">
                  {searchValue.trim() ? (
                    <>
                      <button
                        onClick={() => runSearch(searchValue)}
                        className="block w-full border-b border-slate-700 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                      >
                        Search for "{searchValue.trim()}"
                      </button>
                      {searchValue.trim().length < SEARCH_SUGGEST_MIN_CHARS ? (
                        <div className="px-3 py-2 text-sm text-slate-400">
                          Type at least {SEARCH_SUGGEST_MIN_CHARS} characters for suggestions
                        </div>
                      ) : searchingSuggest ? (
                        <div className="px-3 py-2 text-sm text-slate-400">Searching...</div>
                      ) : suggestions.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-400">No suggestions</div>
                      ) : (
                        suggestions.map((item) => (
                          <button
                            key={item.documentId}
                            onClick={() => router.push(`/p/${item.slug}--${item.documentId}`)}
                            className="block w-full px-3 py-2 text-left hover:bg-slate-800"
                          >
                            <p className="line-clamp-1 text-sm font-medium text-slate-100">{item.title}</p>
                            {item.excerpt ? <p className="line-clamp-1 text-xs text-slate-400">{item.excerpt}</p> : null}
                          </button>
                        ))
                      )}
                    </>
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-400">Type to search...</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hydrated && currentUser ? (
              <>
                <NotificationDropdown />

                <Link
                  href="/create-post"
                  className="hidden items-center gap-1 rounded-md border border-[#22c55e] bg-[#22c55e] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#16a34a] sm:inline-flex"
                >
                  <PlusCircle size={14} />
                  Create
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu((value) => !value)}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-slate-100 transition hover:bg-slate-800"
                  >
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#3b82f6] text-xs font-bold text-white">
                      {currentUser.avatarUrl
                        ? <img src={currentUser.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                        : currentUser.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden md:block">{currentUser.username}</span>
                    <ChevronDown size={14} />
                  </button>

                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                      <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-700 bg-[#0f172a] shadow-xl">
                        <div className="border-b border-slate-700 px-4 py-3">
                          <p className="text-sm font-semibold text-white">{currentUser.username}</p>
                          <p className="text-xs text-slate-300">{currentUser.email}</p>
                        </div>
                        <div className="py-1">
                          <Link href="/profile" className="menu-item" onClick={() => setShowUserMenu(false)}>
                            <User size={15} />
                            Profile
                          </Link>
                          <Link href="/profile/posts" className="menu-item" onClick={() => setShowUserMenu(false)}>
                            <FileText size={15} />
                            My Posts
                          </Link>
                          <Link href="/profile/liked" className="menu-item" onClick={() => setShowUserMenu(false)}>
                            <Heart size={15} />
                            Saved
                          </Link>
                        </div>
                        {isModerator && (
                          <div className="border-t border-slate-700 px-3 py-2">
                            <Link
                              href="/profile/moderator"
                              className="flex items-center gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
                              onClick={() => setShowUserMenu(false)}
                            >
                              <Shield size={15} />
                              Moderator Panel
                            </Link>
                          </div>
                        )}
                        <div className="border-t border-slate-700 py-1">
                          <button
                            onClick={() => {
                              handleLogout();
                              setShowUserMenu(false);
                            }}
                            className="menu-item w-full"
                          >
                            <LogOut size={15} />
                            Log Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : hydrated ? (
              <button
                onClick={() => setShowLoginModal(true)}
                className="rounded-md border border-[#3b82f6] px-4 py-1.5 text-sm font-semibold text-blue-300 transition hover:bg-[#3b82f6] hover:text-white"
              >
                Log In
              </button>
            ) : (
              <div className="h-8 w-24 rounded-full bg-slate-700" />
            )}
          </div>
        </div>
      </header>

      <div className="sticky top-16 z-30 border-b border-slate-700 bg-[#0f172a]/95 backdrop-blur">
        <div className="mx-auto flex h-11 w-full max-w-[1340px] items-center gap-2 px-4 md:px-8">
          <Link
            href="/"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              homeActive ? "bg-blue-500/20 text-blue-200" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            Home
          </Link>
          <Link
            href="/popular"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              popularActive ? "bg-blue-500/20 text-blue-200" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            Popular
          </Link>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-[108px] z-0 h-[220px] bg-[#0f172a]" />

      <main className="relative z-10 mx-auto w-full max-w-[1340px] px-4 pb-10 pt-6 md:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div>{children}</div>

          <aside className="hidden md:block">
            <div
              className="sticky"
              style={{
                height: `calc(100vh - ${HEADER_HEIGHT + SUBNAV_HEIGHT + 16}px)`,
                top: `${HEADER_HEIGHT + SUBNAV_HEIGHT + 8}px`,
              }}
            >
              <section className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_1px_1px_rgba(15,23,42,0.04)]">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {categories.length > 0 && (
                    <>
                      <h3 className="mb-3 text-[18px] font-semibold text-slate-900">Recommended topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {categories.slice(0, 8).map((category) => (
                          <Link
                            key={category.id}
                            href={`/c/${toCategorySlug(category)}`}
                            className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-200"
                          >
                            {formatCategoryTitle(category.name)}
                          </Link>
                        ))}
                      </div>
                    </>
                  )}

                  {tags.length > 0 && (
                    <>
                      <h3 className="mb-3 mt-5 text-[18px] font-semibold text-slate-900">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <Link
                            key={tag.id}
                            href={`/tag/${tag.name}`}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <span className="text-slate-400">#</span>{tag.name}
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-200 pt-3">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {footerPages.map((page) => (
                    <Link
                      key={page.documentId}
                      href={`/page/${page.slug}`}
                      className="text-sm font-medium text-slate-600 transition hover:text-blue-600"
                    >
                      {page.title}
                    </Link>
                  ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">@Trading - {currentYear}</p>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </main>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />

    </div>
  );
}
