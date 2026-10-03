"use server";

import { revalidatePath } from "next/cache";
import { requireConfiguredProfile, requireManagerUser } from "@/lib/auth/current-user";
import { canUseManagerArea } from "@/lib/auth/permissions";
import { logRequestHistory } from "@/lib/db/request-history";
import { listRequestTasks } from "@/lib/db/request-tasks";
import { getMechanicRequestById } from "@/lib/db/work";
import { createClient } from "@/lib/supabase/server";

function revalidateTaskPaths(requestId: string) {
  revalidatePath(`/requests/${requestId}`);
  revalidatePath(`/work/requests/${requestId}`);
  revalidatePath("/today");
  revalidatePath("/work/today");
}

function userFacingError(message: string | null | undefined, fallback: string) {
  if (!message) {
    return fallback;
  }
  const lower = message.toLowerCase();
  if (
    lower.includes("permission") ||
    lower.includes("policy") ||
    lower.includes("rls") ||
    lower.includes("not allowed")
  ) {
    return "Недостаточно прав для изменения пункта.";
  }
  if (lower.includes("request_tasks") || lower.includes("schema cache")) {
    return "Таблица пунктов работ недоступна. Проверьте миграцию.";
  }
  return fallback;
}

export async function saveRequestTasksAction(input: {
  requestId: string;
  tasks: Array<{
    id?: string | null;
    title: string;
    isCompleted?: boolean;
  }>;
}) {
  await requireManagerUser();
  const supabase = await createClient();
  const titles = input.tasks
    .map((task) => ({
      ...task,
      title: task.title.trim(),
    }))
    .filter((task) => task.title.length > 0);

  const existing = await listRequestTasks(input.requestId);
  const existingById = new Map(existing.map((task) => [task.id, task]));
  const keptIds = new Set(
    titles.map((task) => task.id).filter((id): id is string => Boolean(id)),
  );

  for (const task of existing) {
    if (!keptIds.has(task.id)) {
      const { error } = await supabase
        .from("request_tasks")
        .delete()
        .eq("id", task.id)
        .eq("request_id", input.requestId);
      if (error) {
        return {
          ok: false as const,
          error: userFacingError(error.message, "Не удалось удалить пункт."),
        };
      }
    }
  }

  for (let index = 0; index < titles.length; index += 1) {
    const task = titles[index];
    const position = index + 1;
    if (!task) {
      continue;
    }
    const previous = task.id ? existingById.get(task.id) : undefined;

    if (previous) {
      const { error } = await supabase
        .from("request_tasks")
        .update({
          title: task.title,
          position,
        })
        .eq("id", previous.id)
        .eq("request_id", input.requestId);
      if (error) {
        return {
          ok: false as const,
          error: userFacingError(error.message, "Не удалось сохранить пункты."),
        };
      }
      continue;
    }

    const { error } = await supabase.from("request_tasks").insert({
      request_id: input.requestId,
      title: task.title,
      position,
      is_completed: false,
    });
    if (error) {
      return {
        ok: false as const,
        error: userFacingError(error.message, "Не удалось добавить пункт."),
      };
    }
  }

  revalidateTaskPaths(input.requestId);
  return { ok: true as const };
}

export async function toggleRequestTaskAction(input: {
  requestId: string;
  taskId: string;
  completed: boolean;
}) {
  const context = await requireConfiguredProfile();

  if (canUseManagerArea(context.role)) {
    // Manager/admin can toggle any accessible request task.
  } else if (context.role === "mechanic" && context.employee) {
    const request = await getMechanicRequestById(
      context.employee.id,
      input.requestId,
    );
    if (!request) {
      return { ok: false as const, error: "Заявка не найдена или недоступна." };
    }
  } else {
    return { ok: false as const, error: "Недостаточно прав." };
  }

  const supabase = await createClient();
  const { data: task, error: loadError } = await supabase
    .from("request_tasks")
    .select("id, title, is_completed")
    .eq("id", input.taskId)
    .eq("request_id", input.requestId)
    .maybeSingle();

  if (loadError) {
    return {
      ok: false as const,
      error: userFacingError(loadError.message, "Не удалось загрузить пункт."),
    };
  }
  if (!task) {
    return { ok: false as const, error: "Пункт не найден." };
  }
  if (task.is_completed === input.completed) {
    return { ok: true as const };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("request_tasks")
    .update(
      input.completed
        ? {
            is_completed: true,
            completed_at: now,
            completed_by: context.profile.id,
          }
        : {
            is_completed: false,
            completed_at: null,
            completed_by: null,
          },
    )
    .eq("id", input.taskId)
    .eq("request_id", input.requestId);

  if (error) {
    return {
      ok: false as const,
      error: userFacingError(error.message, "Не удалось изменить пункт."),
    };
  }

  const actorName =
    context.employee?.name?.trim() ||
    context.profile.full_name?.trim() ||
    "Пользователь";

  await logRequestHistory({
    requestId: input.requestId,
    action: input.completed ? "task_completed" : "task_reopened",
    metadata: {
      taskId: input.taskId,
      taskTitle: task.title as string,
      mechanicName: actorName,
    },
  }).catch(() => undefined);

  revalidateTaskPaths(input.requestId);
  return { ok: true as const };
}
