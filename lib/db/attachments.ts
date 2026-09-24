import { createClient } from "@/lib/supabase/server";
import {
  buildAttachmentStoragePath,
  REQUEST_ATTACHMENTS_BUCKET,
} from "@/lib/attachments/constants";

export type AttachmentRow = {
  id: string;
  request_id: string;
  comment_id: string | null;
  uploaded_by: string | null;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_type: string;
  file_size: number | null;
  created_at: string;
  signed_url?: string | null;
};

export type AttachmentWithUrl = AttachmentRow & {
  signed_url: string | null;
};

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

function isMissingAttachmentsSchema(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    message.includes("attachments") ||
    message.includes("comment_id") ||
    message.includes("file_size")
  );
}

export async function listRequestAttachments(requestId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attachments")
    .select(
      "id, request_id, comment_id, uploaded_by, storage_path, file_name, mime_type, file_type, file_size, created_at",
    )
    .eq("request_id", requestId)
    .eq("file_type", "photo")
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingAttachmentsSchema(error)) {
      return [] as AttachmentRow[];
    }
    throw error;
  }

  return (data ?? []) as AttachmentRow[];
}

export async function listRequestLevelPhotos(requestId: string) {
  const all = await listRequestAttachments(requestId);
  return all.filter((item) => item.comment_id == null);
}

export async function signAttachmentUrls(
  rows: AttachmentRow[],
): Promise<AttachmentWithUrl[]> {
  if (rows.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const signed: AttachmentWithUrl[] = [];

  // Batch by path — Supabase createSignedUrls accepts multiple paths.
  const paths = rows.map((row) => row.storage_path);
  const { data, error } = await supabase.storage
    .from(REQUEST_ATTACHMENTS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return rows.map((row) => ({ ...row, signed_url: null }));
  }

  const urlByPath = new Map<string, string | null>();
  for (const item of data) {
    if (item.path) {
      urlByPath.set(item.path, item.signedUrl ?? null);
    }
  }

  for (const row of rows) {
    signed.push({
      ...row,
      signed_url: urlByPath.get(row.storage_path) ?? null,
    });
  }

  return signed;
}

export type UploadPhotoInput = {
  requestId: string;
  file: File | Blob;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  commentId?: string | null;
};

export type UploadPhotoResult =
  | { ok: true; attachment: AttachmentRow }
  | { ok: false; error: string };

export async function uploadRequestPhoto(
  input: UploadPhotoInput,
): Promise<UploadPhotoResult> {
  const supabase = await createClient();
  const attachmentId = crypto.randomUUID();
  const storagePath = buildAttachmentStoragePath(
    input.requestId,
    attachmentId,
    input.mimeType,
  );

  const bytes = new Uint8Array(await input.file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(REQUEST_ATTACHMENTS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return {
      ok: false,
      error: uploadError.message || "Не удалось загрузить файл в Storage.",
    };
  }

  const insertPayload: Record<string, unknown> = {
    id: attachmentId,
    request_id: input.requestId,
    uploaded_by: input.uploadedBy,
    source: "manual",
    storage_path: storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    file_type: "photo",
    file_size: input.fileSize,
  };

  if (input.commentId) {
    insertPayload.comment_id = input.commentId;
  }

  const { data, error: insertError } = await supabase
    .from("attachments")
    .insert(insertPayload)
    .select(
      "id, request_id, comment_id, uploaded_by, storage_path, file_name, mime_type, file_type, file_size, created_at",
    )
    .single();

  if (insertError) {
    await supabase.storage
      .from(REQUEST_ATTACHMENTS_BUCKET)
      .remove([storagePath]);

    return {
      ok: false,
      error: insertError.message || "Не удалось сохранить метаданные фото.",
    };
  }

  return { ok: true, attachment: data as AttachmentRow };
}

export async function deleteRequestPhoto(attachmentId: string) {
  const supabase = await createClient();

  const { data: row, error: loadError } = await supabase
    .from("attachments")
    .select("id, storage_path, request_id")
    .eq("id", attachmentId)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (!row) {
    return { ok: false as const, error: "Фотография не найдена." };
  }

  const { error: deleteError } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId);

  if (deleteError) {
    return { ok: false as const, error: deleteError.message };
  }

  const { error: storageError } = await supabase.storage
    .from(REQUEST_ATTACHMENTS_BUCKET)
    .remove([row.storage_path as string]);

  // DB row is already gone; surface storage cleanup issues softly.
  if (storageError) {
    return {
      ok: true as const,
      warning: storageError.message,
      requestId: row.request_id as string,
    };
  }

  return { ok: true as const, requestId: row.request_id as string };
}

export function collectPhotoFiles(formData: FormData, key = "photos") {
  const entries = formData.getAll(key);
  const files: File[] = [];

  for (const entry of entries) {
    if (entry instanceof File && entry.size > 0) {
      files.push(entry);
    }
  }

  return files;
}
