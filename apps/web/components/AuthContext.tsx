"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { clearAuthSession, getAuthToken, getStoredUser, setStoredUser } from "../lib/auth-storage";

interface UserData {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string | null;
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

  useEffect(() => {
    const jwt = getAuthToken();
    const storedUser = getStoredUser<UserData>();

    if (storedUser && jwt) {
      setCurrentUser(storedUser);
    }
    setHydrated(true);

    if (!jwt) return;

    api.get("/api/users/me", { headers: { Authorization: `Bearer ${jwt}` } })
      .then((res) => {
        const me = res.data as UserData;
        setCurrentUser(me);
        setStoredUser(me);
        checkModeratorStatus();
      })
      .catch(() => {
        clearAuthSession();
        setCurrentUser(null);
        setIsModerator(false);
      });
  }, []);

  const handleLoginSuccess = (user: UserData) => {
    setCurrentUser(user);
    checkModeratorStatus();
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setIsModerator(false);
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
