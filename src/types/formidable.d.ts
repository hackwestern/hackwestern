declare module "formidable" {
  import type { IncomingMessage } from "http";

  export interface File {
    filepath: string;
    size: number;
    mimetype: string | null;
    originalFilename: string | null;
  }

  export type Fields = Record<string, string | string[]>;

  export type Files = Record<string, File | File[]>;

  export interface IncomingFormOptions {
    maxFileSize?: number;
    multiples?: boolean;
    keepExtensions?: boolean;
  }

  export class IncomingForm {
    constructor(options?: IncomingFormOptions);
    parse(
      req: IncomingMessage,
      cb: (err: Error | null, fields: Fields, files: Files) => void,
    ): void;
  }
}
