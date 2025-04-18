import Mailjet from "node-mailjet";

export const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY ?? "",
  process.env.MAILJET_SECRET_KEY ?? "",
);

import { Resend } from "resend";

export const resend = new Resend(
  process.env.RESEND_API_KEY ?? "",
);