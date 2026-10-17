import { BRAND } from "@/lib/api";

/** Load Razorpay checkout.js once. */
export function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export function openRazorpayCheckout(opts: {
  keyId: string;
  amount: number;
  currency?: string;
  orderId: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (res: RazorpaySuccessResponse) => void;
  onDismiss?: () => void;
}) {
  const Razorpay = (window as any).Razorpay;
  if (!Razorpay) throw new Error("Razorpay SDK failed to load");

  const rzp = new Razorpay({
    key: opts.keyId,
    amount: opts.amount,
    currency: opts.currency || "INR",
    name: opts.name || BRAND,
    description: opts.description || "Order payment",
    order_id: opts.orderId,
    prefill: opts.prefill || {},
    theme: { color: "#111111" },
    handler: (response: RazorpaySuccessResponse) => {
      opts.onSuccess(response);
    },
    modal: {
      ondismiss: () => opts.onDismiss?.(),
    },
  });
  rzp.open();
}
