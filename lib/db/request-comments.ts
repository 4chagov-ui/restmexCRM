import { createClient } from "@/lib/supabase/server";
import {
  listRequestAttachments,
  signAttachmentUrls,
  type AttachmentWithUrl,
} from "@/lib/db/attachments";

export type RequestCommentRow = {
  id: string;
  request_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
  photos: AttachmentWithUrl[];
};

function isMissingCommentsSchema(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    message.includes("request_comments")
  );
}

export async function listRequestComments(requestId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("request_comments")
    .select("id, request_id, author_id, body, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingCommentsSchema(error)) {
      return [] as RequestCommentRow[];
    }
    throw error;
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return [] as RequestCommentRow[];
  }

  const authorIds = [
    ...new Set(
      rows
        .map((row) => row.author_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const nameById = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);

    for (const profile of profiles ?? []) {
      nameById.set(
        profile.id as string,
        (profile.full_name as string | null)?.trim() || "Пользователь",
      );
    }
  }

  const allPhotos = await listRequestAttachments(requestId);
  const commentPhotos = allPhotos.filter((photo) => photo.comment_id != null);
  const signedPhotos = await signAttachmentUrls(commentPhotos);
  const photosByComment = new Map<string, AttachmentWithUrl[]>();

  for (const photo of signedPhotos) {
    if (!photo.comment_id) continue;
    const list = photosByComment.get(photo.comment_id) ?? [];
    list.push(photo);
    photosByComment.set(photo.comment_id, list);
  }

  return rows.map((row) => ({
    id: row.id as string,
    request_id: row.request_id as string,
    author_id: (row.author_id as string | null) ?? null,
    author_name:
      (row.author_id && nameById.get(row.author_id as string)) ||
      "Пользователь",
    body: (row.body as string | null) ?? "",
    created_at: row.created_at as string,
    photos: photosByComment.get(row.id as string) ?? [],
  })) satisfies RequestCommentRow[];
}

export async function createRequestComment(input: {
  requestId: string;
  authorId: string;
  body: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("request_comments")
    .insert({
      request_id: input.requestId,
      author_id: input.authorId,
      body: input.body,
    })
    .select("id, request_id, author_id, body, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data as {
    id: string;
    request_id: string;
    author_id: string | null;
    body: string;
    created_at: string;
  };
}
