// vitest.setup.ts
import { vi } from "vitest";

vi.mock("~/server/mail", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({
        data: { id: "mocked-email-id" },
        error: null,
      }),
    },
  },
}));
