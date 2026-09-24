import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestPhotosPanel } from "@/components/attachments/request-photos-panel";
import { RequestCommentsFeed } from "@/components/attachments/request-comments-feed";
import { RequestEditForm } from "@/components/requests/request-edit-form";
import { RequestHistorySection } from "@/components/requests/request-history-section";
import { requireManagerUser } from "@/lib/auth/current-user";
import {
  listRequestLevelPhotos,
  signAttachmentUrls,
} from "@/lib/db/attachments";
import { getActiveEmployees } from "@/lib/db/employees";
import { listRequestComments } from "@/lib/db/request-comments";
import { getRequestById } from "@/lib/db/requests";
import { getRequestHistory } from "@/lib/db/request-history";
import { getSafeReturnTo } from "@/lib/navigation/return-to";

export const dynamic = "force-dynamic";

type RequestDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    saved?: string;
    returnTo?: string;
    photoErrors?: string;
  }>;
};

export default async function RequestDetailPage({
  params,
  searchParams,
}: RequestDetailPageProps) {
  await requireManagerUser();

  const { id } = await params;
  const {
    saved,
    returnTo: returnToParam,
    photoErrors,
  } = await searchParams;
  const cancelHref = getSafeReturnTo(returnToParam ?? null, "/requests");
  const [request, employees, photoRows, comments] = await Promise.all([
    getRequestById(id),
    getActiveEmployees(),
    listRequestLevelPhotos(id),
    listRequestComments(id),
  ]);

  if (!request) {
    notFound();
  }

  const [history, photos] = await Promise.all([
    getRequestHistory({
      requestId: id,
      limit: 50,
      offset: 0,
    }),
    signAttachmentUrls(photoRows),
  ]);

  const assignees = request.assignees;
  const photoErrorCount = Number(photoErrors ?? "0");

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {saved === "1" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Изменения сохранены.
          </div>
        ) : null}

        {photoErrorCount > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            Заявка создана, но {photoErrorCount}{" "}
            {photoErrorCount === 1 ? "фотография не загрузилась" : "фотографий не загрузились"}
            . Можно добавить их ниже.
          </div>
        ) : null}

        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">CRM / Заявка</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                #{request.request_number ?? "без номера"}
              </h1>
              <p className="mt-1 truncate text-sm text-slate-600">
                {request.location?.name ?? "Заведение не указано"}
                {request.location?.address
                  ? ` · ${request.location.address}`
                  : ""}
              </p>
            </div>

            <Link
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              href={cancelHref}
            >
              Отмена
            </Link>
          </div>
        </header>

        <RequestPhotosPanel
          canEdit
          initialPhotos={photos}
          requestId={id}
          title="Фотографии проблемы"
        />

        <RequestEditForm
          assignees={assignees}
          cancelHref={cancelHref}
          employees={employees}
          request={request}
          returnTo={returnToParam ? cancelHref : null}
        />

        <RequestCommentsFeed
          comments={comments}
          legacyExecutorComment={request.executor_comment}
          legacyManagerComment={request.manager_comment}
        />

        <RequestHistorySection
          initialHasMore={history.hasMore}
          initialItems={history.items}
          requestId={id}
        />
      </div>
    </main>
  );
}
