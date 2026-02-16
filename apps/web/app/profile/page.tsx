"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Check, Eye, Loader2, Pencil, X } from "lucide-react";
import ForumLayout from "../../components/ForumLayout";
import { useAuth } from "../../components/AuthContext";
import { useToast } from "../../components/Toast";
import { api, getStrapiURL } from "../../lib/api";
import { getAuthToken, setStoredUser } from "../../lib/auth-storage";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  bio?: string | null;
  avatar?: { id: number; url: string; formats?: { thumbnail?: { url: string } } } | null;
}

interface PostItem {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  moderationStatus?: "block-comment" | "delete" | null;
  createdAt: string;
  updatedAt: string;
}

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return value; }
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    published: "bg-green-100 text-green-700",
    draft: "bg-slate-100 text-slate-600",
    archived: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${map[status] || "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
};

const modBadge = (mod?: "block-comment" | "delete" | null) => {
  if (!mod) return null;
  const cfg = mod === "delete"
    ? "bg-red-100 text-red-700"
    : "bg-orange-100 text-orange-700";
  return <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${cfg}`}>{mod === "delete" ? "hidden" : "block cmt"}</span>;
};

export default function ProfilePage() {
  const router = useRouter();
  const { currentUser, hydrated, updateUser } = useAuth();
  const { showToast, ToastContainer } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    if (!currentUser) { router.replace("/"); return; }
    fetchProfile();
    fetchPosts();
  }, [hydrated, currentUser]);

  const fetchProfile = async () => {
    const jwt = getAuthToken();
    if (!jwt) return;
    try {
      const res = await api.get("/api/profile/me", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const user = res.data as UserProfile;
      setProfile(user);
      setBio(user.bio || "");
      setUsername(user.username || "");
    } catch {
      showToast("Failed to load profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    const jwt = getAuthToken();
    if (!jwt) { setLoadingPosts(false); return; }
    try {
      const res = await api.get("/api/posts/my", { headers: { Authorization: `Bearer ${jwt}` } });
      setPosts(res.data?.data || []);
    } catch { /* silent */ } finally {
      setLoadingPosts(false);
    }
  };

  const saveField = async (fields: Partial<{ username: string; bio: string }>) => {
    if (!profile) return;
    const jwt = getAuthToken();
    if (!jwt) return;
    setSaving(true);
    try {
      const res = await api.put("/api/profile/me", fields, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const updated = res.data as UserProfile;
      setProfile((prev) => prev ? { ...prev, ...updated } : prev);
      setStoredUser({ id: updated.id, username: updated.username, email: updated.email });
      showToast("Saved successfully", "success");
      setEditingBio(false);
      setEditingUsername(false);
    } catch (err: any) {
      showToast(err?.response?.data?.error?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    const jwt = getAuthToken();
    if (!jwt) return;
    setUploadingAvatar(true);
    try {
      // Step 1: upload file
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch(getStrapiURL("/api/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Upload failed");
      }
      const uploaded = await uploadRes.json();
      const media = uploaded[0];

      // Step 2: link avatar to user via custom profile endpoint
      await api.put("/api/profile/me", { avatar: media.id }, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      // Re-fetch to get populated avatar url
      await fetchProfile();
      // Update header avatar
      const avatarUrl = media.formats?.thumbnail?.url || media.url;
      updateUser({ avatarUrl: avatarUrl.startsWith("http") ? avatarUrl : getStrapiURL(avatarUrl) });
      showToast("Avatar updated", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to upload avatar", "error");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getAvatarUrl = () => {
    if (!profile?.avatar) return null;
    const url = profile.avatar.formats?.thumbnail?.url || profile.avatar.url;
    return url.startsWith("http") ? url : getStrapiURL(url);
  };

  const avatarUrl = getAvatarUrl();
  const isProfileIncomplete = !profile?.bio && !profile?.avatar;

  if (!hydrated || loading) {
    return (
      <ForumLayout>
        <ToastContainer />
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      </ForumLayout>
    );
  }

  if (!profile) return null;

  return (
    <ForumLayout>
      <ToastContainer />

      <div className="space-y-4">
        {/* ── Profile card ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {isProfileIncomplete && (
            <div className="border-b border-blue-100 bg-blue-50 px-6 py-2.5 text-sm text-blue-700">
              Complete your profile by adding a bio and avatar.
            </div>
          )}

          <div className="p-6">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className="h-20 w-20 cursor-pointer overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingAvatar ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-slate-400" />
                    </div>
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl font-bold text-slate-400">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-white transition hover:bg-slate-900"
                >
                  <Camera size={13} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              {/* Username + email */}
              <div className="flex-1 min-w-0">
                {editingUsername ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-base font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveField({ username });
                        if (e.key === "Escape") { setEditingUsername(false); setUsername(profile.username); }
                      }}
                    />
                    <button onClick={() => saveField({ username })} disabled={saving} className="rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-50">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button onClick={() => { setEditingUsername(false); setUsername(profile.username); }} className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">{profile.username}</h1>
                    <button onClick={() => setEditingUsername(true)} className="rounded p-1 text-slate-400 hover:text-slate-600">
                      <Pencil size={13} />
                    </button>
                  </div>
                )}
                <p className="mt-0.5 text-sm text-slate-500">{profile.email}</p>
              </div>
            </div>

            {/* Bio */}
            <div className="mt-5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">Bio</span>
                {!editingBio && (
                  <button onClick={() => setEditingBio(true)} className="rounded p-1 text-slate-400 hover:text-slate-600">
                    <Pencil size={13} />
                  </button>
                )}
              </div>
              {editingBio ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="Tell others a bit about yourself..."
                    className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={() => saveField({ bio })} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Save
                    </button>
                    <button onClick={() => { setEditingBio(false); setBio(profile.bio || ""); }} className="rounded-lg bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">
                      Cancel
                    </button>
                    <span className="ml-auto text-xs text-slate-400">{bio.length}/300</span>
                  </div>
                </div>
              ) : (
                <p
                  className={`text-sm leading-relaxed ${profile.bio ? "text-slate-700" : "cursor-pointer italic text-slate-400 hover:text-slate-500"}`}
                  onClick={() => !profile.bio && setEditingBio(true)}
                >
                  {profile.bio || "No bio yet. Click to add one."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── My Posts ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="font-semibold text-slate-900">My Posts</h2>
            <Link href="/create-post" className="text-sm font-medium text-blue-600 hover:underline">
              + New post
            </Link>
          </div>

          {loadingPosts ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin text-slate-400" />
            </div>
          ) : posts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              No posts yet.{" "}
              <Link href="/create-post" className="text-blue-600 hover:underline">Create your first post</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {posts.map((post) => (
                <div key={post.documentId} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{post.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {statusBadge(post.status)}
                      {modBadge(post.moderationStatus)}
                      <span className="text-xs text-slate-400">{formatDate(post.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/p/${post.slug}--${post.documentId}`} className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition hover:bg-slate-200">
                      <Eye size={14} />
                    </Link>
                    {post.moderationStatus !== "delete" && (
                      <Link href={`/profile/posts/${post.documentId}/edit`} className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition hover:bg-slate-200">
                        <Pencil size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ForumLayout>
  );
}
