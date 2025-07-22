import React, { createContext, useContext, type ReactNode } from "react";
import { MotionValue } from "framer-motion";

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
}

const defaultState = {
  x: undefined as unknown as MotionValue<number>,
  y: undefined as unknown as MotionValue<number>,
  scale: 1 as unknown as MotionValue<number>,
  isResetting: false,
  maxZIndex: 1,
  setMaxZIndex: () => {},
};

export const CanvasContext = createContext<CanvasContextState>(defaultState);

export const useCanvasContext = () => useContext(CanvasContext);

interface CanvasProviderProps extends CanvasContextState {
  children: ReactNode;
}

export const CanvasProvider: React.FC<CanvasProviderProps> = ({
  children,
  ...value
}) => <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
