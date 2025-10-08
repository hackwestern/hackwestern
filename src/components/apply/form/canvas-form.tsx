import React, { useState, useRef, useCallback, useMemo } from "react";
import { Form } from "~/components/ui/form";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { useAutoSave } from "~/components/hooks/use-auto-save";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { canvasSaveSchema } from "~/schemas/application";

// Define the canvas data structure explicitly
type CanvasData = {
  paths: Array<Array<{ x: number; y: number }>>;
  timestamp: number;
  version: string;
};

type CanvasFormData = {
  canvasDescription?: string | null;
  canvasData?: CanvasData | null;
};

// Simple canvas component for the form
const SimpleCanvas = React.forwardRef<
  { clear: () => void; isEmpty: () => boolean },
  { onDrawingChange?: (isEmpty: boolean, data?: CanvasData) => void }
>(({ onDrawingChange }, ref) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Array<{ x: number; y: number }[]>>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>(
    [],
  );

  // Memoize rect calculation to avoid repeated getBoundingClientRect calls
  const rectRef = useRef<DOMRect | null>(null);

  // Throttle mouse move events to improve performance
  const lastMoveTimeRef = useRef(0);
  const THROTTLE_MS = 4; // ~250fps for very smooth lines

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
      setPaths((prev) => {
        const newPaths = [...prev, currentPath];
        onDrawingChange?.(newPaths.length === 0);
        return newPaths;
      });
      setCurrentPath([]);
      setIsDrawing(false);
    }
  }, [isDrawing, currentPath, onDrawingChange]);

  // Save drawing data whenever paths change
  React.useEffect(() => {
    if (paths.length > 0) {
      const drawingData = {
        paths: paths,
        timestamp: Date.now(),
        version: "1.0",
      };
      // Send as object instead of JSON string since we're using JSONB
      onDrawingChange?.(false, drawingData);
    }
  }, [paths, onDrawingChange]);

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
      onDrawingChange?.(true);
    },
    isEmpty: () => {
      return paths.length === 0 && currentPath.length === 0;
    },
  }));

  return (
    <div className="relative h-[28rem] max-h-[28rem] w-full cursor-crosshair overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white">
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
            stroke="#3b82f6"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {currentPathString && (
          <path
            d={currentPathString}
            stroke="#3b82f6"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {paths.length === 0 && currentPath.length === 0 && (
        <div className="absolute left-2 top-2 rounded bg-white px-2 py-1 text-sm text-gray-500">
          Draw something to express yourself!
        </div>
      )}
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

  const form = useForm<CanvasFormData>({
    resolver: zodResolver(canvasSaveSchema),
    defaultValues: {
      canvasData: (defaultValues?.canvasData as CanvasData | null) ?? null,
    },
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

  function onSubmit(data: CanvasFormData) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div></div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isCanvasEmpty}
                onClick={() => {
                  canvasRef.current?.clear();
                  setIsCanvasEmpty(true);
                }}
                className={`${
                  isCanvasEmpty
                    ? "disabled:cursor-not-allowed disabled:opacity-50"
                    : "border-purple-600 bg-purple-600 text-white hover:border-purple-700 hover:bg-purple-700"
                }`}
              >
                Clear
              </Button>
            </div>
            <SimpleCanvas
              ref={canvasRef}
              onDrawingChange={(isEmpty, data) => {
                setIsCanvasEmpty(isEmpty);
                if (data) {
                  form.setValue("canvasData", data);
                }
              }}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
