import { getCookie } from "cookies-next";
import { strapiApi } from "./strapi";

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
  kind: "image" | "video" | "file";
}

export const uploadMedia = async (
  file: File,
  options?: { folder?: string; token?: string }
): Promise<UploadedMedia> => {
  const token = options?.token || String(getCookie("token") || "");
  if (!token) {
    throw new Error("Please sign in to upload files.");
  }

  const formData = new FormData();
  formData.append("file", file);
  if (options?.folder) {
    formData.append("folder", options.folder);
  }

  const response = await strapiApi.post("/api/media-upload", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data?.data as UploadedMedia;
};
