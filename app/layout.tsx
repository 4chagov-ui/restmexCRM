import type { Metadata } from "next";
import { RoleSidebar } from "@/components/layout/role-sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "RestMex IT",
  description: "RestMex IT MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <div className="min-h-screen overflow-x-hidden lg:flex">
          <RoleSidebar />
          <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
        </div>
      </body>
    </html>
  );
}
