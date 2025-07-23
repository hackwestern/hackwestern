import { type Point } from "framer-motion";
import { useMemo } from "react";

export const useMemoPoint = (x: number, y: number): Point => {
  return useMemo(() => ({ x, y }), [x, y]);
};

export interface MinimalPointerInput {
  clientX: number;
  clientY: number;
}

export const getDistance = (
  p1: MinimalPointerInput,
  p2: MinimalPointerInput,
) => {
  const dx = p1.clientX - p2.clientX;
  const dy = p1.clientY - p2.clientY;
  return Math.sqrt(dx ** 2 + dy ** 2);
};

export const getMidpoint = (
  p1: MinimalPointerInput,
  p2: MinimalPointerInput,
): Point => {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2,
  };
};
