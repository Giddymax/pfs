"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIos] = useState(() => {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  });
  const [isStandalone] = useState(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches
      || ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone);
  });

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    setDismissed(true);
  }

  function handleDismiss() {
    setDismissed(true);
    setDeferredPrompt(null);
  }

  if (isStandalone || dismissed) return null;

  if (isIos) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 flex items-start gap-3 rounded-xl border border-[#0033AA]/15 bg-white px-4 py-3.5 shadow-lg sm:left-auto sm:max-w-sm">
        <Download size={20} className="mt-0.5 shrink-0 text-[#d42020]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#0A2240]">Install PFS</p>
          <p className="mt-0.5 text-[12px] text-[#0A2240]/55">
            Tap the share button <span className="inline-block text-[14px] leading-none">⎙</span> then &quot;Add to Home Screen&quot;.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-[#0A2240]/30 hover:text-[#0A2240]"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-[#0033AA]/15 bg-white px-4 py-3 shadow-lg sm:left-auto sm:max-w-sm">
      <Download size={20} className="shrink-0 text-[#d42020]" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#0A2240]">Install PFS</p>
        <p className="mt-0.5 text-[12px] text-[#0A2240]/55">Quick access from your home screen.</p>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="shrink-0 rounded-md bg-[#d42020] px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#b81c1c]"
      >
        Install
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 text-[#0A2240]/30 hover:text-[#0A2240]"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
