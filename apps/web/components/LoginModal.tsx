"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { setAuthSession } from "../lib/auth-storage";

const IS_DEV = process.env.NODE_ENV === "development";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any, jwt: string) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const popupRef = useRef<Window | null>(null);
  const [localEmail, setLocalEmail] = useState("");
  const [localPassword, setLocalPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [localLoading, setLocalLoading] = useState(false);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setLocalLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/local`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: localEmail, password: localPassword }),
      });
      const data = await res.json();
      if (data.jwt && data.user) {
        setAuthSession(data.jwt, data.user);
        onLoginSuccess(data.user, data.jwt);
        onClose();
      } else {
        setLocalError(data.error?.message || "Đăng nhập thất bại");
      }
    } catch {
      setLocalError("Không thể kết nối server");
    } finally {
      setLocalLoading(false);
    }
  };

  const openOAuth = (provider: "google" | "facebook") => {
    const url = `/connect/${provider}/signin`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    popupRef.current = window.open(url, `oauth_${provider}`, `width=${width},height=${height},left=${left},top=${top}`);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "oauth_success") {
        const { jwt, user } = event.data;
        setAuthSession(jwt, user);
        onLoginSuccess(user, jwt);
        onClose();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onLoginSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Sign In</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Đăng nhập để tham gia Gikky</p>
        </div>

        <div className="space-y-3">
          {/* Google */}
          <button
            onClick={() => openOAuth("google")}
            className="w-full flex items-center gap-3 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Continue with Google</span>
          </button>

          {/* Facebook */}
          <button
            onClick={() => openOAuth("facebook")}
            className="w-full flex items-center gap-3 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Continue with Facebook</span>
          </button>
        </div>

        {IS_DEV && (
          <form onSubmit={handleLocalLogin} className="mt-4 space-y-2">
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
              <span className="mx-3 text-xs text-slate-400">dev only</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
            </div>
            <input
              type="email"
              placeholder="Email"
              value={localEmail}
              onChange={(e) => setLocalEmail(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={localPassword}
              onChange={(e) => setLocalPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {localError && <p className="text-xs text-red-500">{localError}</p>}
            <button
              type="submit"
              disabled={localLoading}
              className="w-full py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {localLoading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Khi đăng nhập, bạn đồng ý với{" "}
          <a href="/quy-dinh" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-200">
            quy định của chúng tôi
          </a>
        </p>
      </div>
    </div>
  );
}
