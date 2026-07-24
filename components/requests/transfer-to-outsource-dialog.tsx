"use client";

import { useState, useTransition } from "react";
import { transferToOutsourceAction } from "@/app/outsourcing/actions";

type TransferToOutsourceDialogProps = {
  requestId: string;
  requestNumber: number | null;
  returnTo: string;
};

export function TransferToOutsourceDialog({
  requestId,
  requestNumber,
  returnTo,
}: TransferToOutsourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [contractor, setContractor] = useState("");
  const [contact, setContact] = useState("");
  const [comment, setComment] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [outsourcedAt, setOutsourcedAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!contractor.trim()) {
      setError("Укажите подрядчика.");
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("request_id", requestId);
    formData.set("outsource_contractor", contractor.trim());
    formData.set("outsource_contact", contact.trim());
    formData.set("outsource_comment", comment.trim());
    formData.set("outsource_expected_date", expectedDate);
    formData.set(
      "outsourced_at",
      outsourcedAt
        ? new Date(`${outsourcedAt}T12:00:00`).toISOString()
        : new Date().toISOString(),
    );
    formData.set("return_to", returnTo);

    startTransition(async () => {
      try {
        await transferToOutsourceAction(formData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Не удалось передать на аутсорс.",
        );
      }
    });
  }

  return (
    <>
      <button
        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-4 text-sm font-semibold text-fuchsia-900 transition hover:bg-fuchsia-100"
        onClick={() => setOpen(true)}
        type="button"
      >
        Передать на аутсорс
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <div
            aria-modal
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            role="dialog"
          >
            <h3 className="text-lg font-semibold text-slate-950">
              Передать заявку #{requestNumber ?? "—"} на аутсорс
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Внутренние исполнители будут сняты, заявка исчезнет из планов
              механиков и появится в разделе «Аутсорс».
            </p>

            <div className="mt-4 grid gap-3">
              <label className="text-xs font-medium text-slate-500">
                Подрядчик
                <input
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  onChange={(event) => setContractor(event.target.value)}
                  required
                  value={contractor}
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Контакт
                <input
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  onChange={(event) => setContact(event.target.value)}
                  value={contact}
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Дата передачи
                <input
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  onChange={(event) => setOutsourcedAt(event.target.value)}
                  type="date"
                  value={outsourcedAt}
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Ожидаемый срок
                <input
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  onChange={(event) => setExpectedDate(event.target.value)}
                  type="date"
                  value={expectedDate}
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Комментарий
                <textarea
                  className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) => setComment(event.target.value)}
                  value={comment}
                />
              </label>
            </div>

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
                className="inline-flex h-11 items-center justify-center rounded-xl bg-fuchsia-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isPending}
                onClick={submit}
                type="button"
              >
                {isPending ? "Передаём…" : "Передать"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
