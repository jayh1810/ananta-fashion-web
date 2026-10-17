export const WALLET_REFRESH_EVENT = "ananta-fashion-wallet-refresh";

export function notifyWalletRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WALLET_REFRESH_EVENT));
}
