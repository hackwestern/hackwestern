import { useCallback, useEffect } from "react";
import { type FieldValues, useWatch, type useForm } from "react-hook-form";
import { debounce } from "~/lib/utils";
import useDeepCompareEffect from "use-deep-compare-effect";

export function useAutoSave<TFieldValues extends FieldValues = FieldValues>(
  context: ReturnType<typeof useForm<TFieldValues>>,
  onSubmit: (data: TFieldValues) => void,
  defaultValues: TFieldValues | null | undefined,
) {
  const watch = useWatch({ control: context.control });
  const { dirtyFields } = context.formState;
  const hasDirtyFields = Object.keys(dirtyFields).length > 0;

  const debouncedSave = useCallback(
    debounce(() => {
      void context.handleSubmit(onSubmit)();
    }, 1000),
    [],
  );

  useEffect(() => {
    if (defaultValues) {
      context.reset(defaultValues);
    }
  }, [defaultValues]);

  useDeepCompareEffect(() => {
    if (hasDirtyFields) {
      debouncedSave();
    }
  }, [watch]);
}
