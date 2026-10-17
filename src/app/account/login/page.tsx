"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginModal } from "@/components/LoginModal";
import { useCustomerAuth } from "@/lib/customer-auth";

function LoginPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const { token } = useCustomerAuth();

  useEffect(() => {
    if (token) {
      router.replace(next === "checkout" ? "/" : next);
    }
  }, [token, next, router]);

  if (token) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-sm text-[#666]">
        Redirecting…
      </div>
    );
  }

  return <LoginModal embedded nextPath={next} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] grid place-items-center text-sm text-[#666]">
          Loading…
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
