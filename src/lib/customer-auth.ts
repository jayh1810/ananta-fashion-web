"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "./api";
import { setAnalyticsUserId } from "./analytics";
import { useCart } from "./cart";

export type Impersonation = { adminName: string; expiresAt: number | null };

/** Admin "login as customer" tokens carry an `imp` claim (set by the API). */
export function readImpersonation(
  token: string | null | undefined,
): Impersonation | null {
  const part = token?.split(".")[1];
  if (!part) return null;
  try {
    const bytes = Uint8Array.from(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as {
      imp?: unknown;
      impName?: unknown;
      exp?: unknown;
    };
    if (!claims.imp) return null;
    return {
      adminName: String(claims.impName || "Admin"),
      expiresAt: typeof claims.exp === "number" ? claims.exp * 1000 : null,
    };
  } catch {
    return null;
  }
}

/**
 * The browser cart held the customer's cart during "login as customer"; drop it
 * so it doesn't follow the admin. Call after the token is cleared so CartSync
 * never pushes the emptied cart to the customer's account.
 */
function clearCartAfterImpersonation(wasImpersonating: boolean) {
  if (wasImpersonating) useCart.getState().clear();
}

export type CustomerAddress = {
  id: string;
  name: string;
  email?: string | null;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  label?: string | null;
  isDefault: boolean;
};

export type CustomerUser = {
  id: string;
  phone?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string;
  addresses?: CustomerAddress[];
};

type CustomerAuthState = {
  token: string | null;
  user: CustomerUser | null;
  loginOpen: boolean;
  loginNext: string | null;
  setSession: (token: string, user: CustomerUser) => void;
  logout: () => void;
  openLogin: (next?: string | null) => void;
  closeLogin: () => void;
  refreshMe: () => Promise<CustomerUser | null>;
  sendOtp: (phone: string) => Promise<{
    message?: string;
    staticMode?: boolean;
  }>;
  verifyOtp: (phone: string, otp: string) => Promise<CustomerUser>;
};

export const useCustomerAuth = create<CustomerAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loginOpen: false,
      loginNext: null,
      setSession: (token, user) => {
        set({ token, user });
        setAnalyticsUserId(user?.id);
      },
      logout: () => {
        const wasImpersonating = !!readImpersonation(get().token);
        set({ token: null, user: null });
        clearCartAfterImpersonation(wasImpersonating);
        setAnalyticsUserId(null);
      },
      openLogin: (next = null) =>
        set({ loginOpen: true, loginNext: next ?? null }),
      closeLogin: () => set({ loginOpen: false, loginNext: null }),
      refreshMe: async () => {
        const token = get().token;
        if (!token) return null;
        try {
          const user = await api<CustomerUser>("/auth/me", { token });
          set({ user });
          setAnalyticsUserId(user?.id);
          return user;
        } catch {
          set({ token: null, user: null });
          clearCartAfterImpersonation(!!readImpersonation(token));
          setAnalyticsUserId(null);
          return null;
        }
      },
      sendOtp: async (phone) => {
        return api("/auth/otp/send", {
          method: "POST",
          body: { phone },
        });
      },
      verifyOtp: async (phone, otp) => {
        const res = await api<{
          accessToken: string;
          user: CustomerUser;
        }>("/auth/otp/verify", {
          method: "POST",
          body: { phone, otp },
        });
        set({ token: res.accessToken, user: res.user });
        return res.user;
      },
    }),
    {
      name: "ananta-fashion-customer-auth",
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
);
