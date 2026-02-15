"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { setAuthSession } from "../../../../lib/auth-storage";

export default function OAuthRedirectPage() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.strapiJwt && session?.strapiUser) {
      setAuthSession(session.strapiJwt, session.strapiUser);
      if (window.opener) {
        window.opener.postMessage(
          { type: "oauth_success", jwt: session.strapiJwt, user: session.strapiUser },
          window.location.origin
        );
        window.close();
      } else {
        window.location.href = "/";
      }
    } else if (status === "unauthenticated") {
      if (window.opener) {
        window.opener.postMessage(
          { type: "oauth_error", error: "Authentication failed" },
          window.location.origin
        );
        window.close();
      } else {
        window.location.href = "/";
      }
    }
  }, [status, session]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Đang xác thực...</p>
      </div>
    </div>
  );
}
