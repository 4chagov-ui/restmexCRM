"use client";

import { useMemo, useState } from "react";
import type { EmployeeOption } from "@/lib/db/employees";

type RequestAssigneesFieldsProps = {
  employees: EmployeeOption[];
  initialResponsibleId?: string | null;
  initialParticipantIds?: string[];
  required?: boolean;
  compact?: boolean;
};

const inputClassName =
  "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition hover:border-slate-300 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5";

const inputClassNameComfortable =
  "mt-2 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition hover:border-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5";

export function RequestAssigneesFields({
  compact = false,
  employees,
  initialParticipantIds = [],
  initialResponsibleId = "",
  required = false,
}: RequestAssigneesFieldsProps) {
  const [responsibleId, setResponsibleId] = useState(initialResponsibleId ?? "");
  const [participantIds, setParticipantIds] = useState(
    initialParticipantIds.filter((id) => id && id !== initialResponsibleId),
  );
  const [pickerId, setPickerId] = useState("");

  const availableParticipants = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.id !== responsibleId && !participantIds.includes(employee.id),
      ),
    [employees, participantIds, responsibleId],
  );

  const selectedParticipants = useMemo(
    () =>
      participantIds
        .map((id) => employees.find((employee) => employee.id === id))
        .filter((employee): employee is EmployeeOption => Boolean(employee)),
    [employees, participantIds],
  );

  function addParticipant() {
    if (!pickerId || pickerId === responsibleId) {
      return;
    }
    setParticipantIds((current) =>
      current.includes(pickerId) ? current : [...current, pickerId],
    );
    setPickerId("");
  }

  const controlClass = compact ? inputClassName : inputClassNameComfortable;

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-slate-200 bg-slate-50/80 p-3"
          : "md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
      }
    >
      <h3
        className={
          compact
            ? "text-xs font-medium text-slate-500"
            : "text-sm font-semibold text-slate-950"
        }
      >
        Исполнители
      </h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Ответственный сможет окончательно закрыть заявку.
      </p>

      <label
        className={
          compact
            ? "mt-3 block text-xs font-medium text-slate-500"
            : "mt-4 block text-sm font-medium text-slate-800"
        }
      >
        Ответственный
        <select
          className={controlClass}
          name="assigned_to"
          onChange={(event) => {
            const next = event.target.value;
            setResponsibleId(next);
            setParticipantIds((current) =>
              current.filter((id) => id !== next),
            );
          }}
          required={required}
          value={responsibleId}
        >
          <option value="">Не назначен</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} · {employee.role}
            </option>
          ))}
        </select>
      </label>

      <div className={compact ? "mt-3" : "mt-4"}>
        <p
          className={
            compact
              ? "text-xs font-medium text-slate-500"
              : "text-sm font-medium text-slate-800"
          }
        >
          Участники
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selectedParticipants.length === 0 ? (
            <span className="text-xs text-slate-500">Пока без участников</span>
          ) : (
            selectedParticipants.map((employee) => (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
                key={employee.id}
              >
                {employee.name}
                <button
                  className="text-slate-400 hover:text-slate-950"
                  onClick={() =>
                    setParticipantIds((current) =>
                      current.filter((id) => id !== employee.id),
                    )
                  }
                  type="button"
                >
                  ×
                </button>
                <input name="participant_ids" type="hidden" value={employee.id} />
              </span>
            ))
          )}
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <select
            className={controlClass}
            onChange={(event) => setPickerId(event.target.value)}
            value={pickerId}
          >
            <option value="">+ Добавить участника</option>
            {availableParticipants.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.role}
              </option>
            ))}
          </select>
          <button
            className={
              compact
                ? "inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 disabled:opacity-50"
                : "inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
            }
            disabled={!pickerId}
            onClick={addParticipant}
            type="button"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}
