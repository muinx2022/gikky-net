const WEB_JWT_KEY = "forgefeed_web_jwt";
const WEB_USER_KEY = "forgefeed_web_user";
const LEGACY_JWT_KEY = "jwt";
const LEGACY_USER_KEY = "user";

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(WEB_JWT_KEY);
};

export const getStoredUser = <T = any>(): T | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(WEB_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const setAuthSession = (jwt: string, user: unknown) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(WEB_JWT_KEY, jwt);
  localStorage.setItem(WEB_USER_KEY, JSON.stringify(user));
};

export const setStoredUser = (user: unknown) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(WEB_USER_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WEB_JWT_KEY);
  localStorage.removeItem(WEB_USER_KEY);
  // Also clear old shared keys so they cannot rehydrate session again.
  localStorage.removeItem(LEGACY_JWT_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
};
