"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getStrapiURL } from "../../../../lib/api";
import { setAuthSession } from "../../../../lib/auth-storage";

export default function OAuthRedirectPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  useEffect(() => {
    const provider = params?.provider as string;
    const accessToken = searchParams?.get("access_token");

    if (!provider || !accessToken) {
      if (window.opener) {
        window.opener.postMessage({ type: "oauth_error", error: "Missing provider or access_token" }, window.location.origin);
        window.close();
      }
      return;
    }

    const url = getStrapiURL(`/api/auth/${provider}/callback?access_token=${accessToken}`);

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.jwt && data.user) {
          setAuthSession(data.jwt, data.user);
          if (window.opener) {
            window.opener.postMessage({ type: "oauth_success", jwt: data.jwt, user: data.user }, window.location.origin);
            window.close();
          } else {
            window.location.href = "/";
          }
        } else {
          throw new Error(data.error?.message || "OAuth failed");
        }
      })
      .catch((err) => {
        if (window.opener) {
          window.opener.postMessage({ type: "oauth_error", error: err.message }, window.location.origin);
          window.close();
        } else {
          window.location.href = "/";
        }
      });
  }, [params, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Đang xác thực...</p>
      </div>
    </div>
  );
}
