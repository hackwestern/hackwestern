"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PreloaderContextType {
  isPreloaderComplete: boolean;
  setPreloaderComplete: (complete: boolean) => void;
  showToolbar: boolean;
  setShowToolbar: (show: boolean) => void;
}

const PreloaderContext = createContext<PreloaderContextType | undefined>(undefined);

export function PreloaderProvider({ children }: { children: ReactNode }) {
  const [isPreloaderComplete, setIsPreloaderComplete] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);

  const setPreloaderComplete = (complete: boolean) => {
    console.log('🔧 DEBUG: PreloaderContext - setPreloaderComplete called with:', complete);
    setIsPreloaderComplete(complete);
  };

  const setShowToolbarWithLog = (show: boolean) => {
    console.log('🔧 DEBUG: PreloaderContext - setShowToolbar called with:', show);
    setShowToolbar(show);
  };

  return (
    <PreloaderContext.Provider value={{ 
      isPreloaderComplete, 
      setPreloaderComplete,
      showToolbar,
      setShowToolbar: setShowToolbarWithLog
    }}>
      {children}
    </PreloaderContext.Provider>
  );
}

export function usePreloader() {
  const context = useContext(PreloaderContext);
  if (context === undefined) {
    throw new Error('usePreloader must be used within a PreloaderProvider');
  }
  return context;
} 