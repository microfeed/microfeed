import {toast} from "sonner";

type ToastType = "error" | "info" | "success" | "warning";

const DEFAULT_TOAST_DURATION: Record<ToastType, number> = {
  error: 6000,
  info: 4000,
  success: 3000,
  warning: 5000,
};

export function showToast(message: string, type: ToastType, duration?: number) {
  toast[type](message, {duration: duration ?? DEFAULT_TOAST_DURATION[type]});
}
