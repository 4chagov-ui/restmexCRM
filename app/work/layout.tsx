import { requireMechanicUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function WorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMechanicUser();

  return children;
}
