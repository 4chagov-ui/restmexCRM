"use client";

import { useState, useTransition } from "react";
import { moveToTrashAction } from "@/app/requests/trash/actions";

const reasonPresets = [
  "Создана по ошибке",
  "Дубликат",
  "Отменена заказчиком",
  "Другая причина",
] as const;

type MoveToTrashDialogProps = {
  requestId: string;
  requestNumber: number | null;
  returnTo: string;
};

export function MoveToTrashDialog({
  requestId,
  requestNumber,
  returnTo,
}: MoveToTrashDialogProps) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<(typeof reasonPresets)[number]>(
    "Создана по ошибке",
  );
  const [customReason, setCustomReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reason =
    preset === "Другая причина" ? customReason.trim() : preset;

  function submit() {
    if (!reason) {
      setError("Укажите причину.");
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("request_id", requestId);
    formData.set("deletion_reason", reason);
    formData.set("return_to", returnTo);

    startTransition(async () => {
      try {
        await moveToTrashAction(formData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Не удалось переместить в корзину.",
        );
      }
    });
  }

  return (
    <>
      <button
        className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
        onClick={() => setOpen(true)}
        type="button"
      >
        Переместить в корзину
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <div
            aria-modal
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            role="dialog"
          >
            <h3 className="text-lg font-semibold text-slate-950">
              Переместить заявку #
              {requestNumber ?? "—"} в корзину?
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Заявка исчезнет из планов и кабинетов механиков. Физически из базы
              не удаляется — её можно восстановить из раздела «Корзина».
            </p>

            <fieldset className="mt-4 grid gap-2">
              <legend className="text-xs font-medium text-slate-500">
                Причина
              </legend>
              {reasonPresets.map((item) => (
                <label
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                  key={item}
                >
                  <input
                    checked={preset === item}
                    name="trash_reason"
                    onChange={() => setPreset(item)}
                    type="radio"
                    value={item}
                  />
                  {item}
                </label>
              ))}
            </fieldset>

            {preset === "Другая причина" ? (
              <textarea
                className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-950"
                onChange={(event) => setCustomReason(event.target.value)}
                placeholder="Опишите причину"
                value={customReason}
              />
            ) : null}

            {error ? (
              <p className="mt-3 text-sm font-medium text-rose-700">{error}</p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                disabled={isPending}
                onClick={() => setOpen(false)}
                type="button"
              >
                Отмена
              </button>
              <button
                className="inline-flex h-11 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isPending}
                onClick={submit}
                type="button"
              >
                {isPending ? "Перемещаем…" : "Переместить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
