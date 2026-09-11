import Constants from "expo-constants";
import { Platform } from "react-native";

declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};

function getApiBaseUrl(): string {
  if (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Khi kết nối qua Expo Go trên điện thoại thật hoặc máy ảo, lấy IP của máy dev
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as Record<string, any>).manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:8000`;
    }
  }

  return (
    Platform.select({
      android: "http://10.0.2.2:8000",
      default: "http://localhost:8000",
    }) || "http://localhost:8000"
  );
}

export const API_BASE_URL = getApiBaseUrl();
