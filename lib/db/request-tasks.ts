import { createClient } from "@/lib/supabase/server";

export type RequestTask = {
  id: string;
  request_id: string;
  title: string;
  position: number;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskProgress = {
  done: number;
  total: number;
};

const taskSelect =
  "id, request_id, title, position, is_completed, completed_at, completed_by, created_at, updated_at";

function isMissingTasksTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    message.includes("request_tasks")
  );
}

export async function listRequestTasks(requestId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("request_tasks")
    .select(taskSelect)
    .eq("request_id", requestId)
    .order("position", { ascending: true });

  if (error) {
    if (isMissingTasksTable(error)) {
      return [] as RequestTask[];
    }
    throw error;
  }

  return (data ?? []) as RequestTask[];
}

export async function getTaskProgressMap(requestIds: string[]) {
  const progress = new Map<string, TaskProgress>();
  if (requestIds.length === 0) {
    return progress;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("request_tasks")
    .select("request_id, is_completed")
    .in("request_id", requestIds);

  if (error) {
    if (isMissingTasksTable(error)) {
      return progress;
    }
    throw error;
  }

  for (const row of data ?? []) {
    const requestId = row.request_id as string;
    const current = progress.get(requestId) ?? { done: 0, total: 0 };
    current.total += 1;
    if (row.is_completed) {
      current.done += 1;
    }
    progress.set(requestId, current);
  }

  return progress;
}

export function openTasksMessage(tasks: RequestTask[]) {
  const open = tasks.filter((task) => !task.is_completed).length;
  if (tasks.length === 0 || open === 0) {
    return null;
  }
  return `Нельзя завершить заявку. Осталось выполнить: ${open} из ${tasks.length}.`;
}

export async function assertRequestTasksComplete(requestId: string) {
  const tasks = await listRequestTasks(requestId);
  const message = openTasksMessage(tasks);
  if (message) {
    return { ok: false as const, error: message };
  }
  return { ok: true as const };
}
