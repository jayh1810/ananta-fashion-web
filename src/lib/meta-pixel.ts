declare global {
  interface Window {
    fbq: (
      action: string,
      eventName: string,
      params?: Record<string, unknown>,
      extra?: Record<string, unknown>,
    ) => void;
    _fbq: unknown;
  }
}

export function pixelId(): string {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID || "1413515093952815";
}

function fbq(
  action: string,
  eventName: string,
  params?: Record<string, unknown>,
  extra?: Record<string, unknown>,
) {
  if (typeof window === "undefined" || !window.fbq) return;
  if (extra) {
    window.fbq(action, eventName, params, extra);
  } else if (params) {
    window.fbq(action, eventName, params);
  } else {
    window.fbq(action, eventName);
  }
}

export function pixelPageView() {
  fbq("track", "PageView");
}

export function trackViewContent(params: {
  content_ids: string[];
  content_name: string;
  content_type?: string;
  value?: number;
  currency?: string;
}) {
  fbq("track", "ViewContent", {
    content_ids: params.content_ids,
    content_name: params.content_name,
    content_type: params.content_type ?? "product",
    value: params.value,
    currency: params.currency ?? "INR",
  });
}

export function trackAddToCart(params: {
  content_ids: string[];
  content_name: string;
  value: number;
  currency?: string;
  num_items?: number;
  contents?: { id: string; quantity: number }[];
}) {
  fbq("track", "AddToCart", {
    content_ids: params.content_ids,
    content_name: params.content_name,
    content_type: "product",
    value: params.value,
    currency: params.currency ?? "INR",
    num_items: params.num_items ?? 1,
    contents: params.contents,
  });
}

export function trackInitiateCheckout(params: {
  value: number;
  num_items: number;
  currency?: string;
  content_ids?: string[];
  contents?: { id: string; quantity: number }[];
}) {
  fbq("track", "InitiateCheckout", {
    value: params.value,
    num_items: params.num_items,
    currency: params.currency ?? "INR",
    content_ids: params.content_ids,
    contents: params.contents,
  });
}

export function trackSearch(params: { search_string: string }) {
  fbq("track", "Search", {
    search_string: params.search_string,
  });
}

export function trackLead() {
  fbq("track", "Lead");
}

export function trackContact() {
  fbq("track", "Contact");
}

export function trackPurchase(params: {
  value: number;
  currency?: string;
  orderId?: string;
  /** kept for backward compat — same as orderId */
  order_id?: string;
  num_items?: number;
  content_ids?: string[];
  contents?: { id: string; quantity: number }[];
  eventID?: string;
}) {
  const resolvedOrderId = params.orderId ?? params.order_id;
  fbq(
    "track",
    "Purchase",
    {
      value: params.value,
      currency: params.currency ?? "INR",
      order_id: resolvedOrderId,
      num_items: params.num_items,
      content_ids: params.content_ids,
      contents: params.contents,
    },
    params.eventID ? { eventID: params.eventID } : undefined,
  );
}
