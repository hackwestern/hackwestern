import React, { useState, useRef, useCallback, useMemo } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { CanvasProvider } from "~/contexts/CanvasContext";
import { CanvasComponent } from "~/components/canvas/component";
import { useCanvasContext } from "~/contexts/CanvasContext";
import { motion, useMotionValue } from "framer-motion";
import { api } from "~/utils/api";
import { useAutoSave } from "~/components/hooks/use-auto-save";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { canvasSaveSchema } from "~/schemas/application";
import { z } from "zod";

type CanvasFormData = z.infer<typeof canvasSaveSchema>;

// Simple canvas component for the form
const SimpleCanvas = React.forwardRef<{ clear: () => void; isEmpty: () => boolean }, { onDrawingChange?: (isEmpty: boolean, data?: string) => void }>(({ onDrawingChange }, ref) => {
  const { x, y, scale } = useCanvasContext();
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Array<{ x: number; y: number }[]>>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  
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
      x: (e.clientX - rect.left) / scale.get(),
      y: (e.clientY - rect.top) / scale.get()
    };
  }, [scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDrawing(true);
    rectRef.current = e.currentTarget.getBoundingClientRect();
    const point = getPointFromEvent(e);
    setCurrentPath([point]);
  }, [getPointFromEvent]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;
    
    // Throttle mouse move events
    const now = Date.now();
    if (now - lastMoveTimeRef.current < THROTTLE_MS) return;
    lastMoveTimeRef.current = now;
    
    const point = getPointFromEvent(e);
    setCurrentPath(prev => [...prev, point]);
  }, [isDrawing, getPointFromEvent]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setPaths(prev => {
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
        version: "1.0"
      };
      // This will be picked up by the parent form's auto-save
      onDrawingChange?.(false, JSON.stringify(drawingData));
    }
  }, [paths, onDrawingChange]);

  // Memoize path string generation to avoid recalculating on every render
  const pathStrings = useMemo(() => {
    return paths.map(path => 
      path.reduce((acc, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        return `${acc} L ${point.x} ${point.y}`;
      }, "")
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
    }
  }));

  return (
    <div className="w-full h-80 max-h-80 border-2 border-dashed border-gray-300 rounded-lg relative overflow-hidden bg-white cursor-crosshair">
      <svg
        className="w-full h-full"
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
        <div className="absolute top-2 left-2 text-sm text-gray-500 bg-white px-2 py-1 rounded">
          Draw something to express yourself!
        </div>
      )}
    </div>
  );
});

export function CanvasForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });
  const canvasRef = React.useRef<{ clear: () => void; isEmpty: () => boolean }>(null);
  const [isCanvasEmpty, setIsCanvasEmpty] = useState(true);

  const form = useForm<CanvasFormData>({
    resolver: zodResolver(canvasSaveSchema),
    defaultValues: {
      canvasData: defaultValues?.canvasData || "",
    },
  });

  // Load existing drawing data when form loads
  React.useEffect(() => {
    if (defaultValues?.canvasData) {
      try {
        const drawingData = JSON.parse(defaultValues.canvasData);
        if (drawingData.paths && Array.isArray(drawingData.paths)) {
          // We could restore the drawing here, but for now just mark as not empty
          setIsCanvasEmpty(false);
        }
      } catch (error) {
        console.warn('Failed to parse canvas data:', error);
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

  // Canvas context values
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  return (
    <CanvasProvider
      x={x}
      y={y}
      scale={scale}
      isResetting={false}
      maxZIndex={1}
      setMaxZIndex={() => {}}
      animationStage={0}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="border rounded-lg p-6 bg-white shadow-sm">
            <div className="mb-4">
              <p className="text-gray-600 mt-1">
                Use the canvas below to draw, sketch, or create something that represents you. 
                This is your chance to be creative and show your personality!
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Your Canvas</FormLabel>
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
                        ? "disabled:opacity-50 disabled:cursor-not-allowed" 
                        : "bg-purple-600 text-white border-purple-600 hover:bg-purple-700 hover:border-purple-700"
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
                      form.setValue('canvasData', data);
                    }
                  }}
                />
                <p className="text-sm text-gray-500">
                  Click and drag to draw. Express yourself!
                </p>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </CanvasProvider>
  );
}
