import { useEffect, useRef } from "react";
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

  // Track the last submitted values to avoid resetting with stale data
  const lastSubmittedRef = useRef<TFieldValues | null>(null);
  const isSavingRef = useRef(false);

  // Track if we've done the initial reset - use ref to avoid re-renders
  const hasInitializedRef = useRef(false);

  // Store onSubmit in ref so it doesn't cause debounce to recreate
  const onSubmitRef = useRef(onSubmit);

  // Keep ref up to date
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  });

  // Create a stable debounced save function for remote updates only
  const debouncedRemoteSaveRef = useRef<((...args: unknown[]) => void) | null>(
    null,
  );

  // Initialize the debounced function only once
  if (!debouncedRemoteSaveRef.current) {
    const saveFn = (...args: unknown[]) => {
      const data = args[0] as TFieldValues;
      isSavingRef.current = true;
      lastSubmittedRef.current = data;
      onSubmitRef.current(data);
      // Mark as not saving after a short delay to allow mutation to complete
      setTimeout(() => {
        isSavingRef.current = false;
      }, 100);
    };
    debouncedRemoteSaveRef.current = debounce(saveFn, 750);
  }

  useEffect(() => {
    if (defaultValues && !hasInitializedRef.current) {
      context.reset(defaultValues);
      hasInitializedRef.current = true;
      lastSubmittedRef.current = defaultValues;
    }
    // No dependencies - this only runs when defaultValues first becomes truthy
    // Server refetches will NOT trigger this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues ? true : false]); // Only react to defaultValues becoming truthy, not its contents

  useDeepCompareEffect(() => {
    // Skip if we haven't initialized yet or if we're currently saving
    if (!hasInitializedRef.current || isSavingRef.current) {
      return;
    }

    // Save if there are dirty fields OR if watch values changed from last submitted
    const shouldSave = hasDirtyFields ||
      (lastSubmittedRef.current &&
       JSON.stringify(watch) !== JSON.stringify(lastSubmittedRef.current));

    if (shouldSave && debouncedRemoteSaveRef.current) {
      // Validate the form synchronously
      void context.handleSubmit(
        (validData) => {
          // Form is valid, debounce the remote save
          debouncedRemoteSaveRef.current?.(validData);
        },
        (fieldErrors) => {
          // Form has errors, don't save to remote but log them
          console.error(
            "There were errors in one or more fields on the form:",
            {
              fieldErrors,
            },
          );
        },
      )();
    }
  }, [watch, hasDirtyFields, context]);
}
