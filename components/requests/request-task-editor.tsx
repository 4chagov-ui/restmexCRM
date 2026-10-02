"use client";

import { useState, useTransition } from "react";
import { saveRequestTasksAction } from "@/app/requests/task-actions";
import type { RequestTask } from "@/lib/db/request-tasks";

type Draft = {
  key: string;
  id?: string;
  title: string;
  isCompleted: boolean;
};

type RequestTaskEditorProps = {
  requestId: string;
  initialTasks: RequestTask[];
};

export function RequestTaskEditor({
  requestId,
  initialTasks,
}: RequestTaskEditorProps) {
  const [tasks, setTasks] = useState<Draft[]>(
    initialTasks.map((task) => ({
      key: task.id,
      id: task.id,
      title: task.title,
      isCompleted: task.is_completed,
    })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateTask(key: string, title: string) {
    setTasks((current) =>
      current.map((task) => (task.key === key ? { ...task, title } : task)),
    );
  }

  function moveTask(index: number, direction: -1 | 1) {
    setTasks((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const copy = [...current];
      const currentTask = copy[index];
      const nextTask = copy[nextIndex];
      if (!currentTask || !nextTask) {
        return current;
      }
      copy[index] = nextTask;
      copy[nextIndex] = currentTask;
      return copy;
    });
  }

  function removeTask(task: Draft) {
    if (
      task.isCompleted &&
      !window.confirm("Удалить уже выполненный пункт?")
    ) {
      return;
    }
    setTasks((current) => current.filter((item) => item.key !== task.key));
  }

  function save() {
    const completedChanged = tasks.some((task) => {
      const original = initialTasks.find((item) => item.id === task.id);
      return original?.is_completed && original.title !== task.title.trim();
    });
    if (
      completedChanged &&
      !window.confirm("Изменить текст уже выполненного пункта?")
    ) {
      return;
    }

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveRequestTasksAction({
        requestId,
        tasks: tasks.map((task) => ({
          id: task.id,
          title: task.title,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Пункты работ сохранены.");
    });
  }

  const done = tasks.filter((task) => task.isCompleted).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950 sm:text-lg">Работы</h2>
        {tasks.length > 0 ? (
          <p className="text-sm font-medium text-slate-500">
            Выполнено {done} из {tasks.length}
          </p>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {tasks.map((task, index) => (
          <div className="flex min-w-0 items-center gap-2" key={task.key}>
            <span className="w-6 shrink-0 text-sm text-slate-400">
              {task.isCompleted ? "☑" : "☐"}
            </span>
            <input
              className="box-border h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
              onChange={(event) => updateTask(task.key, event.target.value)}
              value={task.title}
            />
            <button className="h-11 w-11 rounded-xl border border-slate-200" onClick={() => moveTask(index, -1)} type="button">↑</button>
            <button className="h-11 w-11 rounded-xl border border-slate-200" onClick={() => moveTask(index, 1)} type="button">↓</button>
            <button className="h-11 rounded-xl border border-slate-200 px-3" onClick={() => removeTask(task)} type="button">✕</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold"
          onClick={() =>
            setTasks((current) => [
              ...current,
              { key: crypto.randomUUID(), title: "", isCompleted: false },
            ])
          }
          type="button"
        >
          + Добавить пункт
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
          disabled={isPending}
          onClick={save}
          type="button"
        >
          {isPending ? "Сохраняем…" : "Сохранить пункты"}
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-800">{error}</p> : null}
    </section>
  );
}
