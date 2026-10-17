"use client";

import { api, ApiError, type Product } from "@/lib/api";
import { useCustomerAuth } from "@/lib/customer-auth";

export type CopilotConfig = {
  enabled: boolean;
  botName: string;
  subtitle: string;
  launcherLabel: string;
  welcomeMessage: string;
  suggestions: string[];
  hideOnPaths: string[];
};

export type CopilotSource = { title: string; url: string };

export type CopilotOrder = {
  id: string;
  orderNumber: string;
  status: string;
  placedAt: string;
  total: number;
  itemCount: number;
  title: string;
  image: string | null;
  courier: string | null;
  awb: string | null;
  trackingUrl: string | null;
};

export type CopilotAction =
  | { type: "login"; label: string }
  | { type: "link"; label: string; href: string };

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: Product[];
  followUps?: string[];
  sources?: CopilotSource[];
  orders?: CopilotOrder[];
  actions?: CopilotAction[];
  /** Question to resend automatically once the shopper logs in from a login action. */
  retryOnLogin?: string;
  feedback?: 1 | -1 | null;
  error?: boolean;
};

type ChatResponse = {
  sessionId: string;
  userMessageId: string;
  message: {
    id: string;
    content: string;
    products: Product[];
    followUps: string[];
    sources: CopilotSource[];
    orders?: CopilotOrder[];
    actions?: CopilotAction[];
  };
};

const VISITOR_KEY = "aa:copilot:vid";
const STATE_KEY = "aa:copilot:v1";
const MAX_STORED = 40;

let configPromise: Promise<CopilotConfig | null> | null = null;

export function loadCopilotConfig() {
  if (!configPromise) {
    configPromise = api<CopilotConfig>("/copilot/config").catch(() => {
      configPromise = null;
      return null;
    });
  }
  return configPromise;
}

export function copilotVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

export type StoredChat = { sessionId?: string; messages: CopilotMessage[] };

export function readStoredChat(): StoredChat {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw) as StoredChat;
    return {
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return { messages: [] };
  }
}

export function writeStoredChat(chat: StoredChat) {
  try {
    sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({ ...chat, messages: chat.messages.slice(-MAX_STORED) }),
    );
  } catch {
    /* quota — chat still works in memory */
  }
}

export function clearStoredChat() {
  try {
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
}

export async function sendCopilotMessage(input: {
  message: string;
  sessionId?: string;
  pagePath?: string;
}): Promise<ChatResponse> {
  return api<ChatResponse>("/copilot/chat", {
    method: "POST",
    token: useCustomerAuth.getState().token || undefined,
    body: {
      message: input.message,
      sessionId: input.sessionId,
      pagePath: input.pagePath,
      visitorId: copilotVisitorId(),
    },
  });
}

export function openCustomerLogin() {
  useCustomerAuth.getState().openLogin();
}

export function sendCopilotFeedback(messageId: string, value: 1 | -1 | 0) {
  return api("/copilot/feedback", {
    method: "POST",
    token: useCustomerAuth.getState().token || undefined,
    body: { messageId, value, visitorId: copilotVisitorId() },
  }).catch(() => undefined);
}

const RESTORED_KEY = "aa:copilot:restored";

/** On logout, wipe this tab's chat so the next person on a shared device can't read it. */
export function onCopilotLogout(cb?: () => void) {
  return useCustomerAuth.subscribe((state, prev) => {
    if (!prev.token || state.token) return;
    clearStoredChat();
    try {
      sessionStorage.removeItem(RESTORED_KEY);
    } catch {
      /* ignore */
    }
    cb?.();
  });
}

/**
 * Logged-in shopper with an empty chat: bring back their latest conversation (once per
 * browser session, so "New chat" is respected).
 */
export async function loadCopilotHistory(): Promise<StoredChat | null> {
  const token = useCustomerAuth.getState().token;
  if (!token) return null;
  try {
    if (sessionStorage.getItem(RESTORED_KEY)) return null;
    sessionStorage.setItem(RESTORED_KEY, "1");
  } catch {
    return null;
  }
  try {
    const res = await api<{ sessionId: string | null; messages: CopilotMessage[] }>(
      "/copilot/history",
      { token },
    );
    if (!res.sessionId || !res.messages.length) return null;
    return { sessionId: res.sessionId, messages: res.messages };
  } catch {
    return null;
  }
}

export function copilotErrorMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 429) return e.message;
    if (e.status === 503) return "Our AI guide is unavailable right now 🙏 Please try again later or chat with our team on WhatsApp.";
  }
  return "Oops, I couldn't connect just now. Please check your internet and try again.";
}
