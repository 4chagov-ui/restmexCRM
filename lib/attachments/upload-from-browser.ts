"use client";

import {
  commitPhotoUploads,
  preparePhotoUploadTickets,
} from "@/app/requests/attachments-actions";
import { REQUEST_ATTACHMENTS_BUCKET } from "@/lib/attachments/constants";
import { createClient } from "@/lib/supabase/client";

export async function uploadPhotosDirect(input: {
  requestId: string;
  files: File[];
  commentId?: string | null;
  scope: "request" | "comment";
}): Promise<{ uploaded: number; failures: string[] }> {
  if (input.files.length === 0) {
    return { uploaded: 0, failures: [] };
  }

  const prepared = await preparePhotoUploadTickets({
    requestId: input.requestId,
    commentId: input.commentId,
    files: input.files.map((file) => ({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    })),
  });

  if (!prepared.ok) {
    return {
      uploaded: 0,
      failures: input.files.map(
        (file) => `«${file.name}»: ${prepared.error}`,
      ),
    };
  }

  const supabase = createClient();
  const uploadedFiles: Array<{
    attachmentId: string;
    path: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }> = [];
  const failures: string[] = [];

  for (let index = 0; index < input.files.length; index += 1) {
    const file = input.files[index];
    const ticket = prepared.tickets[index];
    if (!file || !ticket) {
      continue;
    }

    const { error } = await supabase.storage
      .from(REQUEST_ATTACHMENTS_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, file, {
        contentType: ticket.mimeType,
        upsert: false,
      });

    if (error) {
      failures.push(`«${file.name}»: ${error.message}`);
      continue;
    }

    uploadedFiles.push({
      attachmentId: ticket.attachmentId,
      path: ticket.path,
      fileName: ticket.fileName,
      mimeType: ticket.mimeType,
      fileSize: ticket.fileSize,
    });
  }

  if (uploadedFiles.length === 0) {
    return { uploaded: 0, failures };
  }

  const committed = await commitPhotoUploads({
    requestId: input.requestId,
    commentId: input.commentId,
    scope: input.scope,
    files: uploadedFiles,
  });

  if (!committed.ok) {
    return {
      uploaded: 0,
      failures: [...failures, committed.error],
    };
  }

  return {
    uploaded: committed.uploaded,
    failures: [...failures, ...committed.failures],
  };
}
