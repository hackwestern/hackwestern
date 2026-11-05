import { PublicJudgeApp } from "~/components/judging/judge-app/judge-app";
import SEO from "~/components/seo";

// Opened from the private link on the judge roster (/judge/link/<token>).
// UI only for now: the token isn't read or checked yet, and there is no
// sign-in. Add token validation before this goes anywhere real.
export default function PublicJudgePage() {
  return (
    <>
      <SEO title="Judging" noindex />
      <PublicJudgeApp />
    </>
  );
}