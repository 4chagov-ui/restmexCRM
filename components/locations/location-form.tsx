import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { LocationDetail } from "@/lib/db/locations";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5";

const labelClassName = "text-sm font-medium text-slate-800";

type LocationFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  location?: LocationDetail;
  submitLabel: string;
};

export function LocationForm({
  action,
  location,
  submitLabel,
}: LocationFormProps) {
  return (
    <form
      action={action}
      className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur"
    >
      {location ? (
        <input name="location_id" type="hidden" value={location.id} />
      ) : null}

      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Заведение
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
          Основные данные
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Используются только поля таблицы <code>locations</code>.
        </p>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
        <label className={`${labelClassName} md:col-span-2`}>
          Название заведения
          <input
            className={inputClassName}
            defaultValue={location?.name ?? ""}
            name="name"
            placeholder="Например, Красивый ресторан"
            required
          />
        </label>

        <label className={`${labelClassName} md:col-span-2`}>
          Адрес
          <input
            className={inputClassName}
            defaultValue={location?.address ?? ""}
            name="address"
            placeholder="Город, улица, дом"
          />
        </label>

        <label className={labelClassName}>
          Контактное лицо
          <input
            className={inputClassName}
            defaultValue={location?.contact ?? ""}
            name="contact"
            placeholder="Имя управляющего"
          />
        </label>

        <label className={labelClassName}>
          Телефон
          <input
            className={inputClassName}
            defaultValue={location?.phone ?? ""}
            name="phone"
            placeholder="+7..."
            type="tel"
          />
        </label>

        <label className={`${labelClassName} md:col-span-2`}>
          Ссылка на Яндекс Карты
          <input
            className={inputClassName}
            defaultValue={location?.yandex_maps_url ?? ""}
            name="yandex_maps_url"
            placeholder="https://yandex.ru/maps/..."
            type="url"
          />
        </label>

        <label className={labelClassName}>
          Режим работы
          <input
            className={inputClassName}
            defaultValue={location?.working_hours ?? ""}
            name="working_hours"
            placeholder="Например, 10:00-23:00"
          />
        </label>

        <label className={`${labelClassName} md:col-span-2`}>
          Примечание
          <textarea
            className={`${inputClassName} min-h-32 resize-y leading-6`}
            defaultValue={location?.notes ?? ""}
            name="notes"
            placeholder="Район, особенности входа, важные детали"
          />
        </label>
      </div>

      <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/90 p-4 backdrop-blur sm:flex-row sm:justify-end sm:p-5">
        <a
          className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
          href={location ? `/locations/${location.id}` : "/locations"}
        >
          Отмена
        </a>
        <FormSubmitButton
          className="inline-flex justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300/80 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          pendingLabel="Сохранение…"
        >
          {submitLabel}
        </FormSubmitButton>
      </div>
    </form>
  );
}
