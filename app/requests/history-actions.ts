"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { canUseManagerArea } from "@/lib/auth/permissions";
import {
  getRequestHistory,
  type RequestHistoryRow,
} from "@/lib/db/request-history";
import { getMechanicRequestById } from "@/lib/db/work";

export type LoadHistoryResult =
  | { ok: true; items: RequestHistoryRow[]; hasMore: boolean }
  | { ok: false; error: string };

export async function loadRequestHistoryAction(input: {
  requestId: string;
  offset?: number;
  limit?: number;
}): Promise<LoadHistoryResult> {
  try {
    const context = await getCurrentUser();
    if (!context.authUser || !context.role) {
      return { ok: false, error: "Нужна авторизация." };
    }

    if (!input.requestId) {
      return { ok: false, error: "Не найден ID заявки." };
    }

    // Defense in depth: mechanics may only page history for assigned requests.
    if (!canUseManagerArea(context.role)) {
      if (!context.employee) {
        return { ok: false, error: "Профиль механика не настроен." };
      }
      const membership = await getMechanicRequestById(
        context.employee.id,
        input.requestId,
      );
      if (!membership) {
        return { ok: false, error: "Заявка не найдена или недоступна." };
      }
    }

    const result = await getRequestHistory({
      requestId: input.requestId,
      offset: input.offset ?? 0,
      limit: input.limit ?? 50,
    });

    return { ok: true, items: result.items, hasMore: result.hasMore };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось загрузить историю.",
    };
  }
}
