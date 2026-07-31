import { useState, useEffect } from "react";
import { isIOS, isMobile, prefersReducedMotion } from "~/utils/performance";
import useWindowDimensions from "./useWindowDimensions";

export type PerformanceMode = "high" | "medium" | "low";

export interface PerformanceConfig {
  mode: PerformanceMode;
  isIOS: boolean;
  isMobile: boolean;
  prefersReducedMotion: boolean;
  enableComplexShadows: boolean;
}

/**
 * Hook to determine optimal performance settings based on device capabilities
 * Does not disable any animations - only provides info for optimization
 */
export const usePerformanceMode = (): PerformanceConfig => {
  const [config, setConfig] = useState<PerformanceConfig>({
    mode: "high",
    isIOS: false,
    isMobile: false,
    prefersReducedMotion: false,
    enableComplexShadows: true,
  });

  const { width } = useWindowDimensions();

  useEffect(() => {
    const isIOSDevice = isIOS();
    const isMobileDevice = isMobile();
    const reducedMotion = prefersReducedMotion();

    let mode: PerformanceMode = "high";

    // Determine performance mode
    if (isIOSDevice || reducedMotion || width < 768) {
      mode = "low";
    } else if (isMobileDevice || width < 1024) {
      mode = "medium";
    }

    setConfig({
      mode,
      isIOS: isIOSDevice,
      isMobile: isMobileDevice,
      prefersReducedMotion: reducedMotion,
      // Use simpler shadows on iOS for better performance
      enableComplexShadows: mode !== "low",
    });
  }, []);

  return config;
};
