export interface ToastLike {
  type: "success" | "error" | "info";
  message: string;
}

export function hasDuplicateToast(existingToasts: ToastLike[], nextToast: ToastLike): boolean {
  return existingToasts.some(
    (toast) => toast.type === nextToast.type && toast.message === nextToast.message,
  );
}
