import type {
  JsonValue,
  RequestHistoryAction,
  RequestHistoryRow,
} from "@/lib/db/request-history";

const FIELD_LABELS: Record<string, string> = {
  location_id: "Заведение",
  restaurant: "Заведение",
  location: "Заведение",
  address: "Адрес",
  description: "Описание",
  title: "Название",
  urgency: "Приоритет",
  priority: "Приоритет",
  request_type: "Тип заявки",
  planned_date: "Дата выполнения",
  start_time: "Время начала",
  end_time: "Время окончания",
  estimated_duration: "Длительность",
  status: "Статус",
  execution_type: "Тип исполнения",
  queue_position: "Очередь",
  queue: "Очередь",
  assigned_to: "Ответственный",
  responsible: "Ответственный",
  manager_comment: "Комментарий менеджера",
  executor_comment: "Комментарий исполнителя",
  reported_by_name: "Контакт",
};

const STATUS_LABELS: Record<string, string> = {
  needs_planning: "Нужно запланировать",
  needs_review: "На проверке",
  planned: "Запланировано",
  in_progress: "В работе",
  waiting_client: "Ждём клиента",
  specialist_on_way: "Специалист в пути",
  waiting_parts: "Заказ запчастей",
  outsource: "Аутсорс",
  postponed: "Перенесено",
  done: "Выполнено",
  cancelled: "Отменено",
  duplicate: "Дубль",
  not_actual: "Неактуально",
};

const URGENCY_LABELS: Record<string, string> = {
  low: "Низкая",
  normal: "Обычная",
  high: "Высокая",
  critical: "Критичная",
};

const TYPE_LABELS: Record<string, string> = {
  repair: "Ремонт",
  maintenance: "Обслуживание",
  installation: "Монтаж",
  diagnostics: "Диагностика",
  delivery: "Доставка",
  consultation: "Консультация",
  other: "Другое",
};

const EXECUTION_LABELS: Record<string, string> = {
  internal: "Внутреннее",
  outsourced: "Аутсорс",
  mixed: "Смешанное",
};

/** Short noun-phrase titles for timeline cards. */
const ACTION_TITLES: Record<RequestHistoryAction, string> = {
  request_created: "Создана заявка",
  request_updated: "Изменено поле",
  assignment_added: "Назначен механик",
  assignment_removed: "Снято назначение",
  responsible_changed: "Переназначен ответственный",
  participant_added: "Добавлен участник",
  participant_removed: "Убран участник",
  request_moved: "Заявка перемещена",
  queue_changed: "Изменена очередь",
  schedule_changed: "Изменено время",
  status_changed: "Изменён статус",
  work_started: "Начата работа",
  work_completed: "Работа завершена",
  work_reopened: "Возвращена в работу",
  waiting_parts_started: "Ожидание запчастей",
  waiting_parts_finished: "Работа возобновлена",
  moved_to_trash: "Перемещена в корзину",
  restored_from_trash: "Восстановлена из корзины",
  outsourced: "Передана на аутсорс",
  returned_from_outsource: "Возвращена с аутсорса",
  comment_added: "Добавлен комментарий",
  comment_updated: "Обновлён комментарий",
  comment_deleted: "Удалён комментарий",
  attachment_added: "Добавлены фотографии",
  attachment_removed: "Удалена фотография",
  task_completed: "Выполнен пункт работы",
  task_reopened: "Пункт работы возвращён",
};

export type HistoryTone =
  | "create"
  | "edit"
  | "assignment"
  | "move"
  | "work"
  | "complete"
  | "trash"
  | "restore"
  | "outsource";

export type HistoryVisual = {
  icon: string;
  tone: HistoryTone;
};

const ACTION_VISUALS: Record<string, HistoryVisual> = {
  request_created: { icon: "🟢", tone: "create" },
  request_updated: { icon: "✏️", tone: "edit" },
  assignment_added: { icon: "👤", tone: "assignment" },
  assignment_removed: { icon: "👤", tone: "assignment" },
  responsible_changed: { icon: "👥", tone: "assignment" },
  participant_added: { icon: "👤", tone: "assignment" },
  participant_removed: { icon: "👤", tone: "assignment" },
  request_moved: { icon: "🔄", tone: "move" },
  queue_changed: { icon: "↕️", tone: "move" },
  schedule_changed: { icon: "✏️", tone: "edit" },
  status_changed: { icon: "📌", tone: "edit" },
  work_started: { icon: "▶️", tone: "work" },
  work_completed: { icon: "✅", tone: "complete" },
  work_reopened: { icon: "↩️", tone: "work" },
  waiting_parts_started: { icon: "🟡", tone: "work" },
  waiting_parts_finished: { icon: "🟢", tone: "complete" },
  outsourced: { icon: "🚚", tone: "outsource" },
  returned_from_outsource: { icon: "🏠", tone: "outsource" },
  moved_to_trash: { icon: "🗑️", tone: "trash" },
  restored_from_trash: { icon: "♻️", tone: "restore" },
  comment_added: { icon: "💬", tone: "edit" },
  comment_updated: { icon: "💬", tone: "edit" },
  comment_deleted: { icon: "💬", tone: "edit" },
  attachment_added: { icon: "📷", tone: "edit" },
  attachment_removed: { icon: "📷", tone: "edit" },
  task_completed: { icon: "☑️", tone: "complete" },
  task_reopened: { icon: "↩️", tone: "work" },
};

export const HISTORY_TONE_STYLES: Record<
  HistoryTone,
  { badge: string; ring: string }
> = {
  create: {
    badge: "bg-emerald-100 text-emerald-800",
    ring: "ring-emerald-200",
  },
  edit: {
    badge: "bg-sky-100 text-sky-800",
    ring: "ring-sky-200",
  },
  assignment: {
    badge: "bg-violet-100 text-violet-800",
    ring: "ring-violet-200",
  },
  move: {
    badge: "bg-cyan-100 text-cyan-800",
    ring: "ring-cyan-200",
  },
  work: {
    badge: "bg-orange-100 text-orange-800",
    ring: "ring-orange-200",
  },
  complete: {
    badge: "bg-emerald-100 text-emerald-800",
    ring: "ring-emerald-200",
  },
  trash: {
    badge: "bg-rose-100 text-rose-800",
    ring: "ring-rose-200",
  },
  restore: {
    badge: "bg-emerald-100 text-emerald-800",
    ring: "ring-emerald-200",
  },
  outsource: {
    badge: "bg-fuchsia-100 text-fuchsia-800",
    ring: "ring-fuchsia-200",
  },
};

export type HistoryChangeBlock = {
  label: string | null;
  oldValue: string;
  newValue: string;
};

export type FormattedHistoryEvent = {
  id: string;
  action: string;
  createdAt: string;
  timeLabel: string;
  dateGroupKey: string;
  dateGroupLabel: string;
  whenLabel: string;
  actorName: string;
  title: string;
  icon: string;
  tone: HistoryTone;
  change: HistoryChangeBlock | null;
  /** Legacy one-line change for callers that still expect it. */
  changeLine: string | null;
  notes: string[];
  details: string[];
  comment: string | null;
  fieldName: string | null;
  metadata: Record<string, JsonValue>;
  oldValue: JsonValue;
  newValue: JsonValue;
};

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function asRecord(value: JsonValue): Record<string, JsonValue> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }
  return null;
}

function metaString(
  metadata: Record<string, JsonValue>,
  key: string,
): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metaNumber(
  metadata: Record<string, JsonValue>,
  key: string,
): number | null {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatScalar(
  value: JsonValue,
  fieldName?: string | null,
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    if (isUuidLike(value)) {
      return "—";
    }
    if (fieldName === "status") {
      return STATUS_LABELS[value] ?? value;
    }
    if (fieldName === "urgency" || fieldName === "priority") {
      return URGENCY_LABELS[value] ?? value;
    }
    if (fieldName === "request_type") {
      return TYPE_LABELS[value] ?? value;
    }
    if (fieldName === "execution_type") {
      return EXECUTION_LABELS[value] ?? value;
    }
    if (
      (fieldName === "start_time" || fieldName === "end_time") &&
      value.length >= 5
    ) {
      return value.slice(0, 5);
    }
    if (value.length > 160) {
      return `${value.slice(0, 157)}…`;
    }
    return value;
  }

  const record = asRecord(value);
  if (record) {
    if (typeof record.name === "string") {
      return record.name;
    }
    if (typeof record.label === "string") {
      return record.label;
    }
  }

  return "—";
}

function fieldLabel(fieldName: string | null) {
  if (!fieldName) {
    return null;
  }
  return FIELD_LABELS[fieldName] ?? null;
}

function moscowDateParts(iso: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    dateKey: formatter.format(new Date(iso)),
    timeLabel: timeFormatter.format(new Date(iso)),
  };
}

function todayYesterdayKeys() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const now = new Date();
  const today = formatter.format(now);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = formatter.format(yesterdayDate);
  return { today, yesterday };
}

const MONTH_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function formatLongDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }
  return `${day} ${MONTH_GENITIVE[month - 1]}`;
}

function dateGroupLabel(dateKey: string) {
  const { today, yesterday } = todayYesterdayKeys();
  if (dateKey === today) {
    return "Сегодня";
  }
  if (dateKey === yesterday) {
    return "Вчера";
  }
  return formatLongDateLabel(dateKey);
}

function whenLabel(dateKey: string, timeLabel: string) {
  const { today, yesterday } = todayYesterdayKeys();
  if (dateKey === today || dateKey === yesterday) {
    return timeLabel;
  }
  return `${formatLongDateLabel(dateKey)} · ${timeLabel}`;
}

function buildTitle(event: RequestHistoryRow): string {
  const action = event.action as RequestHistoryAction;
  const base = ACTION_TITLES[action] ?? "Изменение заявки";
  const label = fieldLabel(event.field_name);
  const metadata = event.metadata ?? {};

  if (action === "request_updated" && label) {
    return `Изменено: ${label}`;
  }

  if (action === "schedule_changed" && label) {
    return `Изменено: ${label}`;
  }

  if (action === "attachment_added") {
    const count = metaNumber(metadata, "count");
    if (count === 1) return "Добавлена 1 фотография";
    if (count !== null) return `Добавлено ${count} фотографий`;
  }

  return base;
}

function buildChange(event: RequestHistoryRow): HistoryChangeBlock | null {
  const metadata = event.metadata ?? {};
  const action = event.action as RequestHistoryAction;

  if (action === "responsible_changed" || action === "request_moved") {
    const fromName =
      metaString(metadata, "fromMechanicName") ??
      formatScalar(event.old_value, "responsible");
    const toName =
      metaString(metadata, "toMechanicName") ??
      formatScalar(event.new_value, "responsible");
    if (fromName === "—" && toName === "—") {
      return null;
    }
    return {
      label: action === "request_moved" ? "Ответственный" : "Ответственный",
      oldValue: fromName,
      newValue: toName,
    };
  }

  if (
    action === "assignment_added" ||
    action === "assignment_removed" ||
    action === "participant_added" ||
    action === "participant_removed"
  ) {
    const name = metaString(metadata, "mechanicName");
    if (!name) {
      return null;
    }
    return {
      label: "Механик",
      oldValue: action.includes("removed") ? name : "—",
      newValue: action.includes("removed") ? "—" : name,
    };
  }

  if (action === "queue_changed") {
    return {
      label: "Очередь",
      oldValue: formatScalar(event.old_value, "queue"),
      newValue: formatScalar(event.new_value, "queue"),
    };
  }

  if (action === "outsourced" || action === "returned_from_outsource") {
    return {
      label: "Тип исполнения",
      oldValue: formatScalar(event.old_value, "execution_type"),
      newValue: formatScalar(event.new_value, "execution_type"),
    };
  }

  if (
    action === "work_started" ||
    action === "work_completed" ||
    action === "work_reopened" ||
    action === "waiting_parts_started" ||
    action === "waiting_parts_finished" ||
    action === "status_changed"
  ) {
    const oldLabel = formatScalar(event.old_value, "status");
    const newLabel = formatScalar(event.new_value, "status");
    if (oldLabel === "—" && newLabel === "—") {
      return null;
    }
    return {
      label: "Статус",
      oldValue: oldLabel,
      newValue: newLabel,
    };
  }

  if (event.old_value === null && event.new_value === null) {
    return null;
  }

  const oldLabel = formatScalar(event.old_value, event.field_name);
  const newLabel = formatScalar(event.new_value, event.field_name);
  if (oldLabel === "—" && newLabel === "—") {
    return null;
  }

  return {
    label: fieldLabel(event.field_name),
    oldValue: oldLabel,
    newValue: newLabel,
  };
}

function buildNotes(event: RequestHistoryRow): string[] {
  const metadata = event.metadata ?? {};
  const notes: string[] = [];
  const action = event.action as RequestHistoryAction;

  if (action === "request_created") {
    const location = metaString(metadata, "locationName");
    const number = metadata.requestNumber;
    if (typeof number === "number") {
      notes.push(`№ ${number}`);
    }
    if (location) {
      notes.push(location);
    }
  }

  if (action === "request_moved" || action === "queue_changed") {
    const fromQueue = metaNumber(metadata, "fromQueue");
    const toQueue = metaNumber(metadata, "toQueue");
    if (fromQueue !== null && toQueue !== null && action === "request_moved") {
      notes.push(`Очередь: ${fromQueue} → ${toQueue}`);
    }
    const date = metaString(metadata, "date");
    if (date) {
      notes.push(`Дата: ${date}`);
    }
  }

  if (action === "moved_to_trash") {
    const reason = metaString(metadata, "reason");
    if (reason) {
      notes.push(`Причина: ${reason}`);
    }
  }

  if (action === "outsourced") {
    const contractor = metaString(metadata, "contractorName");
    if (contractor) {
      notes.push(`Подрядчик: ${contractor}`);
    }
    if (typeof metadata.removedAssigneesCount === "number") {
      notes.push(`Снято назначений: ${metadata.removedAssigneesCount}`);
    }
  }

  if (
    action === "work_completed" &&
    metaString(metadata, "scope") === "participant"
  ) {
    notes.push("Завершена своя часть");
  }

  if (action === "attachment_added") {
    const count = metaNumber(metadata, "count");
    if (count !== null) {
      notes.push(
        count === 1 ? "Добавлена 1 фотография" : `Добавлено ${count} фотографий`,
      );
    }
  }

  if (action === "attachment_removed") {
    notes.push("Фотография удалена");
  }

  if (action === "comment_added") {
    const photoCount = metaNumber(metadata, "photoCount");
    if (photoCount !== null && photoCount > 0) {
      notes.push(
        photoCount === 1
          ? "С 1 фотографией"
          : `С ${photoCount} фотографиями`,
      );
    }
  }

  if (action === "task_completed" || action === "task_reopened") {
    const title = metaString(metadata, "taskTitle");
    const name = metaString(metadata, "mechanicName");
    if (name && title) {
      notes.push(
        action === "task_completed"
          ? `${name} выполнил пункт: ${title}`
          : `${name} снял пункт: ${title}`,
      );
    } else if (title) {
      notes.push(title);
    }
  }

  return notes;
}

function buildComment(event: RequestHistoryRow): string | null {
  const metadata = event.metadata ?? {};
  const action = event.action as RequestHistoryAction;

  if (action === "work_completed" || action === "outsourced") {
    return metaString(metadata, "comment");
  }

  if (
    event.field_name === "executor_comment" ||
    event.field_name === "manager_comment"
  ) {
    const next = formatScalar(event.new_value, event.field_name);
    return next === "—" ? null : next;
  }

  return null;
}

export function getHistoryVisual(action: string): HistoryVisual {
  return ACTION_VISUALS[action] ?? { icon: "📌", tone: "edit" };
}

export function formatHistoryEvent(
  event: RequestHistoryRow,
): FormattedHistoryEvent {
  const { dateKey, timeLabel } = moscowDateParts(event.created_at);
  const visual = getHistoryVisual(event.action);
  const change = buildChange(event);
  const notes = buildNotes(event);

  return {
    id: event.id,
    action: event.action,
    createdAt: event.created_at,
    timeLabel,
    dateGroupKey: dateKey,
    dateGroupLabel: dateGroupLabel(dateKey),
    whenLabel: whenLabel(dateKey, timeLabel),
    actorName: event.actor_name || "Неизвестный пользователь",
    title: buildTitle(event),
    icon: visual.icon,
    tone: visual.tone,
    change,
    changeLine: change
      ? `${change.oldValue} → ${change.newValue}`
      : null,
    notes,
    details: notes,
    comment: buildComment(event),
    fieldName: event.field_name,
    metadata: event.metadata ?? {},
    oldValue: event.old_value,
    newValue: event.new_value,
  };
}

export function groupHistoryByDate(events: FormattedHistoryEvent[]) {
  const groups: Array<{
    key: string;
    label: string;
    items: FormattedHistoryEvent[];
  }> = [];
  const index = new Map<string, number>();

  for (const event of events) {
    const existing = index.get(event.dateGroupKey);
    if (existing === undefined) {
      index.set(event.dateGroupKey, groups.length);
      groups.push({
        key: event.dateGroupKey,
        label: event.dateGroupLabel,
        items: [event],
      });
    } else {
      groups[existing].items.push(event);
    }
  }

  return groups;
}

export function formatEventsCount(count: number, hasMore: boolean) {
  const n = hasMore ? `${count}+` : String(count);
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = "событий";
  if (!hasMore) {
    if (mod10 === 1 && mod100 !== 11) {
      word = "событие";
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      word = "события";
    }
  }
  return `${n} ${word}`;
}
