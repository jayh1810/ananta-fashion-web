import { getApiUrl } from "@/lib/api";

type PostOffice = {
  Name?: string | null;
  Block?: string | null;
  Division?: string | null;
  District?: string | null;
  State?: string | null;
};

export type PincodeLookupResult = {
  city: string;
  state: string;
  pincode?: string;
  serviceable?: boolean | null;
  etd?: string | null;
  etdText?: string | null;
  etdDate?: string | null;
  etdTime?: string | null;
  estimatedDays?: number | null;
  courierName?: string | null;
  freightCharge?: number | null;
  suggestedCourier?: {
    courierName: string;
    etd?: string | null;
    etdText?: string | null;
    etdDate?: string | null;
    etdTime?: string | null;
    rate?: number | null;
  } | null;
  couriers?: Array<{
    courierName: string;
    etd?: string | null;
    etdText?: string | null;
    etdDate?: string | null;
    etdTime?: string | null;
    rate?: number | null;
    cod?: boolean;
    recommended?: boolean;
  }>;
  serviceabilityNote?: string | null;
  source?: string;
};

function cleanCityName(raw: string | null | undefined) {
  return String(raw || "")
    .replace(/\s+(HO|S\.?O\.?|B\.?O\.?|GPO|Head Office|Sub Office)$/i, "")
    .trim();
}

function isUsablePlace(value: string | null | undefined) {
  const v = cleanCityName(value);
  return Boolean(v) && v.toUpperCase() !== "NA";
}

/**
 * Resolve town/city from India Post offices.
 * Prefer Block/Division (e.g. Gondal) over District (Rajkot).
 * Prefer District (e.g. Mumbai) over PO Name (Kalbadevi) when Block is missing.
 */
export function resolveCityFromOffices(offices: PostOffice[]) {
  if (!offices.length) return "";

  const mainTown = offices.find(
    (o) =>
      isUsablePlace(o.Name) &&
      isUsablePlace(o.Block) &&
      cleanCityName(o.Name).toLowerCase() ===
        cleanCityName(o.Block).toLowerCase(),
  );
  if (mainTown) return cleanCityName(mainTown.Name);

  const withBlock = offices.find((o) => isUsablePlace(o.Block));
  if (withBlock) return cleanCityName(withBlock.Block);

  const withDivision = offices.find((o) => isUsablePlace(o.Division));
  if (withDivision) return cleanCityName(withDivision.Division);

  const withDistrict = offices.find((o) => isUsablePlace(o.District));
  if (withDistrict) return cleanCityName(withDistrict.District);

  const withName = offices.find((o) => isUsablePlace(o.Name));
  if (withName) return cleanCityName(withName.Name);

  return cleanCityName(offices[0]?.District);
}

async function lookupIndiaPost(pin: string): Promise<PincodeLookupResult> {
  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
  if (!res.ok) throw new Error("Pincode lookup failed");
  const data = await res.json();
  const offices = data?.[0]?.PostOffice as PostOffice[] | null | undefined;
  if (!Array.isArray(offices) || !offices.length) {
    throw new Error("Invalid pincode");
  }
  const city = resolveCityFromOffices(offices);
  const state = String(offices[0]?.State || "").trim();
  if (!city || !state) throw new Error("Invalid pincode");
  return {
    city: toTitleCase(city),
    state: toTitleCase(state),
    pincode: pin,
    source: "indiapost",
  };
}

function toTitleCase(value: string): string {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/(^|[\s\-'.(/])([a-z])/g, (_, p1: string, p2: string) =>
      `${p1}${p2.toUpperCase()}`,
    );
}

export { toTitleCase };

async function readApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const msg =
      (typeof data?.message === "string" && data.message) ||
      (Array.isArray(data?.message) && data.message[0]) ||
      (typeof data?.error === "string" && data.error) ||
      "";
    if (msg) return String(msg);
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * Prefer Shiprocket (via our API).
 * On explicit not-found / 4xx from API, throw — do not hide the error.
 * India Post is only used if the API is unreachable or returns a server error.
 */
export async function lookupPincode(
  pin: string,
  opts?: { weightKg?: number; cod?: boolean },
): Promise<PincodeLookupResult> {
  const cleaned = String(pin || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(cleaned)) throw new Error("Enter a valid 6-digit pincode");

  const weight =
    opts?.weightKg != null && opts.weightKg > 0
      ? opts.weightKg
      : 0.5;
  const cod = opts?.cod ? "1" : "0";

  let allowIndiaPostFallback = false;

  try {
    const res = await fetch(
      `${getApiUrl()}/shipping/pincode/${cleaned}?cod=${cod}&weight=${weight}`,
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.city && data?.state) {
        return {
          city: toTitleCase(data.city),
          state: toTitleCase(data.state),
          pincode: cleaned,
          serviceable: data.serviceable ?? null,
          etd: data.etd ?? null,
          etdText: data.etdText ?? null,
          etdDate: data.etdDate ?? null,
          etdTime: data.etdTime ?? null,
          estimatedDays:
            typeof data.estimatedDays === "number" ? data.estimatedDays : null,
          courierName:
            data.courierName ||
            data.suggestedCourier?.courierName ||
            null,
          freightCharge:
            typeof data.freightCharge === "number" ? data.freightCharge : null,
          suggestedCourier: data.suggestedCourier ?? null,
          couriers: Array.isArray(data.couriers) ? data.couriers : undefined,
          serviceabilityNote: data.serviceabilityNote ?? null,
          source: data.source || "shiprocket",
        };
      }
      throw new Error("Could not find city/state for this pincode");
    }

    if (res.status >= 400 && res.status < 500) {
      const apiMsg = await readApiError(res);
      throw new Error(
        apiMsg || "Invalid or unsupported pincode. Please check and try again.",
      );
    }
    allowIndiaPostFallback = true;
  } catch (e) {
    if (e instanceof TypeError) {
      allowIndiaPostFallback = true;
    } else if (!allowIndiaPostFallback) {
      throw e instanceof Error
        ? e
        : new Error("Could not find city/state for this pincode");
    }
  }

  if (!allowIndiaPostFallback) {
    throw new Error(
      "Invalid or unsupported pincode. Please check and try again.",
    );
  }

  try {
    return await lookupIndiaPost(cleaned);
  } catch {
    throw new Error(
      "Invalid or unsupported pincode. Please check and try again.",
    );
  }
}

/** Full delivery check for PDP (includes ETD when Shiprocket is configured). */
export async function checkDeliveryPincode(
  pin: string,
  opts?: { weightKg?: number; quantity?: number },
): Promise<PincodeLookupResult> {
  const qty = Math.max(1, Math.round(opts?.quantity || 1));
  const unit = opts?.weightKg != null && opts.weightKg > 0 ? opts.weightKg : 0.5;
  return lookupPincode(pin, { weightKg: unit * qty, cod: false });
}
