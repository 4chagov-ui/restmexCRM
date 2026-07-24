import type { RequestAssignee } from "@/lib/db/assignees";

const statusLabels = {
  assigned: "Назначен",
  in_progress: "В работе",
  completed: "Завершил",
} as const;

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

type WorkTeamBlockProps = {
  assignees: RequestAssignee[];
  currentEmployeeId: string;
};

export function WorkTeamBlock({
  assignees,
  currentEmployeeId,
}: WorkTeamBlockProps) {
  if (assignees.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 sm:p-5">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">
        Команда
      </h2>
      <ul className="mt-4 grid gap-2">
        {assignees.map((member) => {
          const isMe = member.employee_id === currentEmployeeId;
          const completedLabel =
            member.participation_status === "completed" && member.completed_at
              ? `Завершил в ${timeFormatter.format(new Date(member.completed_at))}`
              : statusLabels[member.participation_status];

          return (
            <li
              className={`rounded-xl px-3 py-3 ${
                isMe ? "border border-sky-200 bg-sky-50" : "bg-slate-50"
              }`}
              key={member.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-950">
                  {member.role === "responsible" ? "⭐ " : ""}
                  {member.employee_name}
                  {" — "}
                  {member.role === "responsible"
                    ? "ответственный"
                    : "участник"}
                </p>
                {isMe ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                    {member.role === "responsible"
                      ? "Вы ответственный"
                      : "Вы участвуете"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-600">{completedLabel}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
