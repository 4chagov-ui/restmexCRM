"use client";

import { useEffect, useId, useState } from "react";
import {
  MAX_PHOTOS_PER_OPERATION,
} from "@/lib/attachments/constants";
import { optimizeImagesForUpload } from "@/lib/attachments/optimize-image";

export type PhotoDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

type PhotoPickerProps = {
  photos: PhotoDraft[];
  onChange: (photos: PhotoDraft[]) => void;
  disabled?: boolean;
  maxCount?: number;
  label?: string;
};

function revokeAll(photos: PhotoDraft[]) {
  for (const photo of photos) {
    URL.revokeObjectURL(photo.previewUrl);
  }
}

export function PhotoPicker({
  photos,
  onChange,
  disabled = false,
  maxCount = MAX_PHOTOS_PER_OPERATION,
  label = "Фотографии",
}: PhotoPickerProps) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      revokeAll(photos);
    };
    // Only revoke on unmount; photos identity changes are handled in onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || disabled || busy) {
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const remaining = maxCount - photos.length;
      if (remaining <= 0) {
        setError(`Можно добавить не больше ${maxCount} фото.`);
        return;
      }

      const incoming = Array.from(fileList).slice(0, remaining);
      const { optimized, errors } = await optimizeImagesForUpload(incoming);

      if (errors.length > 0) {
        setError(errors.join(" "));
      }

      if (optimized.length === 0) {
        return;
      }

      const nextDrafts = optimized.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      onChange([...photos, ...nextDrafts]);
    } finally {
      setBusy(false);
    }
  }

  function removePhoto(id: string) {
    const target = photos.find((photo) => photo.id === id);
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
    }
    onChange(photos.filter((photo) => photo.id !== id));
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-50 ${
            disabled || busy ? "pointer-events-none opacity-50" : ""
          }`}
          htmlFor={inputId}
        >
          {busy ? "Обработка…" : "+ Добавить фото"}
        </label>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled || busy}
          id={inputId}
          multiple
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
          type="file"
        />
      </div>

      <p className="mt-1 text-xs text-slate-500">
        До {maxCount} фото · JPEG / PNG / WebP · большие снимки сжимаются
        автоматически
      </p>

      {error ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {photos.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <li
              className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
              key={photo.id}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="h-full w-full object-cover"
                src={photo.previewUrl}
              />
              <button
                className="absolute right-1 top-1 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-slate-950/80 px-2 text-xs font-semibold text-white"
                onClick={() => removePhoto(photo.id)}
                type="button"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function photosToFormData(photos: PhotoDraft[], formData: FormData) {
  for (const photo of photos) {
    formData.append("photos", photo.file, photo.file.name);
  }
  return formData;
}
