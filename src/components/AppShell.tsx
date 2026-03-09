"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import CommandBar from "./CommandBar";

const BARE_ROUTES = ["/login", "/shared"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBare = BARE_ROUTES.some((r) => pathname.startsWith(r));

  if (isBare) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <main className="ml-60 min-h-screen transition-all duration-200">
        {children}
      </main>
      <CommandBar />
    </>
  );
}
