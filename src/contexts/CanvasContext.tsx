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
}

const defaultState: CanvasContextState = {
  zoom: 1,
  panOffset: { x: 0, y: 0 },
};
export const CanvasContext = createContext<CanvasContextState>(defaultState);

export const useCanvasContext = (): CanvasContextState => {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error("useCanvasContext must be used within a CanvasProvider");
  }
  return context;
};

interface CanvasProviderProps {
  children: ReactNode;
  zoom: number;
  panOffset: Point;
}

export const CanvasProvider: React.FC<CanvasProviderProps> = ({
  children,
  zoom,
  panOffset,
}) => {
  const contextValue = useMemo(() => {
    return { zoom, panOffset };
  }, [zoom, panOffset]);

  return (
    <CanvasContext.Provider value={contextValue}>
      {children}
    </CanvasContext.Provider>
  );
};
