import { ApiError, getApiUrl } from "@/lib/api";

export type TicketAttachment = {
  url: string;
  kind: "video" | "image";
  name: string;
  size: number;
  sig?: string;
};

export type TicketSummary = {
  id: string;
  ticketNumber: string;
  category: string;
  categoryLabel: string;
  subject: string;
  status: string;
  statusLabel: string;
  customerUnread: boolean;
  lastMessageAt: string;
  createdAt: string;
  order: { id: string; orderNumber: string };
};

export type TicketDetail = TicketSummary & {
  preferredResolution?: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  items?: { orderItemId: string; productTitle: string; variantTitle?: string; quantity: number }[] | null;
  attachments: TicketAttachment[];
  resolvedAt?: string | null;
  canReply: boolean;
  messages: {
    id: string;
    authorType: "CUSTOMER" | "ADMIN" | "SYSTEM";
    authorName?: string | null;
    body: string;
    attachments?: TicketAttachment[] | null;
    createdAt: string;
  }[];
};

export const TICKET_CATEGORIES = [
  { id: "DAMAGED", label: "Damaged product", hint: "Broken, cracked or damaged in transit", proof: true },
  { id: "WRONG_ITEM", label: "Wrong item", hint: "Received a different product or size", proof: true },
  { id: "MISSING_ITEM", label: "Missing item", hint: "Something was missing from the box", proof: true },
  { id: "QUALITY", label: "Quality issue", hint: "Defect or not as described", proof: true },
  { id: "RETURN", label: "Return item", hint: "Send the product back for a refund", proof: true },
  { id: "REPLACEMENT", label: "Replacement", hint: "Get the same product replaced", proof: true },
  { id: "QUERY", label: "General query", hint: "Usage, energisation or anything else", proof: false },
] as const;

export const RESOLUTION_OPTIONS = [
  { id: "REPLACEMENT", label: "Replacement" },
  { id: "REFUND", label: "Refund" },
  { id: "EXCHANGE", label: "Exchange" },
  { id: "INFO", label: "Just need help" },
] as const;

export const IMAGE_MAX_MB = 10;
export const VIDEO_MAX_MB = 80;

export function ticketStatusTone(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "IN_PROGRESS":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "WAITING_CUSTOMER":
      return "bg-orange-50 text-orange-800 border-orange-200";
    case "RESOLVED":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "REJECTED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-stone-100 text-stone-600 border-stone-200";
  }
}

export function formatFileSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileKind(file: File): "video" | "image" | null {
  if (file.type.startsWith("video/") || /\.(mp4|mov|webm|3gp|mkv|m4v)$/i.test(file.name)) return "video";
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return "image";
  return null;
}

/** Upload one proof file with progress (0–100). Resolves to a signed attachment. */
export function uploadTicketProof(
  file: File,
  token: string,
  onProgress?: (pct: number) => void,
): { promise: Promise<TicketAttachment>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<TicketAttachment>((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    xhr.open("POST", `${getApiUrl()}/support-tickets/uploads`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as unknown as TicketAttachment);
        return;
      }
      const msg =
        xhr.status === 413
          ? `File is too large (videos up to ${VIDEO_MAX_MB} MB, photos up to ${IMAGE_MAX_MB} MB)`
          : typeof data.message === "string"
            ? data.message
            : Array.isArray(data.message)
              ? data.message.join(", ")
              : "Upload failed. Please try again.";
      reject(new ApiError(msg, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Network error while uploading. Please retry.", 0));
    xhr.onabort = () => reject(new ApiError("Upload cancelled", 0));
    xhr.send(fd);
  });
  return { promise, abort: () => xhr.abort() };
}
