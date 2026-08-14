"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PrintPortal } from "@/components/print-portal";

/**
 * Wraps a client photo thumbnail (passed as `children`, unchanged) with an
 * admin-only "click to view full size" affordance — for verifying a
 * client's identity against their registered photo. Staff still see
 * exactly the same thumbnail as before; only admins get the click handler
 * and the full-size viewer, so the enlarge capability itself is
 * admin-exclusive, not just a UI convenience.
 */
export function ClientPhotoViewer({
  photoUrl,
  alt,
  isAdmin,
  children,
}: {
  photoUrl: string | null;
  alt: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!isAdmin || !photoUrl) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="cursor-zoom-in rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#0062E1]"
        aria-label={`View full-size photo of ${alt}`}
        title="View full-size photo"
      >
        {children}
      </button>

      {open && (
        <PrintPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/85 p-4 animate-fade-in"
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
            />
            <p
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-[12.5px] text-white/90"
            >
              {alt}
            </p>
          </div>
        </PrintPortal>
      )}
    </>
  );
}
