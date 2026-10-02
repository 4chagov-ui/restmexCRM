"use client";

import { useState, useTransition } from "react";
import { toggleRequestTaskAction } from "@/app/requests/task-actions";
import type { RequestTask } from "@/lib/db/request-tasks";

type WorkTaskChecklistProps = {
  requestId: string;
  initialTasks: RequestTask[];
};

export function WorkTaskChecklist({
  requestId,
  initialTasks,
}: WorkTaskChecklistProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (tasks.length === 0) {
    return null;
  }

  const done = tasks.filter((task) => task.is_completed).length;

  function toggle(task: RequestTask) {
    if (pendingId) {
      return;
    }
    const nextCompleted = !task.is_completed;
    const previous = tasks;
    setError(null);
    setPendingId(task.id);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, is_completed: nextCompleted } : item,
      ),
    );

    startTransition(async () => {
      const result = await toggleRequestTaskAction({
        requestId,
        taskId: task.id,
        completed: nextCompleted,
      });
      setPendingId(null);
      if (!result.ok) {
        setTasks(previous);
        setError(result.error);
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">Работы</h2>
        <p className="text-sm font-medium text-slate-500">
          Выполнено {done} из {tasks.length}
        </p>
      </div>
      <ul className="mt-3 grid gap-2">
        {tasks.map((task) => (
            <li className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2" key={task.id}>
              <button
                aria-pressed={task.is_completed}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-base disabled:opacity-60"
                disabled={pendingId === task.id}
                onClick={() => toggle(task)}
                type="button"
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${
                    task.is_completed
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {task.is_completed ? "✓" : ""}
                </span>
              </button>
              <span
                className={`min-w-0 flex-1 text-base leading-6 ${
                  task.is_completed ? "text-slate-400 line-through" : "text-slate-950"
                }`}
              >
                {task.title}
              </span>
            </li>
        ))}
      </ul>
      {error ? <p className="mt-3 text-sm text-rose-800">{error}</p> : null}
    </section>
  );
}
