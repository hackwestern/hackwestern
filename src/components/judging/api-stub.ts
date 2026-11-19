// TEMPORARY: the old judging queue API these screens were written against was
// removed in #1155 (replaced by the table-section engine). Until they are
// rewired, API calls are replaced by these stubs: queries return no data and
// mutations reject. Delete this file when the screens use the new API.

export const NOT_WIRED = "Not wired up to the new judging API yet.";

export function useStubQuery<T>(data: T) {
  return {
    data,
    error: null as Error | null,
    isLoading: false,
    isPending: false,
    dataUpdatedAt: 0,
    refetch: () => Promise.resolve({ data }),
  };
}

export function useStubMutation<I = void, O = void>() {
  const fail = () => Promise.reject(new Error(NOT_WIRED));
  return {
    mutateAsync: (_input: I) => fail(),
    mutate: (_input: I) => void fail().catch(() => undefined),
    isPending: false,
    variables: undefined as I | undefined,
  };
}

export const stubUtils = {
  invalidate: () => Promise.resolve(),
};
