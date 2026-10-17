/** Shared order status labels for storefront + admin UX */

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Payment in progress",
  PAID: "Paid · Awaiting approval",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RTO: "RTO",
  RTO_DELIVERED: "RTO Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  AUTHORIZED: "Authorized",
  CAPTURED: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  ONLINE: "Online (Razorpay)",
  COD: "Cash on Delivery",
  PARTIAL_COD: "Partial COD",
};

export function orderStatusLabel(status?: string | null) {
  if (!status) return "Unknown";
  return ORDER_STATUS_LABEL[status] || status;
}

export function paymentStatusLabel(status?: string | null) {
  if (!status) return "Unknown";
  return PAYMENT_STATUS_LABEL[status] || status;
}

export function paymentMethodLabel(method?: string | null) {
  if (!method) return "—";
  return PAYMENT_METHOD_LABEL[method] || method;
}

/** Display order number with a leading # (e.g. #AA6354250474). */
export function formatOrderNumber(orderNumber?: string | null) {
  const n = String(orderNumber || "").trim();
  if (!n) return "—";
  return n.startsWith("#") ? n : `#${n}`;
}

/** Strip # / spaces so track/lookup APIs get the raw order number. */
export function parseOrderNumberInput(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/^#+/, "")
    .trim();
}

/**
 * Customer-facing status history notes — hide admin/Shiprocket internals.
 */
export function customerHistoryNote(note?: string | null): string | null {
  if (!note) return null;
  const n = String(note).trim();
  if (!n) return null;
  const lower = n.toLowerCase();

  if (
    lower.includes("shiprocket") ||
    lower.includes("order_id=") ||
    lower.includes("shipment_id=") ||
    lower.includes("awb")
  ) {
    if (lower.includes("fail") || lower.includes("error")) {
      return "We are updating your shipment details. Please check again shortly.";
    }
    if (lower.includes("push") || lower.includes("create")) {
      return "Your order has been packed and handed to the courier.";
    }
    if (lower.includes("sync") || lower.includes("track") || lower.includes("deliver")) {
      return "Shipment status updated.";
    }
    return "Shipment update recorded.";
  }

  if (lower.includes("approved by admin")) return "Your order was approved.";
  if (lower.includes("created by admin")) return "Order placed successfully.";
  if (lower.includes("rejected") || lower.includes("cancelled by")) {
    return "This order was cancelled.";
  }

  return n;
}

/** Hide internal courier platform names from customers. */
export function displayCourierName(name?: string | null) {
  const c = String(name || "").trim();
  if (!c) return "Courier partner";
  if (/shiprocket/i.test(c)) return "Courier partner";
  return c;
}

/** Tailwind-ish class hints for badges */
export function orderStatusTone(status?: string | null): string {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PAID":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "PROCESSING":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "SHIPPED":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "DELIVERED":
      return "bg-green-50 text-green-700 border-green-200";
    case "RTO":
    case "RTO_DELIVERED":
      return "bg-rose-50 text-rose-800 border-rose-200";
    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-200";
    case "RETURNED":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "PENDING":
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

/** Small colored dot to pair with the label */
export function orderStatusDot(status?: string | null): string {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-500";
    case "PAID":
      return "bg-amber-500";
    case "PROCESSING":
      return "bg-sky-500";
    case "SHIPPED":
      return "bg-indigo-500";
    case "DELIVERED":
      return "bg-green-500";
    case "RTO":
    case "RTO_DELIVERED":
      return "bg-rose-500";
    case "CANCELLED":
      return "bg-red-500";
    case "RETURNED":
      return "bg-orange-500";
    case "PENDING":
    default:
      return "bg-slate-400";
  }
}

export function paymentStatusTone(status?: string | null): string {
  switch (status) {
    case "CAPTURED":
      return "bg-green-50 text-green-700 border-green-200";
    case "AUTHORIZED":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "REFUNDED":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "FAILED":
      return "bg-red-50 text-red-700 border-red-200";
    case "PENDING":
    default:
      return "bg-amber-50 text-amber-800 border-amber-200";
  }
}

export const ORDER_FLOW_STEPS = [
  "PAID",
  "APPROVED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
] as const;

export function orderTimelineStepIndex(status?: string | null): number {
  if (!status) return -1;
  if (
    status === "CANCELLED" ||
    status === "RETURNED" ||
    status === "RTO" ||
    status === "RTO_DELIVERED"
  ) {
    return -1;
  }
  if (status === "PENDING") return -1;
  const i = ORDER_FLOW_STEPS.indexOf(status as (typeof ORDER_FLOW_STEPS)[number]);
  return i;
}
