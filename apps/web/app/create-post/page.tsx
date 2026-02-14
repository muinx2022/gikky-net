"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PostEditorScreen from "../../components/PostEditorScreen";
import { getAuthToken } from "../../lib/auth-storage";

export default function CreatePostPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const jwt = getAuthToken();
    if (!jwt) {
      router.replace("/");
      return;
    }
    setAllowed(true);
  }, [router]);

  if (!allowed) return null;
  return <PostEditorScreen />;
}
