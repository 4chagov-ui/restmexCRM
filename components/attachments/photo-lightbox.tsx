"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttachmentWithUrl } from "@/lib/db/attachments";

type PhotoLightboxProps = {
  photos: AttachmentWithUrl[];
  startIndex: number;
  open: boolean;
  onClose: () => void;
};

export function PhotoLightbox({
  photos,
  startIndex,
  open,
  onClose,
}: PhotoLightboxProps) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (open) {
      setIndex(startIndex);
    }
  }, [open, startIndex]);

  const goPrev = useCallback(() => {
    setIndex((current) => (current - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const goNext = useCallback(() => {
    setIndex((current) => (current + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        goPrev();
      } else if (event.key === "ArrowRight") {
        goNext();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, goPrev, goNext]);

  if (!open || photos.length === 0) {
    return null;
  }

  const current = photos[index];
  const src = current?.signed_url;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-3"
      role="dialog"
    >
      <button
        aria-label="Закрыть"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />

      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between gap-3 text-white">
          <p className="text-sm font-medium">
            {index + 1} / {photos.length}
          </p>
          <button
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-semibold"
            onClick={onClose}
            type="button"
          >
            Закрыть
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black/40">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={current.file_name ?? "Фотография"}
              className="max-h-[75dvh] max-w-full object-contain"
              src={src}
            />
          ) : (
            <p className="p-6 text-sm text-white/80">Не удалось загрузить фото</p>
          )}
        </div>

        {photos.length > 1 ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-white"
              onClick={goPrev}
              type="button"
            >
              ← Назад
            </button>
            <button
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-white"
              onClick={goNext}
              type="button"
            >
              Вперёд →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
