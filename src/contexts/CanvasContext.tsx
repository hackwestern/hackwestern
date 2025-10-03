import React, { createContext, useContext, type ReactNode } from "react";
import { type MotionValue } from "framer-motion";
import type { CanvasSection } from "~/constants/canvas";

export interface Point {
  x: number;
  y: number;
}

export interface CanvasContextState {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  isResetting: boolean;
  maxZIndex: number;
  setMaxZIndex: (zIndex: number) => void;
  animationStage: number;
  nextTargetSection: CanvasSection | null; // predictive pre-render target
  setNextTargetSection: (section: CanvasSection | null) => void;
}

const defaultState = {
  x: undefined as unknown as MotionValue<number>,
  y: undefined as unknown as MotionValue<number>,
  scale: 1 as unknown as MotionValue<number>,
  isResetting: false,
  maxZIndex: 1,
  setMaxZIndex: () => {
    console.log("setMaxZIndex not set");
  },
  animationStage: 0,
  nextTargetSection: null,
  setNextTargetSection: () => {
    console.log("setNextTargetSection not set");
  },
};

export const CanvasContext = createContext<CanvasContextState>(defaultState);

export const useCanvasContext = () => useContext(CanvasContext);

interface CanvasProviderProps extends CanvasContextState {
  children: ReactNode;
}

export const CanvasProvider: React.FC<CanvasProviderProps> = React.memo(
  ({ children, ...value }) => (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  ),
);

CanvasProvider.displayName = "CanvasProvider";
