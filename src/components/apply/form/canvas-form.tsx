import React, { useState } from "react";
import type { CanvasPaths } from "~/types/canvas";
import { Form, FormControl, FormField, FormItem } from "~/components/ui/form";
import { Button } from "~/components/ui/button";
import { Undo, Redo, Trash2 } from "lucide-react";
import { api } from "~/utils/api";
import { useAutoSave } from "~/hooks/use-auto-save";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { canvasSaveSchema } from "~/schemas/application";
import type { z } from "zod";
import SimpleCanvas from "./simple-canvas";

export function CanvasForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: ["status", "canvasData"],
  });

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
