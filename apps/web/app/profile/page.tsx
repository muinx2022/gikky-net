"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Pencil, X } from "lucide-react";
import ForumLayout from "../../components/ForumLayout";
import { useAuth } from "../../components/AuthContext";
import { api, getStrapiURL } from "../../lib/api";
import { getAuthToken, setStoredUser } from "../../lib/auth-storage";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  bio?: string | null;
  avatar?: {
    id: number;
    url: string;
    formats?: { thumbnail?: { url: string } };
  } | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { currentUser, hydrated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!hydrated) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }
    fetchProfile();
  }, [hydrated, currentUser]);

  const fetchProfile = async () => {
    const jwt = getAuthToken();
    if (!jwt) return;
    try {
      const res = await api.get("/api/users/me", {
        params: { populate: "avatar" },
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

  const saveField = async (fields: Partial<{ username: string; bio: string }>) => {
    if (!profile) return;
    const jwt = getAuthToken();
    if (!jwt) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/users/${profile.id}`, fields, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const updated = res.data as UserProfile;
      setProfile((prev) => prev ? { ...prev, ...updated } : prev);
      setStoredUser({ id: updated.id, username: updated.username, email: updated.email });
      showToast("Saved successfully");
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
      // Upload file
      const formData = new FormData();
      formData.append("files", file);
      formData.append("ref", "plugin::users-permissions.user");
      formData.append("refId", String(profile.id));
      formData.append("field", "avatar");

      const uploadRes = await fetch(getStrapiURL("/api/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploaded = await uploadRes.json();
      const newAvatar = uploaded[0];

      setProfile((prev) => prev ? { ...prev, avatar: newAvatar } : prev);
      showToast("Avatar updated");
    } catch {
      showToast("Failed to upload avatar", "error");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getAvatarUrl = () => {
    if (!profile?.avatar) return null;
    const url = profile.avatar.formats?.thumbnail?.url || profile.avatar.url;
    if (url.startsWith("http")) return url;
    return getStrapiURL(url);
  };

  const avatarUrl = getAvatarUrl();
  const isProfileIncomplete = !profile?.bio && !profile?.avatar;

  if (!hydrated || loading) {
    return (
      <ForumLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      </ForumLayout>
    );
  }

  if (!profile) return null;

  return (
    <ForumLayout>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Incomplete profile banner */}
        {isProfileIncomplete && (
          <div className="border-b border-blue-100 bg-blue-50 px-6 py-3 text-sm text-blue-700">
            Complete your profile by adding a bio and avatar.
          </div>
        )}

        <div className="p-6">
          {/* Avatar + basic info */}
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
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
                  <button
                    onClick={() => saveField({ username })}
                    disabled={saving}
                    className="rounded-md bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button
                    onClick={() => { setEditingUsername(false); setUsername(profile.username); }}
                    className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">{profile.username}</h1>
                  <button
                    onClick={() => setEditingUsername(true)}
                    className="rounded p-1 text-slate-400 hover:text-slate-600"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              )}
              <p className="mt-0.5 text-sm text-slate-500">{profile.email}</p>
            </div>
          </div>

          {/* Bio */}
          <div className="mt-6">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Bio</span>
              {!editingBio && (
                <button
                  onClick={() => setEditingBio(true)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
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
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveField({ bio })}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingBio(false); setBio(profile.bio || ""); }}
                    className="rounded-lg bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                  >
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

          {/* Quick links */}
          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-slate-100 pt-6 sm:grid-cols-3">
            {[
              { label: "My Posts", href: "/profile/posts" },
              { label: "Saved", href: "/profile/liked" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </ForumLayout>
  );
}
