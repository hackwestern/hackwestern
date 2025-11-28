import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { z } from "zod";

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

/**
 * Validates an email address using Zod's email validation.
 * This ensures consistency with backend validation.
 */
export function isValidEmail(email: string): boolean {
  const emailSchema = z.string().email();
  return emailSchema.safeParse(email).success;
}
