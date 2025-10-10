import { useEffect, useRef, useState } from "react";
import { type FieldValues, useWatch, type useForm } from "react-hook-form";
import { debounce } from "~/lib/utils";
import useDeepCompareEffect from "use-deep-compare-effect";

export function useAutoSave<TFieldValues extends FieldValues = FieldValues>(
  context: ReturnType<typeof useForm<TFieldValues>>,
  onSubmit: (data: TFieldValues) => void,
  defaultValues: TFieldValues | null | undefined,
) {
  const [hasReset, setHasReset] = useState(false);
  const watch = useWatch({ control: context.control });
  const { dirtyFields } = context.formState;
  const hasDirtyFields = Object.keys(dirtyFields).length > 0;

  // Track the last submitted values to avoid resetting with stale data
  const lastSubmittedRef = useRef<TFieldValues | null>(null);
  const isSavingRef = useRef(false);

  // Store context and onSubmit in refs so they don't cause debounce to recreate
  const contextRef = useRef(context);
  const onSubmitRef = useRef(onSubmit);

  // Keep refs up to date
  useEffect(() => {
    contextRef.current = context;
    onSubmitRef.current = onSubmit;
  });

  // Create a stable debounced save function that never recreates
  const debouncedSaveRef = useRef<ReturnType<typeof debounce> | null>(null);

  // Initialize the debounced function only once
  if (!debouncedSaveRef.current) {
    debouncedSaveRef.current = debounce(() => {
      isSavingRef.current = true;
      void contextRef.current.handleSubmit(
        (data) => {
          lastSubmittedRef.current = data;
          onSubmitRef.current(data);
          // Mark as not saving after a short delay to allow mutation to complete
          setTimeout(() => {
            isSavingRef.current = false;
          }, 100);
        },
        (fieldErrors) => {
          console.error(
            "There were errors in one or more fields on the form:",
            {
              fieldErrors,
            },
          );
          isSavingRef.current = false;
        },
      )();
    }, 750);
  }

  useEffect(() => {
    // Only reset the form with defaultValues if:
    // 1. We have defaultValues
    // 2. We haven't reset yet (initial load)
    // 3. OR the user is not currently editing (no dirty fields) and we're not in the middle of saving
    if (defaultValues && !hasReset) {
      context.reset(defaultValues);
      setHasReset(true);
      lastSubmittedRef.current = defaultValues;
    } else if (
      defaultValues &&
      hasReset &&
      !hasDirtyFields &&
      !isSavingRef.current
    ) {
      // Only update if the new defaultValues are different from what we last submitted
      // This prevents overwriting local changes with stale server data
      const currentValues = context.getValues();
      const hasLocalChanges =
        JSON.stringify(currentValues) !==
        JSON.stringify(lastSubmittedRef.current);

      if (!hasLocalChanges) {
        context.reset(defaultValues, { keepDirty: false });
        lastSubmittedRef.current = defaultValues;
      }
    }
  }, [defaultValues, hasReset, hasDirtyFields, context]);

  useDeepCompareEffect(() => {
    if (hasDirtyFields && debouncedSaveRef.current) {
      debouncedSaveRef.current();
    }
  }, [watch]);
}
