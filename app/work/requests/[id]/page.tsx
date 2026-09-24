import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoGallery } from "@/components/attachments/photo-gallery";
import { RequestCommentsFeed } from "@/components/attachments/request-comments-feed";
import { RequestHistorySection } from "@/components/requests/request-history-section";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { WorkRequestActions } from "@/components/work/work-request-actions";
import { WorkTeamBlock } from "@/components/work/work-team-block";
import { requireMechanicUser } from "@/lib/auth/current-user";
import {
  listRequestLevelPhotos,
  signAttachmentUrls,
} from "@/lib/db/attachments";
import { listRequestComments } from "@/lib/db/request-comments";
import { getRequestHistory } from "@/lib/db/request-history";
import { getMechanicRequestById } from "@/lib/db/work";
import { getSafeReturnTo } from "@/lib/navigation/return-to";
import { getPhoneHref } from "@/lib/phone";

export const dynamic = "force-dynamic";

type WorkRequestDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    returnTo?: string;
  }>;
};

const urgencyLabels: Record<string, string> = {
  low: "Низкая",
  normal: "Обычная",
  high: "Высокая",
  critical: "Критичная",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function WorkRequestDetailPage({
  params,
  searchParams,
}: WorkRequestDetailPageProps) {
  const context = await requireMechanicUser();
  const { id } = await params;
  const { returnTo: returnToParam } = await searchParams;
  const backHref = getSafeReturnTo(returnToParam ?? null, "/work/requests");
  const request = await getMechanicRequestById(context.employee.id, id);

  if (!request) {
    notFound();
  }

  // Only after membership check — do not probe history/media for foreign request ids.
  const [history, photoRows, comments] = await Promise.all([
    getRequestHistory({
      requestId: id,
      limit: 50,
      offset: 0,
    }),
    listRequestLevelPhotos(id),
    listRequestComments(id),
  ]);
  const photos = await signAttachmentUrls(photoRows);

  const phone = request.location?.phone;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Заявка
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {request.location?.name ?? "Заведение не указано"}
              </h1>
              <p className="mt-2 text-base leading-7 text-slate-600">
                {request.location?.address ?? "Адрес не указан"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                #{request.request_number ?? "без номера"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <RequestStatusBadge status={request.status} />
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {urgencyLabels[request.urgency] ?? request.urgency}
                </span>
              </div>
              {request.my_role === "responsible" ? (
                <p className="mt-3 text-sm font-semibold text-amber-800">
                  ⭐ Вы ответственный
                </p>
              ) : null}
              {request.my_role === "participant" ? (
                <p className="mt-3 text-sm font-semibold text-sky-800">
                  👥 Вы участвуете в заявке
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {phone ? (
                <a
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white"
                  href={getPhoneHref(phone)}
                >
                  Позвонить
                </a>
              ) : null}
              {request.location?.yandex_maps_url ? (
                <a
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950"
                  href={request.location.yandex_maps_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Яндекс Карты
                </a>
              ) : null}
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950 sm:col-span-2"
                href={backHref}
              >
                К моим задачам
              </Link>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/50 sm:p-5">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            Детали выезда
          </h2>

          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            <InfoCard label="Адрес" value={request.location?.address ?? "Не указан"} />
            <InfoCard label="Контакт" value={request.location?.contact ?? "Не указан"} />
            <InfoCard label="Телефон" value={phone ?? "Не указан"} />
            <InfoCard
              label="Дата"
              value={
                request.planned_date
                  ? dateFormatter.format(new Date(`${request.planned_date}T00:00:00`))
                  : "Не указана"
              }
            />
            <InfoCard label="Время" value={formatTimeRange(request)} />
            <InfoCard
              label="Очередь"
              value={request.queue_position ?? "Не указана"}
            />
          </dl>

          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Описание проблемы
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {request.description}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Фотографии
            </p>
            <div className="mt-3">
              <PhotoGallery
                emptyLabel="Фотографий проблемы пока нет"
                photos={photos}
              />
            </div>
          </div>
        </section>

        <RequestCommentsFeed
          comments={comments}
          legacyExecutorComment={request.executor_comment}
          legacyManagerComment={request.manager_comment}
        />

        <WorkTeamBlock
          assignees={request.assignees}
          currentEmployeeId={context.employee.id}
        />

        <WorkRequestActions request={request} />

        <RequestHistorySection
          initialHasMore={history.hasMore}
          initialItems={history.items}
          requestId={id}
        />
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function formatTimeRange(request: {
  start_time: string | null;
  end_time: string | null;
}) {
  const start = request.start_time?.slice(0, 5);
  const end = request.end_time?.slice(0, 5);

  if (start && end) {
    return `${start} — ${end}`;
  }

  if (start) {
    return `с ${start}`;
  }

  if (end) {
    return `до ${end}`;
  }

  return "Не указано";
}
