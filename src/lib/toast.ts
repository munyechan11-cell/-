export type ToastType = "success" | "error" | "info";

export function showToast(message: string, type: ToastType = "info") {
  window.dispatchEvent(new CustomEvent("gyeol:toast", { detail: { message, type } }));
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(type === "error" ? [50, 50, 50] : 80);
  }
}
