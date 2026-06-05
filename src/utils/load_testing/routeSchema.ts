export type RouterSchema = Record<string, ProcedureInfo>;
export type ProcedureInfo = {
  path: string;
  input: string;
  type: "query" | "mutation" | "subscription";
};
