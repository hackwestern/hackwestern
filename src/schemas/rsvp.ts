import { z } from "zod";

import { transportationMethod } from "~/server/db/schema";

// "None" = getting there on their own. Every other value is a Hack Western bus city.
export const OWN_TRAVEL = "None";

// Autosave: every field optional, like the apply steps
export const rsvpTravelSaveSchema = z.object({
  transportationMethod: z.enum(transportationMethod.enumValues).nullish(),
  travelReimbursement: z.boolean().nullish(),
  travelFrom: z.string().max(255).nullish(),
});

// RSVP submit: reimbursement is only asked when travelling on their own,
// and a request needs the city they're travelling from
export const rsvpTravelSubmitSchema = rsvpTravelSaveSchema
  .extend({
    transportationMethod: z.enum(transportationMethod.enumValues, {
      errorMap: () => ({ message: "Tell us how you're getting here" }),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.transportationMethod !== OWN_TRAVEL) return;
    if (data.travelReimbursement == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Let us know if you want ticket reimbursement",
        path: ["travelReimbursement"],
      });
    }
    if (data.travelReimbursement && !data.travelFrom?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tell us which city you're travelling from",
        path: ["travelFrom"],
      });
    }
  });

export const rsvpRespondSchema = z.object({ attending: z.boolean() });
