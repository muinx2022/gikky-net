import { getAuthToken } from "./auth-storage";
import { getStrapiURL } from "./api";

export interface UploadedMedia {
  id: string | number;
  provider: "local" | "cloudinary";
  name: string;
  url: string;
  mime?: string;
  size?: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  trimmed?: boolean;
  kind: "image" | "video" | "file";
}

export const uploadMedia = async (
  file: File,
  options?: { folder?: string; token?: string }
): Promise<UploadedMedia> => {
  const token = options?.token || getAuthToken();
  if (!token) {
    throw new Error("Please sign in to upload files.");
  }

  const formData = new FormData();
  formData.append("file", file);
  if (options?.folder) {
    formData.append("folder", options.folder);
  }

  const response = await fetch(getStrapiURL("/api/media-upload"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error?.message || "Upload failed.");
  }

  return data?.data as UploadedMedia;
};
