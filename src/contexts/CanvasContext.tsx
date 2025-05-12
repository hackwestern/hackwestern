// src/contexts/CanvasContext.tsx (Create this file if it doesn't exist)

import React, { createContext, useContext, type ReactNode, useMemo } from 'react';

// Define the shape of a point
export interface Point {
  x: number;
  y: number;
}

// Define the shape of the context state
export interface CanvasContextState {
  zoom: number;
  panOffset: Point;
  // We could add functions here to update zoom/pan from consumers,
  // but for now, we'll assume the main Canvas component manages and provides these values.
}

// Create the context with a default value
// The default value is mostly for type inference and for cases where a consumer
// might be rendered outside a provider (though our hook will prevent that).
const defaultState: CanvasContextState = {
  zoom: 1,
  panOffset: { x: 0, y: 0 },
};
export const CanvasContext = createContext<CanvasContextState>(defaultState);

// Custom hook to use the CanvasContext
// This provides a convenient way to access the context and includes an error
// check to ensure the hook is used within a provider.
export const useCanvasContext = (): CanvasContextState => {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    // This error is helpful for developers to ensure proper setup
    throw new Error('useCanvasContext must be used within a CanvasProvider');
  }
  return context;
};

// Props for the CanvasProvider component
interface CanvasProviderProps {
  children: ReactNode;
  zoom: number;       // The current zoom level from the parent (Canvas component)
  panOffset: Point; // The current pan offset from the parent
}

// The provider component
// It takes zoom and panOffset as props from its parent (your main Canvas component)
// and makes them available to all descendant components via the context.
export const CanvasProvider: React.FC<CanvasProviderProps> = ({
  children,
  zoom,
  panOffset,
}) => {
  // useMemo is important here to prevent unnecessary re-renders of consumers
  // if the provider itself re-renders but zoom and panOffset haven't actually changed.
  // The context value object should only be a new object if its contents change.
  const contextValue = useMemo(() => {
    return { zoom, panOffset };
  }, [zoom, panOffset]);

  return (
    <CanvasContext.Provider value={contextValue}>
      {children}
    </CanvasContext.Provider>
  );
};