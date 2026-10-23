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

export type RsvpTravel = z.infer<typeof rsvpTravelSaveSchema>;

// What gets stored for a travel answer, used by autosave and by Confirm so
// both write the same shape: a Hack Western bus means no ticket to
// reimburse, and the city is only kept with a reimbursement request.
// Undefined fields are left out of the update, as before.
export function normalizeTravel(input: z.infer<typeof rsvpTravelSaveSchema>) {
  const ownTravel = input.transportationMethod === OWN_TRAVEL;
  const travelReimbursement = ownTravel ? input.travelReimbursement : null;
  const travelFrom =
    ownTravel && travelReimbursement ? input.travelFrom?.trim() : null;
  return {
    transportationMethod: input.transportationMethod,
    travelReimbursement,
    travelFrom: travelFrom ?? null,
  };
}

// Confirming needs the post-secondary enrollment attestation. `travel` is
// the travel answer on screen when Confirm was clicked, so a click inside
// the autosave debounce can't confirm against an older saved answer.
export const rsvpRespondSchema = z.object({
  attending: z.boolean(),
  enrolled: z.boolean().optional(),
  travel: rsvpTravelSaveSchema.optional(),
});
