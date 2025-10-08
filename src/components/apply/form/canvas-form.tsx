import React, { useState, useRef, useCallback, useMemo } from "react";
import { Form, FormControl, FormField, FormItem } from "~/components/ui/form";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { useAutoSave } from "~/components/hooks/use-auto-save";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { canvasSaveSchema } from "~/schemas/application";
import type { z } from "zod";

// Define the canvas data structure explicitly
type CanvasData = {
  paths: Array<Array<{ x: number; y: number }>>;
  timestamp: number;
  version: string;
};

// Simple canvas component for the form
const SimpleCanvas = React.forwardRef<
  { clear: () => void; isEmpty: () => boolean },
  {
    onDrawingChange?: (isEmpty: boolean, data?: CanvasData) => void;
    initialData?: CanvasData | null;
  }
>(({ onDrawingChange, initialData }, ref) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Array<{ x: number; y: number }[]>>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>(
    [],
  );

  // Debounce timer for saving strokes
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const SAVE_DEBOUNCE_MS = 300;

  // Track the last local modification timestamp to prioritize local data
  const lastLocalModificationRef = useRef<number>(0);
  const hasLocalChangesRef = useRef<boolean>(false);

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
        // Don't update lastLocalModificationRef here - only update on actual user input
      }
    }

    // Cleanup timer on unmount
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [initialData, isDrawing]);

  // Memoize rect calculation to avoid repeated getBoundingClientRect calls
  const rectRef = useRef<DOMRect | null>(null);

  // Throttle mouse move events to improve performance
  const lastMoveTimeRef = useRef(0);
  const THROTTLE_MS = 16; // ~60fps for smooth lines with better performance

  const getPointFromEvent = useCallback((e: React.MouseEvent) => {
    if (!rectRef.current) {
      rectRef.current = e.currentTarget.getBoundingClientRect();
    }
    const rect = rectRef.current;
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
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
    if (isDrawing) {
      const timestamp = Date.now();

      // Clear any existing save timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Mark that we have local changes
      hasLocalChangesRef.current = true;
      lastLocalModificationRef.current = timestamp;

      setPaths((prev) => {
        const newPaths = [...prev, currentPath];

        // Debounce the save - only save if no new stroke starts within 300ms
        saveTimerRef.current = setTimeout(() => {
          const drawingData: CanvasData = {
            paths: newPaths,
            timestamp: timestamp,
            version: "1.0",
          };
          onDrawingChange?.(newPaths.length === 0, drawingData);
        }, SAVE_DEBOUNCE_MS);

        return newPaths;
      });
      setCurrentPath([]);
      setIsDrawing(false);
    }
  }, [isDrawing, currentPath, onDrawingChange]);

  // Memoize path string generation to avoid recalculating on every render
  const pathStrings = useMemo(() => {
    return paths.map((path) =>
      path.reduce((acc, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        return `${acc} L ${point.x} ${point.y}`;
      }, ""),
    );
  }, [paths]);

  const currentPathString = useMemo(() => {
    if (currentPath.length === 0) return "";
    return currentPath.reduce((acc, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      return `${acc} L ${point.x} ${point.y}`;
    }, "");
  }, [currentPath]);

  // Expose clear function and isEmpty check to parent
  React.useImperativeHandle(ref, () => ({
    clear: () => {
      setPaths([]);
      setCurrentPath([]);
      setIsDrawing(false);

      // Mark as local change and update timestamp
      hasLocalChangesRef.current = true;
      lastLocalModificationRef.current = Date.now();

      // Clear any pending save timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Notify parent that canvas is now empty (and save this state immediately)
      onDrawingChange?.(true, {
        paths: [],
        timestamp: Date.now(),
        version: "1.0",
      });
    },
    isEmpty: () => {
      return paths.length === 0 && currentPath.length === 0;
    },
  }));

  return (
    <div className="relative h-80 w-lg cursor-crosshair overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white">
      <svg
        className="h-full w-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });
  const canvasRef = React.useRef<{ clear: () => void; isEmpty: () => boolean }>(
    null,
  );
  const [isCanvasEmpty, setIsCanvasEmpty] = useState(true);

  const form = useForm<z.infer<typeof canvasSaveSchema>>({
    resolver: zodResolver(canvasSaveSchema),
  });

  // Load existing drawing data when form loads
  React.useEffect(() => {
    if (defaultValues?.canvasData) {
      try {
        const drawingData = defaultValues.canvasData;
        if (
          drawingData &&
          typeof drawingData === "object" &&
          "paths" in drawingData &&
          Array.isArray(drawingData.paths)
        ) {
          // We could restore the drawing here, but for now just mark as not empty
          setIsCanvasEmpty(false);
        }
      } catch (error) {
        console.warn("Failed to parse canvas data:", error);
      }
    }
  }, [defaultValues?.canvasData]);

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof canvasSaveSchema>) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <FormField
            control={form.control}
            name="canvasData"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="-ml-1 -mt-5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isCanvasEmpty}
                      onClick={() => {
                        canvasRef.current?.clear();
                      }}
                      className={`absolute z-[999] -mb-2 ml-2 mt-4 h-max bg-beige text-heavy`}
                    >
                      Clear
                    </Button>
                    <SimpleCanvas
                      ref={canvasRef}
                      initialData={
                        defaultValues?.canvasData as CanvasData | null
                      }
                      onDrawingChange={(isEmpty, data) => {
                        setIsCanvasEmpty(isEmpty);
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
        </div>
      </form>
    </Form>
  );
}
