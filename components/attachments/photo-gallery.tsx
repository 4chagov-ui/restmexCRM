"use client";

import { useState } from "react";
import type { AttachmentWithUrl } from "@/lib/db/attachments";
import { PhotoLightbox } from "@/components/attachments/photo-lightbox";

type PhotoGalleryProps = {
  photos: AttachmentWithUrl[];
  onDelete?: (attachmentId: string) => void;
  deletingId?: string | null;
  emptyLabel?: string;
  className?: string;
};

export function PhotoGallery({
  photos,
  onDelete,
  deletingId = null,
  emptyLabel = "Фотографий пока нет",
  className = "",
}: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <p className={`text-sm text-slate-500 ${className}`.trim()}>{emptyLabel}</p>
    );
  }

  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <li
            className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            key={photo.id}
          >
            <button
              className="absolute inset-0"
              onClick={() => setLightboxIndex(index)}
              type="button"
            >
              {photo.signed_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={photo.file_name ?? "Фотография"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  src={photo.signed_url}
                />
              ) : (
                <span className="flex h-full items-center justify-center px-2 text-center text-xs text-slate-500">
                  Нет доступа к файлу
                </span>
              )}
            </button>

            {onDelete ? (
              <button
                className="absolute right-1 top-1 z-10 inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-slate-950/80 px-2 text-xs font-semibold text-white disabled:opacity-50"
                disabled={deletingId === photo.id}
                onClick={() => onDelete(photo.id)}
                type="button"
              >
                {deletingId === photo.id ? "…" : "✕"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <PhotoLightbox
        onClose={() => setLightboxIndex(null)}
        open={lightboxIndex !== null}
        photos={photos}
        startIndex={lightboxIndex ?? 0}
      />
    </div>
  );
}
