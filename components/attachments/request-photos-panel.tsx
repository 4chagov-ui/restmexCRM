"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  deleteRequestPhotoAction,
  uploadRequestPhotosAction,
} from "@/app/requests/attachments-actions";
import { PhotoGallery } from "@/components/attachments/photo-gallery";
import {
  PhotoPicker,
  photosToFormData,
  type PhotoDraft,
} from "@/components/attachments/photo-picker";
import type { AttachmentWithUrl } from "@/lib/db/attachments";

type RequestPhotosPanelProps = {
  requestId: string;
  initialPhotos: AttachmentWithUrl[];
  canEdit?: boolean;
  title?: string;
};

export function RequestPhotosPanel({
  requestId,
  initialPhotos,
  canEdit = false,
  title = "Фотографии",
}: RequestPhotosPanelProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [drafts, setDrafts] = useState<PhotoDraft[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  function uploadDrafts() {
    if (drafts.length === 0 || isPending) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      const formData = photosToFormData(drafts, new FormData());
      const result = await uploadRequestPhotosAction(requestId, formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      for (const draft of drafts) {
        URL.revokeObjectURL(draft.previewUrl);
      }
      setDrafts([]);

      if (result.warnings && result.warnings.length > 0) {
        setMessage(
          `Загружено ${result.uploaded}. Часть фото не сохранилась: ${result.warnings.join(" ")}`,
        );
      } else {
        setMessage(
          result.uploaded === 1
            ? "Добавлена 1 фотография."
            : `Добавлено ${result.uploaded} фотографий.`,
        );
      }

      router.refresh();
    });
  }

  function handleDelete(attachmentId: string) {
    if (isPending) {
      return;
    }

    const confirmed = window.confirm("Удалить эту фотографию?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    setDeletingId(attachmentId);

    startTransition(async () => {
      const result = await deleteRequestPhotoAction(attachmentId);
      setDeletingId(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setPhotos((current) => current.filter((photo) => photo.id !== attachmentId));
      setMessage("Фотография удалена.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold tracking-tight text-slate-950 sm:text-lg">
        {title}
      </h2>

      <div className="mt-3">
        <PhotoGallery
          deletingId={deletingId}
          emptyLabel="Фотографий проблемы пока нет"
          onDelete={canEdit ? handleDelete : undefined}
          photos={photos}
        />
      </div>

      {canEdit ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <PhotoPicker onChange={setDrafts} photos={drafts} />
          {drafts.length > 0 ? (
            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
              disabled={isPending}
              onClick={uploadDrafts}
              type="button"
            >
              {isPending ? "Загрузка…" : `Загрузить ${drafts.length} фото`}
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </div>
      ) : null}
    </section>
  );
}
