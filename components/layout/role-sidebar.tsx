import { getCurrentUser } from "@/lib/auth/current-user";
import { canUseManagerArea, type AppRole } from "@/lib/auth/permissions";
import {
  RoleSidebarClient,
  type SidebarItem,
} from "@/components/layout/role-sidebar-client";

const managerItems: SidebarItem[] = [
  { href: "/", label: "Главная", icon: "⌂" },
  { href: "/requests", label: "Заявки", icon: "□" },
  { href: "/requests/trash", label: "Корзина", icon: "⌫" },
  { href: "/outsourcing", label: "Аутсорс", icon: "⇄" },
  { href: "/today", label: "План на сегодня", icon: "◷" },
  { href: "/mechanics", label: "Механики", icon: "◉" },
  { href: "/locations", label: "Заведения", icon: "⌖" },
  // Карта и Настройки временно скрыты из меню до готовности разделов.
];

const mechanicItems: SidebarItem[] = [
  { href: "/work/today", label: "Сегодня", icon: "◷" },
  { href: "/work/requests", label: "Мои задачи", icon: "□" },
  { href: "/work/locations", label: "Заведения", icon: "⌖" },
  { href: "/work/profile", label: "Профиль", icon: "◉" },
];

export async function RoleSidebar() {
  let context;

  try {
    context = await getCurrentUser();
  } catch {
    return null;
  }

  if (!context.authUser || !context.profile || !context.role) {
    return null;
  }

  const role = context.role;
  const items = canUseManagerArea(role) ? managerItems : mechanicItems;

  return (
    <RoleSidebarClient
      employeeName={context.employee?.name}
      items={items}
      role={role as AppRole}
      userName={context.profile.full_name}
    />
  );
}
