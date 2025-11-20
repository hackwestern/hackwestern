/**
 * Performance optimization utilities for cross-platform compatibility
 * Particularly focused on iOS Safari performance issues
 */

// Detect if the device is iOS
export const isIOS = (): boolean => {
  if (typeof window === "undefined") return false;

  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

// Detect if the device is a mobile device
export const isMobile = (): boolean => {
  if (typeof window === "undefined") return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};

// Check if user prefers reduced motion
export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Get optimized will-change value based on state
export const getWillChange = (
  isAnimating: boolean,
  properties: string[] = ["transform"],
): string => {
  // Only apply will-change when actually animating
  // Leaving it on causes memory issues on iOS
  return isAnimating ? properties.join(", ") : "auto";
};
