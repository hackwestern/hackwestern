import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debounce<T extends (...args: unknown[]) => void>(
  cb: T,
  wait = 20,
) {
  let h: number | NodeJS.Timeout = 0;
  const callable = (...args: unknown[]) => {
    clearTimeout(h);
    h = setTimeout(() => cb(...args), wait);
  };
  return callable as T;
}
