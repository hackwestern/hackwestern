import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useImperativeHandle,
} from "react";
import type { Point, Stroke, CanvasPaths } from "~/types/canvas";

// Define the canvas data structure used in callbacks
export type CanvasData = {
  paths: CanvasPaths; // array of strokes composed of points
  timestamp: number;
  version: string;
};

// Simple canvas component for the form
export const SimpleCanvas = React.forwardRef<
  {
    clear: () => void;
    isEmpty: () => boolean;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
  },
  {
    onDrawingChange?: (isEmpty: boolean, data?: CanvasData) => void;
    onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
    onFormFieldChange?: (data: CanvasData) => void;
    onCanvasEmptyChange?: (isEmpty: boolean) => void;
    initialData?: CanvasData | null;
  }
>(({ onDrawingChange, onHistoryChange, onFormFieldChange, onCanvasEmptyChange, initialData }, ref) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<CanvasPaths>([]);
  const [currentPath, setCurrentPath] = useState<Stroke>([]);

  // History for undo/redo
  const [history, setHistory] = useState<CanvasPaths[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const initializedRef = useRef(false);

  // Debounce timer for saving strokes
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const SAVE_DEBOUNCE_MS = 300;

  // Track the last local modification timestamp to prioritize local data
  const lastLocalModificationRef = useRef<number>(0);
  const hasLocalChangesRef = useRef<boolean>(false);

  // Helper to save current state to history
  // Only call this for discrete events: stroke completion, clear (NOT for undo/redo)
  const saveToHistory = useCallback(
    (newPaths: CanvasPaths) => {
      // Cheap equality: compare lengths and first/last points of outer/inner arrays
      const isLikelySame = (a?: CanvasPaths, b?: CanvasPaths) => {
        if (!a || !b) return false;
        if (a.length !== b.length) return false;
        if (a.length === 0) return true;

        const aFirst: Stroke | undefined = a[0];
        const bFirst: Stroke | undefined = b[0];
        const aLast: Stroke | undefined = a[a.length - 1];
        const bLast: Stroke | undefined = b[b.length - 1];

        if (!aFirst || !bFirst || !aLast || !bLast) return false;

        // Compare first/last path lengths quickly
        if (aFirst.length !== bFirst.length || aLast.length !== bLast.length)
          return false;

        // If any path is empty, fall back to length-based check
        if (aFirst.length === 0 || aLast.length === 0) return true;

        const aFirstPoint = aFirst[0];
        const bFirstPoint = bFirst[0];
        const aLastPoint = aLast[aLast.length - 1];
        const bLastPoint = bLast[bLast.length - 1];

        if (!aFirstPoint || !bFirstPoint || !aLastPoint || !bLastPoint)
          return false;

        return (
          aFirstPoint[0] === bFirstPoint[0] &&
          aFirstPoint[1] === bFirstPoint[1] &&
          aLastPoint[0] === bLastPoint[0] &&
          aLastPoint[1] === bLastPoint[1]
        );
      };
      setHistoryIndex((currentIndex) => {
        setHistory((prevHistory) => {
          // Truncate any "future" history if we're not at the latest state
          const truncatedHistory =
            currentIndex === -1 ? [] : prevHistory.slice(0, currentIndex + 1);

          // Check if the new state is identical to the last state (deduplication)
          const lastState = truncatedHistory[truncatedHistory.length - 1];
          if (lastState && isLikelySame(lastState, newPaths)) {
            return prevHistory;
          }

          // Add new state to history
          const newHistory = [...truncatedHistory, newPaths];

          // Notify parent of history changes
          const newIndex = newHistory.length - 1;
          const newCanUndo = newIndex > 0;
          const newCanRedo = false; // We're at the latest state
          onHistoryChange?.(newCanUndo, newCanRedo);
          return newHistory;
        });

        // Return new index (pointing to the newly added state)
        const newIndex = currentIndex + 1;
        return newIndex;
      });
    },
    [onHistoryChange, historyIndex, history],
  );

  // Load initial data when component mounts or initialData changes
  // Only update if server data is newer than local data AND user isn't actively drawing
  useEffect(() => {
    if (initialData?.paths && Array.isArray(initialData.paths)) {
      const serverTimestamp = initialData.timestamp || 0;
      const hasNewerServerData =
        serverTimestamp > lastLocalModificationRef.current;

      // Only apply server data if:
      // 1. We have no local changes, OR
      // 2. Server data is newer AND user is not currently drawing/about to save
      if (
        !hasLocalChangesRef.current ||
        (hasNewerServerData && !isDrawing && !saveTimerRef.current)
      ) {
        setPaths(initialData.paths);
        // Initialize history with the loaded data
        if (!initializedRef.current) {
          if (initialData.paths.length > 0) {
            setHistory([initialData.paths]);
            setHistoryIndex(0);
          } else {
            // Start with empty state in history
            setHistory([[]]);
            setHistoryIndex(0);
          }
          initializedRef.current = true;
        }
        // Don't update lastLocalModificationRef here - only update on actual user input
      }
    } else if (!initializedRef.current) {
      // No initial data - start with empty state in history
      setHistory([[]]);
      setHistoryIndex(0);
      initializedRef.current = true;
    }
  }, [initialData, isDrawing]);

  // Cleanup timer on unmount only
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Memoize rect calculation to avoid repeated getBoundingClientRect calls
  const rectRef = useRef<DOMRect | null>(null);

  // Throttle mouse move events to improve performance
  const lastMoveTimeRef = useRef(0);
  const THROTTLE_MS = 16; // ~60fps for smooth lines with better performance

  const getPointFromEvent = useCallback((e: React.MouseEvent): Point => {
    if (!rectRef.current) {
      rectRef.current = e.currentTarget.getBoundingClientRect();
    }
    const rect = rectRef.current;
    return [e.clientX - rect.left, e.clientY - rect.top];
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDrawing(true);
      rectRef.current = e.currentTarget.getBoundingClientRect();
      const point = getPointFromEvent(e);
      setCurrentPath([point]);
    },
    [getPointFromEvent],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing) return;

      // Throttle mouse move events
      const now = Date.now();
      if (now - lastMoveTimeRef.current < THROTTLE_MS) return;
      lastMoveTimeRef.current = now;

      const point = getPointFromEvent(e);
      setCurrentPath((prev) => [...prev, point]);
    },
    [isDrawing, getPointFromEvent],
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing && currentPath.length > 0) {
      const timestamp = Date.now();

      // Mark that we have local changes
      hasLocalChangesRef.current = true;
      lastLocalModificationRef.current = timestamp;

      // Create the new paths array
      const newPaths = [...paths, currentPath];

      // Update paths state
      setPaths(newPaths);

      // Immediately save to history (no debounce for undo/redo)
      saveToHistory(newPaths);

      // Debounce only the database save - wait to see if more strokes come
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        const drawingData: CanvasData = {
          paths: newPaths,
          timestamp: timestamp,
          version: "1.0",
        };
        onDrawingChange?.(newPaths.length === 0, drawingData);
      }, SAVE_DEBOUNCE_MS);

      setCurrentPath([]);
      setIsDrawing(false);
    }
  }, [isDrawing, currentPath, paths, onDrawingChange, saveToHistory]);

  const getPointFromTouch = useCallback((e: React.TouchEvent): Point => {
    if (!rectRef.current) {
      rectRef.current = e.currentTarget.getBoundingClientRect();
    }
    const rect = rectRef.current;
    const touch = e.touches[0];
    return [touch!.clientX - rect.left, touch!.clientY - rect.top];
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent scrolling
      setIsDrawing(true);
      rectRef.current = e.currentTarget.getBoundingClientRect();
      const point = getPointFromTouch(e);
      setCurrentPath([point]);
    },
    [getPointFromTouch],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent scrolling
      if (!isDrawing) return;

      // Throttle touch move events
      const now = Date.now();
      if (now - lastMoveTimeRef.current < THROTTLE_MS) return;
      lastMoveTimeRef.current = now;

      const point = getPointFromTouch(e);
      setCurrentPath((prev) => [...prev, point]);
    },
    [isDrawing, getPointFromTouch],
  );

  const handleTouchEnd = useCallback(() => {
    if (isDrawing && currentPath.length > 0) {
      const timestamp = Date.now();

      hasLocalChangesRef.current = true;
      lastLocalModificationRef.current = timestamp;

      // Create the new paths array
      const newPaths = [...paths, currentPath];

      // Update paths state
      setPaths(newPaths);

      // Immediately save to history (no debounce for undo/redo)
      saveToHistory(newPaths);

      // Debounce only the database save - wait to see if more strokes come
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        const drawingData: CanvasData = {
          paths: newPaths,
          timestamp: timestamp,
          version: "1.0",
        };
        onDrawingChange?.(newPaths.length === 0, drawingData);
      }, SAVE_DEBOUNCE_MS);

      setCurrentPath([]);
      setIsDrawing(false);
    }
  }, [isDrawing, currentPath, paths, onDrawingChange, saveToHistory]);

  // Memoize path string generation to avoid recalculating on every render
  const pathStrings = useMemo(() => {
    return paths.map((path) =>
      path.reduce((acc, point, index) => {
        if (index === 0) return `M ${point[0]} ${point[1]}`;
        return `${acc} L ${point[0]} ${point[1]}`;
      }, ""),
    );
  }, [paths]);

  const currentPathString = useMemo(() => {
    if (currentPath.length === 0) return "";
    return currentPath.reduce((acc, point, index) => {
      if (index === 0) return `M ${point[0]} ${point[1]}`;
      return `${acc} L ${point[0]} ${point[1]}`;
    }, "");
  }, [currentPath]);

  // Expose clear function and isEmpty check to parent
  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        setHistoryIndex((currentIndex) => {
          setHistory((prevHistory) => {
            const newPaths: CanvasPaths = [];

            // Truncate future history
            const truncatedHistory =
              currentIndex === -1 ? [] : prevHistory.slice(0, currentIndex + 1);

            // Deduplicate: if last state is already empty, don't add another
            const lastState = truncatedHistory[truncatedHistory.length - 1];
            if (
              lastState &&
              JSON.stringify(lastState) === JSON.stringify(newPaths)
            ) {
              // Already empty, just update UI
              setPaths([]);
              setCurrentPath([]);
              return prevHistory;
            }

            // Add new cleared state
            const newHistory = [...truncatedHistory, newPaths];

            // Notify history change
            const newIndex = newHistory.length - 1;
            const newCanUndo = newIndex > 0;
            const newCanRedo = false;
            onHistoryChange?.(newCanUndo, newCanRedo);

            return newHistory;
          });

          // Return new index (pointing to the newly added state)
          const newIndex = currentIndex + 1;
          return newIndex;
        });

        setPaths([]);
        setCurrentPath([]);

        // Save immediately to database (don't debounce clear)
        onDrawingChange?.(true, {
          paths: [],
          timestamp: Date.now(),
          version: "1.0",
        });
      },
      isEmpty: () => {
        return paths.length === 0 && currentPath.length === 0;
      },
      undo: () => {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          
          // Update both states together
          setHistoryIndex(newIndex);
          const previousPaths = history[newIndex] ?? [];
          setPaths(previousPaths);

          // Save the undo action
          hasLocalChangesRef.current = true;
          lastLocalModificationRef.current = Date.now();

          // Notify history change IMMEDIATELY with the new values
          const newCanUndo = newIndex > 0;
          const newCanRedo = newIndex < history.length - 1;
          onHistoryChange?.(newCanUndo, newCanRedo);

          // Update canvas empty state
          const isEmpty = previousPaths.length === 0;
          onCanvasEmptyChange?.(isEmpty);

          // Update form field without triggering the full onDrawingChange callback
          onFormFieldChange?.({
            paths: previousPaths,
            timestamp: Date.now(),
            version: "1.0",
          });
        }
      },
      redo: () => {
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          const nextPaths = history[newIndex] ?? [];
          setPaths(nextPaths);

          // Save the redo action
          hasLocalChangesRef.current = true;
          lastLocalModificationRef.current = Date.now();

          // Notify history change
          const newCanUndo = newIndex > 0;
          const newCanRedo = newIndex < history.length - 1;
          onHistoryChange?.(newCanUndo, newCanRedo);

          // Update canvas empty state
          const isEmpty = nextPaths.length === 0;
          onCanvasEmptyChange?.(isEmpty);

          // Update form field without triggering the full onDrawingChange callback
          onFormFieldChange?.({
            paths: nextPaths,
            timestamp: Date.now(),
            version: "1.0",
          });
        }
      },
      canUndo: () => {
        // Can undo if we're not at the first state (index 0)
        return historyIndex > 0;
      },
      canRedo: () => {
        // Can redo if we're not at the last state
        // Special case: if we're at index 0 (empty state) and there's more history, we can redo
        return historyIndex < history.length - 1;
      },
    }),
    [
      paths,
      currentPath,
      history,
      historyIndex,
      onDrawingChange,
      onHistoryChange,
    ],
  );

  return (
    <div
      className="relative h-72 w-72 cursor-crosshair touch-none overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white"
      onTouchMove={(e) => e.preventDefault()}
    >
      <svg
        className="h-full w-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {pathStrings.map((pathString, pathIndex) => (
          <path
            key={pathIndex}
            d={pathString}
            stroke="#a16bc7"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {currentPathString && (
          <path
            d={currentPathString}
            stroke="#a16bc7"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
});

SimpleCanvas.displayName = "SimpleCanvas";

export default SimpleCanvas;
