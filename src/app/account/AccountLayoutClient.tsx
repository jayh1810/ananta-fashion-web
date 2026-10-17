"use client";

import { usePathname } from "next/navigation";
import { AccountShell } from "@/components/AccountShell";

export function AccountLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";

  if (
    pathname.startsWith("/account/login") ||
    pathname.startsWith("/account/impersonate")
  ) {
    return <>{children}</>;
  }

  return <AccountShell requireAuth>{children}</AccountShell>;
}
