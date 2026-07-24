"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { scrollStorageKey } from "@/lib/navigation/return-to";

/**
 * Restores window.scrollY after returning from a request edit page.
 * Does not touch inner column scrollers (e.g. today DnD boards).
 */
export function RestoreScroll() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const current = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    const key = scrollStorageKey(current);

    try {
      const raw = sessionStorage.getItem(key);
      if (raw == null) {
        return;
      }
      sessionStorage.removeItem(key);
      const y = Number(raw);
      if (!Number.isFinite(y)) {
        return;
      }
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    } catch {
      // ignore
    }
  }, [pathname, searchParams]);

  return null;
}
