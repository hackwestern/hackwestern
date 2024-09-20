import { useCallback } from "react";
import { FieldValues, useWatch, type useForm } from "react-hook-form";
import { debounce } from "~/lib/utils";
import useDeepCompareEffect from "use-deep-compare-effect";

export function useAutoSave<TFieldValues extends FieldValues = FieldValues>(
  context: ReturnType<typeof useForm<TFieldValues>>,
  onSubmit: (data: TFieldValues) => void,
) {
  const watch = useWatch({ control: context.control });
  const { dirtyFields } = context.formState;
  const hasDirtyFields = Object.keys(dirtyFields).length > 0;

  const debouncedSave = useCallback(
    debounce(() => {
      void context.handleSubmit(onSubmit)();
    }, 500),
    [],
  );

  useDeepCompareEffect(() => {
    if (hasDirtyFields) {
      debouncedSave();
    }
  }, [watch]);
}
