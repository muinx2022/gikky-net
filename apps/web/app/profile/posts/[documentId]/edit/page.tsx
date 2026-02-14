"use client";

import { useParams } from "next/navigation";
import PostEditorScreen from "../../../../../components/PostEditorScreen";

export default function EditPostPage() {
  const params = useParams<{ documentId: string }>();
  const documentId = params?.documentId;

  return <PostEditorScreen documentId={documentId} />;
}
