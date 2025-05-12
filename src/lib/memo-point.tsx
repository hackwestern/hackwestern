import { type Point } from "framer-motion";
import { useMemo } from "react";

export const useMemoPoint = (x: number, y: number): Point => {
  return useMemo(() => ({ x, y }), [x, y]);
};