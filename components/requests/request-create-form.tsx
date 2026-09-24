"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EmployeeOption } from "@/lib/db/employees";
import type { LocationOption } from "@/lib/db/locations";
import { createRequestAction } from "@/app/requests/new/actions";
import { RequestAssigneesFields } from "@/components/requests/request-assignees-fields";
import {
  PhotoPicker,
  photosToFormData,
  type PhotoDraft,
} from "@/components/attachments/photo-picker";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

const requestTypes = [
  { value: "repair", label: "Ремонт" },
  { value: "maintenance", label: "Обслуживание" },
  { value: "installation", label: "Монтаж" },
  { value: "diagnostics", label: "Диагностика" },
  { value: "delivery", label: "Доставка" },
  { value: "consultation", label: "Консультация" },
  { value: "other", label: "Другое" },
];

const urgencyLevels = [
  { value: "low", label: "Низкий" },
  { value: "normal", label: "Обычный" },
  { value: "high", label: "Высокий" },
  { value: "critical", label: "Критичный" },
];

type RequestCreateFormProps = {
  locations: LocationOption[];
  employees: EmployeeOption[];
  initialLocationId?: string;
};

const inputClassName =
  "mt-2 box-border w-full max-w-full min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-950 shadow-sm shadow-slate-200/40 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5";

const labelClassName = "min-w-0 text-sm font-medium text-slate-800";

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

export function RequestCreateForm({
  initialLocationId,
  locations,
  employees,
}: RequestCreateFormProps) {
  const defaultLocationId = locations.some(
    (location) => location.id === initialLocationId,
  )
    ? (initialLocationId ?? "")
    : "";
  const [selectedLocationId, setSelectedLocationId] = useState(defaultLocationId);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId),
    [locations, selectedLocationId],
  );

  async function handleSubmit(formData: FormData) {
    setFormError(null);
    photosToFormData(photos, formData);

    try {
      await createRequestAction(formData);
    } catch (error) {
      // redirect() throws a special NEXT_REDIRECT error — rethrow it.
      if (
        error &&
        typeof error === "object" &&
        "digest" in error &&
        typeof (error as { digest?: string }).digest === "string" &&
        (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
      ) {
        throw error;
      }
      setFormError(
        error instanceof Error ? error.message : "Не удалось создать заявку.",
      );
    }
  }

  return (
    <form
      action={handleSubmit}
      className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60"
    >
      <SectionHeader
        description="Эти данные помогут быстро понять, куда ехать и с кем связаться."
        eyebrow="Шаг 1"
        title="Заведение и контакт"
      />
      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
        <label className={`${labelClassName} md:col-span-2`}>
          Заведение
          <select
            className={inputClassName}
            name="location_id"
            onChange={(event) => setSelectedLocationId(event.target.value)}
            required
            value={selectedLocationId}
          >
            <option value="">Выберите существующее заведение</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-normal text-slate-500">
            <span>Заявка привязывается к заведению без создания дубля.</span>
            <Link
              className="font-semibold text-slate-950 underline-offset-4 hover:underline"
              href="/locations/new"
            >
              Создать новое заведение
            </Link>
          </div>
        </label>

        <label className={`${labelClassName} md:col-span-2`}>
          Адрес
          <input
            className={inputClassName}
            name="address"
            placeholder="Город, улица, дом"
            readOnly
            value={selectedLocation?.address ?? ""}
          />
        </label>

        <label className={labelClassName}>
          Контакт
          <input
            className={inputClassName}
            name="contact"
            placeholder="Имя управляющего или контактного лица"
            readOnly
            value={selectedLocation?.contact ?? ""}
          />
        </label>

        <label className={labelClassName}>
          Телефон
          <input
            className={inputClassName}
            name="phone"
            placeholder="+7..."
            readOnly
            type="tel"
            value={selectedLocation?.phone ?? ""}
          />
        </label>
      </div>

      <SectionHeader
        description="Эти параметры определяют, как заявка появится в общем списке."
        eyebrow="Шаг 2"
        title="Классификация и назначение"
      />
      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
        <label className={labelClassName}>
          Тип заявки
          <select
            className={inputClassName}
            defaultValue="repair"
            name="request_type"
          >
            {requestTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClassName}>
          Приоритет
          <select className={inputClassName} defaultValue="normal" name="urgency">
            {urgencyLevels.map((urgency) => (
              <option key={urgency.value} value={urgency.value}>
                {urgency.label}
              </option>
            ))}
          </select>
        </label>

        <RequestAssigneesFields employees={employees} />
      </div>

      <SectionHeader
        description="Укажите временное окно, опишите проблему и при необходимости приложите фото."
        eyebrow="Шаг 3"
        title="Время, описание и фото"
      />
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClassName}>
            Время начала
            <input className={inputClassName} name="start_time" type="time" />
          </label>
          <label className={labelClassName}>
            Время окончания
            <input className={inputClassName} name="end_time" type="time" />
          </label>
        </div>

        <label className={labelClassName}>
          Описание проблемы
          <textarea
            className={`${inputClassName} min-h-44 resize-y leading-6`}
            name="description"
            placeholder="Опишите, что произошло и что нужно сделать"
            required
          />
        </label>

        <PhotoPicker onChange={setPhotos} photos={photos} />
      </div>

      {formError ? (
        <div className="mx-5 mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 sm:mx-6">
          {formError}
        </div>
      ) : null}

      <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/90 p-4 backdrop-blur sm:flex-row sm:justify-end sm:p-5">
        <Link
          className="inline-flex w-full justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 sm:w-auto"
          href="/requests"
        >
          Отмена
        </Link>
        <FormSubmitButton
          className="inline-flex justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/80 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          pendingLabel="Создание…"
        >
          Создать заявку
        </FormSubmitButton>
      </div>
    </form>
  );
}
