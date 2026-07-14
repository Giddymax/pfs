"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders children as a direct child of <body> instead of wherever this
// component sits in the page tree. Print output needs the modal to be a
// sibling of the rest of the app (not nested inside the dashboard shell's
// layout) so it can be hidden/shown as a single unit in @media print and so
// its content can flow across multiple pages normally, instead of relying on
// position: fixed/absolute — which Chrome repeats on every printed page and
// which can't paginate content taller than one page.
export function PrintPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
