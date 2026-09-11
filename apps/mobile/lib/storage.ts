import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_TOKEN_KEY = "gikky_session_token";
const CSRF_TOKEN_KEY = "gikky_csrf_token";
const memoryStore = new Map<string, string>();

export async function luuSessionToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    memoryStore.set(SESSION_TOKEN_KEY, token);
    return;
  }
  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch {
    memoryStore.set(SESSION_TOKEN_KEY, token);
  }
}

export async function laySessionToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return memoryStore.get(SESSION_TOKEN_KEY) ?? null;
  }
  try {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    return token ?? memoryStore.get(SESSION_TOKEN_KEY) ?? null;
  } catch {
    return memoryStore.get(SESSION_TOKEN_KEY) ?? null;
  }
}

export async function xoaSessionToken(): Promise<void> {
  memoryStore.delete(SESSION_TOKEN_KEY);
  if (Platform.OS !== "web") {
    try {
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    } catch {
      // Bỏ qua lỗi xoá SecureStore
    }
  }
}

export async function luuCsrfToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    memoryStore.set(CSRF_TOKEN_KEY, token);
    return;
  }
  try {
    await SecureStore.setItemAsync(CSRF_TOKEN_KEY, token);
  } catch {
    memoryStore.set(CSRF_TOKEN_KEY, token);
  }
}

export async function layCsrfToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return memoryStore.get(CSRF_TOKEN_KEY) ?? null;
  }
  try {
    const token = await SecureStore.getItemAsync(CSRF_TOKEN_KEY);
    return token ?? memoryStore.get(CSRF_TOKEN_KEY) ?? null;
  } catch {
    return memoryStore.get(CSRF_TOKEN_KEY) ?? null;
  }
}

export async function xoaCsrfToken(): Promise<void> {
  memoryStore.delete(CSRF_TOKEN_KEY);
  if (Platform.OS !== "web") {
    try {
      await SecureStore.deleteItemAsync(CSRF_TOKEN_KEY);
    } catch {
      // Bỏ qua lỗi xoá SecureStore
    }
  }
}

