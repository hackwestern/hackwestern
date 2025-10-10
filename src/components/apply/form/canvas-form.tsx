import React, { useState, useRef, useCallback, useMemo } from "react";
import type { Point, Stroke, CanvasPaths } from "~/types/canvas";
import { Form, FormControl, FormField, FormItem } from "~/components/ui/form";
import { Button } from "~/components/ui/button";
import { Undo, Redo, Trash2 } from "lucide-react";
import { api } from "~/utils/api";
import { useAutoSave } from "~/components/hooks/use-auto-save";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { canvasSaveSchema } from "~/schemas/application";
import type { z } from "zod";

// Define the canvas data structure explicitly
type CanvasData = {
  paths: CanvasPaths; // array of strokes composed of points
  timestamp: number;
  version: string;
};

// Simple canvas component for the form
const SimpleCanvas = React.forwardRef<
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
    initialData?: CanvasData | null;
  }
>(({ onDrawingChange, onHistoryChange, initialData }, ref) => {
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
    [onHistoryChange],
  );

  // Load initial data when component mounts or initialData changes
  // Only update if server data is newer than local data AND user isn't actively drawing
  React.useEffect(() => {
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
  React.useEffect(() => {
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
  React.useImperativeHandle(
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

          return currentIndex + 1;
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
          setHistoryIndex(newIndex);
          const previousPaths = history[newIndex] ?? [];
          setPaths(previousPaths);

          // Save the undo action
          hasLocalChangesRef.current = true;
          lastLocalModificationRef.current = Date.now();

          // Notify history change
          const newCanUndo = newIndex > 0;
          const newCanRedo = newIndex < history.length - 1;
          onHistoryChange?.(newCanUndo, newCanRedo);

          onDrawingChange?.(previousPaths.length === 0, {
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

          onDrawingChange?.(nextPaths.length === 0, {
            paths: nextPaths,
            timestamp: Date.now(),
            version: "1.0",
          });
        }
      },
      canUndo: () => historyIndex > 0,
      canRedo: () => historyIndex < history.length - 1,
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

export function CanvasForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery();

  const status = defaultValues?.status ?? "NOT_STARTED";
  const canEdit = status == "NOT_STARTED" || status == "IN_PROGRESS";

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });
  const canvasRef = React.useRef<{
    clear: () => void;
    isEmpty: () => boolean;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
  }>(null);
  const [isCanvasEmpty, setIsCanvasEmpty] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const form = useForm<z.infer<typeof canvasSaveSchema>>({
    resolver: zodResolver(canvasSaveSchema),
  });

  // Load existing drawing data when form loads
  React.useEffect(() => {
    try {
      // Prefer controller/form value if available, otherwise fall back to server defaults
      const drawingData =
        form.getValues?.("canvasData") ?? defaultValues?.canvasData;

      const isObject = drawingData && typeof drawingData === "object";
      let hasPaths = false;

      if (isObject) {
        const maybePaths = (drawingData as Partial<CanvasData>).paths;
        hasPaths = Array.isArray(maybePaths) && maybePaths.length > 0;
      }

      setIsCanvasEmpty(!hasPaths);
    } catch (error) {
      console.warn("Failed to determine initial canvas data state:", error);
      setIsCanvasEmpty(true);
    }
  }, [defaultValues?.canvasData, form]);

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof canvasSaveSchema>) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  type CanvasData = {
    paths: CanvasPaths;
    timestamp: number;
    version: string;
  };

  const canvasData = defaultValues?.canvasData as CanvasData | null | undefined;
  const pathStrings =
    canvasData?.paths?.map((path) =>
      path.reduce((acc, point, index) => {
        if (index === 0) return `M ${point[0]} ${point[1]}`;
        return `${acc} L ${point[0]} ${point[1]}`;
      }, ""),
    ) ?? [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          {canEdit ? (
            <FormField
              control={form.control}
              name="canvasData"
              // Provide a defaultValue so react-hook-form registers this Controller
              defaultValue={defaultValues?.canvasData ?? null}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="-mr-1">
                      <div className="absolute z-[999] mt-2 flex w-[17.5rem] justify-end gap-2">
                        <Button
                          type="button"
                          size="icon"
                          disabled={!canUndo}
                          onClick={() => {
                            canvasRef.current?.undo();
                            setCanUndo(canvasRef.current?.canUndo() ?? false);
                            setCanRedo(canvasRef.current?.canRedo() ?? false);
                          }}
                          className="h-6 w-6 text-heavy"
                          title="Undo"
                        >
                          <Undo className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          disabled={!canRedo}
                          onClick={() => {
                            canvasRef.current?.redo();
                            setCanUndo(canvasRef.current?.canUndo() ?? false);
                            setCanRedo(canvasRef.current?.canRedo() ?? false);
                          }}
                          className="h-6 w-6 text-heavy"
                          title="Redo"
                        >
                          <Redo className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          disabled={isCanvasEmpty}
                          onClick={() => {
                            canvasRef.current?.clear();
                            setCanUndo(canvasRef.current?.canUndo() ?? false);
                            setCanRedo(canvasRef.current?.canRedo() ?? false);
                          }}
                          className="h-6 w-6 text-heavy"
                          title="Clear"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <SimpleCanvas
                        ref={canvasRef}
                        // Use the controller's value when available so the canvas
                        // reflects the form state and the field is properly controlled
                        initialData={
                          (field.value as CanvasData | null) ??
                          (defaultValues?.canvasData as CanvasData | null) ??
                          null
                        }
                        onHistoryChange={(newCanUndo, newCanRedo) => {
                          setCanUndo(newCanUndo);
                          setCanRedo(newCanRedo);
                        }}
                        onDrawingChange={(isEmpty, data) => {
                          setIsCanvasEmpty(isEmpty);
                          setCanUndo(canvasRef.current?.canUndo() ?? false);
                          setCanRedo(canvasRef.current?.canRedo() ?? false);
                          if (data) {
                            field.onChange(data);
                          }
                        }}
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          ) : pathStrings.length > 0 ? (
            <div className="overflow-hidden rounded-lg border-2 border-gray-300 bg-white">
              <svg className="h-64 w-full lg:h-72">
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
              </svg>
            </div>
          ) : (
            <p className="text-sm text-medium">No drawing :(</p>
          )}
        </div>
      </form>
    </Form>
  );
}
