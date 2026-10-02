"use client";

import { useState } from "react";

type TaskDraftListProps = {
  initialTitles?: string[];
};

export function TaskDraftList({ initialTitles = ["", "", ""] }: TaskDraftListProps) {
  const [titles, setTitles] = useState(
    initialTitles.length > 0 ? initialTitles : [""],
  );

  function updateTitle(index: number, value: string) {
    setTitles((current) =>
      current.map((title, itemIndex) => (itemIndex === index ? value : title)),
    );
  }

  function removeTitle(index: number) {
    setTitles((current) =>
      current.length === 1 ? [""] : current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function moveTitle(index: number, direction: -1 | 1) {
    setTitles((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const copy = [...current];
      const currentTitle = copy[index];
      const nextTitle = copy[nextIndex];
      if (currentTitle === undefined || nextTitle === undefined) {
        return current;
      }
      copy[index] = nextTitle;
      copy[nextIndex] = currentTitle;
      return copy;
    });
  }

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-800">Работы</p>
      <div className="mt-3 grid gap-2">
        {titles.map((title, index) => (
          <div className="flex min-w-0 items-center gap-2" key={`${index}-${titles.length}`}>
            <span className="w-5 shrink-0 text-sm text-slate-400">{index + 1}.</span>
            <input
              className="box-border h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-slate-950"
              name="task_title"
              onChange={(event) => updateTitle(index, event.target.value)}
              placeholder="Что нужно сделать"
              value={title}
            />
            <button
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-sm"
              onClick={() => moveTitle(index, -1)}
              type="button"
            >
              ↑
            </button>
            <button
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-sm"
              onClick={() => moveTitle(index, 1)}
              type="button"
            >
              ↓
            </button>
            <button
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm"
              onClick={() => removeTitle(index)}
              type="button"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-950"
        onClick={() => setTitles((current) => [...current, ""])}
        type="button"
      >
        + Добавить пункт
      </button>
    </div>
  );
}
