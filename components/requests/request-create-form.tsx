"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { EmployeeOption } from "@/lib/db/employees";
import type { LocationOption } from "@/lib/db/locations";
import { createRequestAction } from "@/app/requests/new/actions";
import { RequestAssigneesFields } from "@/components/requests/request-assignees-fields";
import { TaskDraftList } from "@/components/requests/task-draft-list";
import { PhotoPicker, type PhotoDraft } from "@/components/attachments/photo-picker";
import { uploadPhotosDirect } from "@/lib/attachments/upload-from-browser";
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
  const createdRequestId = useRef<string | null>(null);
  const tasksPending = useRef(false);
  const router = useRouter();
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId),
    [locations, selectedLocationId],
  );

  function isNextRedirect(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest?: string }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    );
  }

  async function handleSubmit(formData: FormData) {
    setFormError(null);

    let requestId = createdRequestId.current;
    if (requestId) {
      formData.set("existing_request_id", requestId);
    }

    if (!requestId || tasksPending.current) {
      try {
        const created = await createRequestAction(formData);
        if (created.requestId) {
          createdRequestId.current = created.requestId;
          requestId = created.requestId;
        }
        if (!created.ok) {
          tasksPending.current = Boolean(created.requestId);
          setFormError(created.error);
          return;
        }
        tasksPending.current = false;
        requestId = created.requestId;
        createdRequestId.current = requestId;
      } catch (error) {
        if (isNextRedirect(error)) {
          throw error;
        }
        setFormError("Не удалось создать заявку. Попробуйте ещё раз.");
        return;
      }
    }

    let failed = 0;
    if (photos.length > 0 && requestId) {
      try {
        const upload = await uploadPhotosDirect({
          requestId,
          files: photos.map((photo) => photo.file),
          scope: "request",
        });
        failed = upload.failures.length;
      } catch {
        setFormError(
          "Заявка создана, но не удалось загрузить фотографии. Нажмите «Создать заявку» ещё раз — повторно заявка не создастся.",
        );
        return;
      }
    }

    if (!requestId) {
      setFormError("Не удалось создать заявку. Попробуйте ещё раз.");
      return;
    }

    const params = new URLSearchParams({ saved: "1" });
    if (failed > 0) {
      params.set("photoErrors", String(failed));
    }
    router.push(`/requests/${requestId}?${params.toString()}`);
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
          />
        </label>

        <TaskDraftList />

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
