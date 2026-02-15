"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";
import { useParams } from "next/navigation";

export default function OAuthSignInPage() {
  const params = useParams();

  useEffect(() => {
    const provider = params?.provider as string;
    if (provider) {
      signIn(provider, { callbackUrl: `/connect/${provider}/redirect` });
    }
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Đang chuyển hướng...</p>
      </div>
    </div>
  );
}
