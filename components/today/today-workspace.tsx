"use client";

import { useEffect, useState, useTransition } from "react";
import {
  moveTodayRequestAction,
  reorderTodayQueueAction,
  saveTodayPlanAction,
  saveTodayStatusAction,
} from "@/app/today/actions";
import { TodayBoard } from "@/components/today/today-board";
import { TodaySummary } from "@/components/today/today-summary";
import type { RequestStatus } from "@/lib/db/requests";
import type { TodayPlan, TodayRequestItem } from "@/lib/db/today";
import {
  UNPLANNED_COLUMN_ID,
  applyMoveOnBoard,
  applyPlanToBoard,
  applyStatusToBoard,
  createBoardState,
  findColumnIdForRequest,
  findRequestInBoard,
  getColumnOrderedIds,
  type BoardMovePayload,
  type PlanPayload,
  type TodayBoardState,
} from "@/lib/today/board-state";

type DraftPlanning = {
  requestId: string;
  boardBefore: TodayBoardState;
};

type TodayWorkspaceProps = {
  plan: TodayPlan;
  hasEmployees: boolean;
};

export function TodayWorkspace({ hasEmployees, plan }: TodayWorkspaceProps) {
  const [board, setBoard] = useState<TodayBoardState>(() =>
    createBoardState(plan),
  );
  const [draft, setDraft] = useState<DraftPlanning | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedRequestIds, setLockedRequestIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setBoard(createBoardState(plan));
    setDraft(null);
  }, [plan]);

  function lockRequest(requestId: string) {
    setLockedRequestIds((prev) => {
      if (prev.has(requestId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(requestId);
      return next;
    });
  }

  function unlockRequest(requestId: string) {
    setLockedRequestIds((prev) => {
      if (!prev.has(requestId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(requestId);
      return next;
    });
  }

  function isRequestLocked(requestId: string) {
    return lockedRequestIds.has(requestId);
  }

  function findRequest(requestId: string): TodayRequestItem | null {
    return findRequestInBoard(board, requestId);
  }

  function clearDraft() {
    setDraft(null);
  }

  function handleCancelDraft(requestId: string) {
    if (!draft || draft.requestId !== requestId) {
      return;
    }

    setBoard(draft.boardBefore);
    setDraft(null);
    setNotice(null);
    setErrorMessage(null);
  }

  function handlePlan(payload: PlanPayload) {
    const current = findRequest(payload.requestId);

    if (!current) {
      return;
    }

    if (isRequestLocked(payload.requestId)) {
      setErrorMessage("Дождитесь сохранения этой заявки.");
      return;
    }

    const isConfirmingDraft = draft?.requestId === payload.requestId;
    const baseBoard = isConfirmingDraft && draft ? draft.boardBefore : board;
    const sourceRequest =
      isConfirmingDraft && draft
        ? (findRequestInBoard(draft.boardBefore, payload.requestId) ?? current)
        : current;

    const plannedBoard = applyPlanToBoard(
      baseBoard,
      plan.date,
      plan.employees,
      sourceRequest,
      payload,
    );
    const placed = findRequestInBoard(plannedBoard, payload.requestId);
    const columnOrderedIds = getColumnOrderedIds(
      plannedBoard,
      payload.assignedTo,
    );

    setBoard(plannedBoard);
    if (isConfirmingDraft) {
      clearDraft();
    }
    setErrorMessage(null);
    setNotice("Заявка назначена.");
    lockRequest(payload.requestId);

    startTransition(async () => {
      try {
        const result = await saveTodayPlanAction({
          requestId: payload.requestId,
          plannedDate: payload.plannedDate,
          startTime: payload.startTime,
          endTime: payload.endTime,
          assignedTo: payload.assignedTo,
          queuePosition: placed?.queue_position ?? payload.queuePosition,
          columnOrderedIds,
        });

        if (!result.ok) {
          setBoard(baseBoard);
          if (isConfirmingDraft) {
            const restored = applyMoveOnBoard(
              baseBoard,
              plan.date,
              plan.employees,
              {
                requestId: payload.requestId,
                fromColumnId: UNPLANNED_COLUMN_ID,
                toColumnId: payload.assignedTo,
                toIndex: Math.max(payload.queuePosition - 1, 0),
              },
            );
            setBoard(restored);
            setDraft({ requestId: payload.requestId, boardBefore: baseBoard });
          }
          setNotice(null);
          setErrorMessage(result.error);
        }
      } finally {
        unlockRequest(payload.requestId);
      }
    });
  }

  function handleStatus(requestId: string, status: RequestStatus) {
    if (draft) {
      setErrorMessage("Сначала назначьте или отмените черновик планирования.");
      return;
    }

    if (isRequestLocked(requestId)) {
      setErrorMessage("Дождитесь сохранения этой заявки.");
      return;
    }

    const snapshot = board;
    const next = applyStatusToBoard(board, requestId, status, plan.date);
    setBoard(next);
    setErrorMessage(null);
    lockRequest(requestId);

    const columnId = findColumnIdForRequest(next, requestId);

    startTransition(async () => {
      try {
        const result = await saveTodayStatusAction({ requestId, status });

        if (!result.ok) {
          setBoard(snapshot);
          setErrorMessage(result.error);
          return;
        }

        if (columnId && columnId !== UNPLANNED_COLUMN_ID) {
          const orderedIds = getColumnOrderedIds(next, columnId);
          if (orderedIds.length > 0) {
            // Renumber after status change — no user drag, skip queue history.
            const renumber = await reorderTodayQueueAction({ orderedIds });
            if (!renumber.ok) {
              setErrorMessage(renumber.error);
            }
          }
        }
      } finally {
        unlockRequest(requestId);
      }
    });
  }

  function handleMove(payload: BoardMovePayload) {
    const fromUnplannedToMechanic =
      payload.fromColumnId === UNPLANNED_COLUMN_ID &&
      payload.toColumnId !== UNPLANNED_COLUMN_ID;

    if (isRequestLocked(payload.requestId)) {
      setErrorMessage("Дождитесь сохранения этой заявки.");
      return;
    }

    // Block other moves while a draft is open (except cancelling the draft card).
    if (draft && payload.requestId !== draft.requestId) {
      setErrorMessage("Сначала назначьте или отмените черновик планирования.");
      return;
    }

    // Draft card dragged back to unplanned → cancel without DB write.
    if (
      draft &&
      payload.requestId === draft.requestId &&
      payload.toColumnId === UNPLANNED_COLUMN_ID
    ) {
      setBoard(draft.boardBefore);
      setDraft(null);
      setNotice(null);
      setErrorMessage(null);
      return;
    }

    // Draft card moved to another mechanic column — local only.
    if (
      draft &&
      payload.requestId === draft.requestId &&
      payload.toColumnId !== UNPLANNED_COLUMN_ID
    ) {
      const next = applyMoveOnBoard(
        board,
        plan.date,
        plan.employees,
        payload,
      );
      setBoard(next);
      return;
    }

    if (fromUnplannedToMechanic) {
      const base = draft ? draft.boardBefore : board;
      const next = applyMoveOnBoard(
        base,
        plan.date,
        plan.employees,
        payload,
      );
      setBoard(next);
      setDraft({ requestId: payload.requestId, boardBefore: base });
      setErrorMessage(null);
      setNotice("Укажите время и нажмите «Назначить».");
      return;
    }

    const snapshot = board;
    const next = applyMoveOnBoard(
      board,
      plan.date,
      plan.employees,
      payload,
    );

    setBoard(next);
    setErrorMessage(null);

    if (payload.fromColumnId === payload.toColumnId) {
      if (payload.toColumnId === UNPLANNED_COLUMN_ID) {
        return;
      }

      const orderedIds = getColumnOrderedIds(next, payload.toColumnId);
      setNotice("Очередь обновлена.");
      lockRequest(payload.requestId);

      startTransition(async () => {
        try {
          const result = await reorderTodayQueueAction({
            orderedIds,
            movedRequestId: payload.requestId,
          });

          if (!result.ok) {
            setBoard(snapshot);
            setNotice(null);
            setErrorMessage(result.error);
          }
        } finally {
          unlockRequest(payload.requestId);
        }
      });

      return;
    }

    const targetOrderedIds = getColumnOrderedIds(next, payload.toColumnId);
    const sourceOrderedIds =
      payload.fromColumnId === UNPLANNED_COLUMN_ID
        ? []
        : getColumnOrderedIds(next, payload.fromColumnId);

    const assignedTo =
      payload.toColumnId === UNPLANNED_COLUMN_ID ? null : payload.toColumnId;
    const moved = findRequestInBoard(next, payload.requestId);
    const plannedDate =
      assignedTo === null ? null : (moved?.planned_date ?? plan.date);

    setNotice(
      assignedTo === null ? "Заявка возвращена в план." : "Заявка перемещена.",
    );
    lockRequest(payload.requestId);

    startTransition(async () => {
      try {
        const result = await moveTodayRequestAction({
          requestId: payload.requestId,
          assignedTo,
          plannedDate,
          targetOrderedIds,
          sourceOrderedIds,
        });

        if (!result.ok) {
          setBoard(snapshot);
          setNotice(null);
          setErrorMessage(result.error);
        }
      } finally {
        unlockRequest(payload.requestId);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <TodaySummary stats={board.stats} />

      {notice ? (
        <div className="flex h-12 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-900">
          {notice}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex h-12 items-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-800">
          Не удалось сохранить: {errorMessage}
        </div>
      ) : null}

      {!hasEmployees ? (
        <div className="flex min-h-[56px] max-h-16 items-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-950">
              Сотрудники не добавлены. Выполните миграцию сотрудников, чтобы
              назначать заявки.
            </p>
            <p className="mt-0.5 text-xs text-amber-800/80">
              SUPABASE_EMPLOYEES_MIGRATION.sql
            </p>
          </div>
        </div>
      ) : null}

      {isPending ? (
        <p className="text-xs font-medium text-slate-500">Сохраняем…</p>
      ) : null}

      <TodayBoard
        columns={hasEmployees ? board.columns : []}
        draftPlanningRequestId={draft?.requestId ?? null}
        enableDrag={hasEmployees}
        employees={plan.employees}
        lockedRequestIds={lockedRequestIds}
        onCancelDraft={handleCancelDraft}
        onMove={handleMove}
        onPlan={handlePlan}
        onStatus={handleStatus}
        selectedDate={plan.date}
        unplanned={board.unplanned}
      />
    </div>
  );
}
