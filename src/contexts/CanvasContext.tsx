import React, {
  createContext,
  useContext,
  type ReactNode,
  useMemo,
} from "react";

export interface Point {
  x: number;
  y: number;
}

export interface CanvasContextState {
  zoom: number;
  panOffset: Point;
  isResetting: boolean;
  maxZIndex: number;
  setMaxZIndex: (zIndex: number) => void;
}

const defaultState: CanvasContextState = {
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  isResetting: false,
  maxZIndex: 1,
  setMaxZIndex: () => {
    console.log("setMaxZIndex not set");
  },
};
export const CanvasContext = createContext<CanvasContextState>(defaultState);

export const useCanvasContext = (): CanvasContextState => {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error("useCanvasContext must be used within a CanvasProvider");
  }
  return context;
};

interface CanvasProviderProps extends CanvasContextState {
  children: ReactNode;
}

export const CanvasProvider: React.FC<CanvasProviderProps> = ({
  children,
  zoom,
  panOffset,
  isResetting,
  maxZIndex,
  setMaxZIndex,
}) => {
  const contextValue = useMemo(() => {
    return { zoom, panOffset, isResetting, maxZIndex, setMaxZIndex };
  }, [zoom, panOffset, isResetting, maxZIndex, setMaxZIndex]);

  return (
    <CanvasContext.Provider value={contextValue}>
      {children}
    </CanvasContext.Provider>
  );
};
