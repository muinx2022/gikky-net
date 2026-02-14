"use client";

import { useEffect } from "react";

const QUERY = "(prefers-color-scheme: dark)";

export default function SystemThemeSync() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia(QUERY);

    const applyTheme = (isDark: boolean) => {
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    };

    applyTheme(media.matches);

    const onChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
