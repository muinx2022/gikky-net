"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { api, getStrapiURL } from "../lib/api";
import { clearAuthSession, getAuthToken, getStoredUser, setAuthSession, setStoredUser } from "../lib/auth-storage";

interface UserData {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string | null;
  banned?: boolean;
  bannedUntil?: string | null;
}

interface ModeratorCategory {
  category?: { id?: number };
}

interface AuthContextValue {
  currentUser: UserData | null;
  isModerator: boolean;
  hydrated: boolean;
  handleLoginSuccess: (user: UserData) => void;
  handleLogout: () => void;
  updateUser: (partial: Partial<UserData>) => void;
}

const AuthContext = createContext<AuthContextValue>({
  currentUser: null,
  isModerator: false,
  hydrated: false,
  handleLoginSuccess: () => {},
  handleLogout: () => {},
  updateUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { data: nextAuthSession, status: sessionStatus } = useSession();
  const verificationDone = useRef(false);

  const checkModeratorStatus = async () => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;
      const response = await api.get("/api/category-actions/my-moderated", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (response.data?.error) { setIsModerator(false); return; }
      const all = (response.data?.data || []) as ModeratorCategory[];
      setIsModerator(all.filter((m) => Boolean(m.category?.id)).length > 0);
    } catch {
      setIsModerator(false);
    }
  };

  // Step 1: Immediately restore from localStorage (fast, synchronous)
  useEffect(() => {
    const jwt = getAuthToken();
    const storedUser = getStoredUser<UserData>();
    if (storedUser && jwt) {
      setCurrentUser(storedUser);
    }
    setHydrated(true);
  }, []);

  // Step 2: Verify JWT once NextAuth session status is resolved
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (verificationDone.current) return;
    verificationDone.current = true;

    const localJwt = getAuthToken();
    const sessionJwt = (nextAuthSession as any)?.strapiJwt;
    const sessionUser = (nextAuthSession as any)?.strapiUser;

    // If NextAuth has a Strapi JWT but localStorage doesn't, sync it
    if (sessionJwt && !localJwt) {
      setAuthSession(sessionJwt, sessionUser || {});
    }

    const jwt = localJwt || sessionJwt;
    if (!jwt) return;

    api.get("/api/profile/me", { headers: { Authorization: `Bearer ${jwt}` } })
      .then((res) => {
        const raw = res.data as any;
        const avatarRaw = raw.avatar?.formats?.thumbnail?.url || raw.avatar?.url || null;
        const avatarUrl = avatarRaw
          ? avatarRaw.startsWith("http") ? avatarRaw : getStrapiURL(avatarRaw)
          : null;
        const me: UserData = { id: raw.id, username: raw.username, email: raw.email, avatarUrl, banned: raw.banned ?? false, bannedUntil: raw.bannedUntil ?? null };
        setCurrentUser(me);
        setStoredUser(me);
        checkModeratorStatus();
      })
      .catch((error: any) => {
        const httpStatus = Number(error?.response?.status);
        if (httpStatus === 401 || httpStatus === 403) {
          // Only destroy the session if there is no active Google OAuth session.
          // When NextAuth shows "authenticated", the user logged in via Google and their
          // NextAuth cookie is still valid. The 401 from Strapi can happen in production
          // due to config differences (CORS, internal vs external URL, etc.) and should
          // not forcibly log the user out. They will be prompted when they take an action.
          if (sessionStatus !== "authenticated") {
            clearAuthSession();
            setCurrentUser(null);
            setIsModerator(false);
          }
        }
      });
  }, [sessionStatus, nextAuthSession]);

  const handleLoginSuccess = (user: UserData) => {
    setCurrentUser(user);
    checkModeratorStatus();
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setIsModerator(false);
    // Also clear the NextAuth session cookie so F5 doesn't re-authenticate via Google
    signOut({ redirect: false }).catch(() => {});
  };

  const updateUser = (partial: Partial<UserData>) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      setStoredUser(updated);
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ currentUser, isModerator, hydrated, handleLoginSuccess, handleLogout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
