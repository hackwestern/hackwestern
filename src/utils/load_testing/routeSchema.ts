export type RouterSchema = Record<string, ProcedureInfo>;
export type ProcedureInfo = {
  path: string;
  input: unknown;
  type: "query" | "mutation" | "subscription";
};
