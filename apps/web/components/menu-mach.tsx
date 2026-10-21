"use client";

import { useRef, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

import { useDongDetailsKhiBamNgoai } from "@/lib/dong-details";
import css from "./menu-mach.module.css";

export function MenuMach({ children }: { children: ReactNode }) {
  const hopRef = useRef<HTMLDetailsElement | null>(null);
  useDongDetailsKhiBamNgoai(hopRef);

  return (
    <details ref={hopRef} className={css.menu} data-testid="menu-mach">
      <summary className={css.nut_tron} aria-label="Menu bài viết" title="Menu bài viết">
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
      </summary>
      <div className={css.hop_menu} role="menu">
        {children}
      </div>
    </details>
  );
}
