"use client";

import { useEffect } from "react";
import { readImpersonation, useCustomerAuth } from "@/lib/customer-auth";

/**
 * Admin "Login as customer" looks exactly like the customer's own session; this
 * only signs it out when the short-lived token expires. Renders nothing.
 */
export function ImpersonationExpiry() {
  const token = useCustomerAuth((s) => s.token);
  const logout = useCustomerAuth((s) => s.logout);
  const expiresAt = readImpersonation(token)?.expiresAt ?? null;

  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setTimeout(logout, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(id);
  }, [expiresAt, logout]);

  return null;
}
