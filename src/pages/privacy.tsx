import Link from "next/link";
import type { ReactNode } from "react";
import SEO from "~/components/seo";

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-xl font-bold text-heavy">{children}</h2>;
}

function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold text-heavy">{children}</h3>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 leading-relaxed text-heavy">{children}</p>;
}

function Mail() {
  return (
    <a
      className="text-[#7C3AED] hover:underline"
      href="mailto:hello@hackwestern.com"
    >
      hello@hackwestern.com
    </a>
  );
}

export default function Privacy() {
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="How Hack Western collects, uses, shares, and protects your personal data."
      />

      <div className="min-h-screen bg-[#f7f6fb]">
        <div className="mx-auto max-w-3xl px-6 py-16 font-figtree text-heavy">
          <Link
            href="/"
            className="text-sm font-medium text-[#2E547A] hover:underline"
          >
            &larr; Back to hackwestern.com
          </Link>

          <h1 className="mt-6 font-cossetteTexte text-4xl font-bold text-[#2E547A]">
            Privacy and Data Policy
          </h1>
          <p className="mt-2 text-sm text-medium">Last updated: August 2026</p>

          <section className="mt-8 rounded-lg border border-black/5 bg-white p-5">
            <p className="font-semibold text-heavy">Key points</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-heavy">
              <li>
                We collect the personal information you share with us to run
                Hack Western, and some anonymized data to improve our services.
              </li>
              <li>
                We don&apos;t sell your data, and we don&apos;t track you for
                advertising (there are no ads on our site).
              </li>
              <li>
                If you submit a r&eacute;sum&eacute;, we may share it with
                sponsors for recruiting purposes.
              </li>
              <li>
                You can request that we provide, update, or delete your data at
                any time by emailing <Mail />.
              </li>
            </ul>
          </section>

          <H2>Preface</H2>
          <P>
            At Hack Western, we care about privacy and personal data as much as
            you do. We are a not-for-profit, student-run hackathon at Western
            University in London, Ontario, Canada, and we respect your rights as
            a user. This policy explains what we collect, how we use it, who we
            share it with, and the rights you have over it.
          </P>

          <H2>Terminology</H2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-heavy">
            <li>
              <strong>Us / We / Our</strong> &mdash; the Hack Western organizing
              team.
            </li>
            <li>
              <strong>The Event</strong> &mdash; the annual Hack Western
              hackathon.
            </li>
            <li>
              <strong>Participant</strong> &mdash; applicants, hackers,
              volunteers, mentors, sponsors, and other attendees.
            </li>
            <li>
              <strong>Providers</strong> &mdash; third parties that help us host
              the event and operate our services.
            </li>
            <li>
              <strong>Partners</strong> &mdash; sponsors and other third parties
              affiliated with the event.
            </li>
          </ul>

          <H2>Data we collect</H2>
          <P>
            We collect data in three broad situations: when you visit our
            website, when you apply or sign up, and at the event.
          </P>

          <H3>When you visit our website</H3>
          <P>
            We use cookies to keep you authenticated across our services. We
            also collect anonymized performance data through Vercel Speed
            Insights to understand things like page-load times and improve our
            site. Our hosting and database providers (Vercel and Neon) process
            standard technical data needed to serve the site. We do not use
            advertising or cross-site tracking, and there are no ads on our
            site.
          </P>

          <H3>When you apply or sign up</H3>
          <P>
            <strong>Primary data</strong> &mdash; information we need to run the
            event and communicate with you, which you provide explicitly through
            our forms. This includes, but is not limited to, your name, email
            address, school, application responses, links you share, and any
            r&eacute;sum&eacute; you submit.
          </P>
          <P>
            <strong>Optional data</strong> &mdash; some fields are optional and
            used only to better understand our participants and improve the
            event. Optional fields are clearly marked and never affect decisions
            such as your application outcome.
          </P>
          <P>
            <strong>Third-party sign-in data</strong> &mdash; if you choose to
            sign in with GitHub, Google, or Discord, we receive your name, email
            address, and authentication credentials for that account, used
            solely to identify you and provide sign-in access to our services.
            We will not take any action on your behalf. You can review or unlink
            this access from your account settings with that provider.
          </P>

          <H3>At the event</H3>
          <P>
            We collect operational data during the event &mdash; for example,
            QR-code and check-in scans &mdash; to manage logistics such as food
            quotas and to understand participation in activities.
          </P>

          <H2>How we use your data</H2>
          <P>
            To operate the event, review applications, communicate with you
            about your application and the event, run event-day logistics,
            improve our services, and &mdash; where you have opted in &mdash;
            send you updates you signed up for.
          </P>

          <H2>Data we share</H2>

          <H3>Operational providers</H3>
          <P>
            To run Hack Western, we use third-party providers to host our
            website, database, email, and file storage &mdash; currently Vercel,
            Neon, Cloudflare, Amazon Web Services, and Zoho. These providers
            process participant data only as needed to provide their services to
            us. Our providers may change over time as our needs evolve; a
            current list of major providers can be requested at <Mail />.
          </P>

          <H3>Sponsor and participant-directed sharing</H3>
          <P>
            We may share personal information with sponsors or partners when you
            provide it for a partner-related purpose, or when you take part in
            an activity where sharing is clearly expected. For example: if you
            submit a r&eacute;sum&eacute;, we may share it with sponsors for
            recruiting purposes; and if you scan into a sponsor activity, we may
            share relevant participation information with that sponsor. We aim
            to make clear, in plain language, when information is being
            collected for sponsor or partner use.
          </P>

          <H3>Anonymous, de-identified, and aggregate data</H3>
          <P>
            We may share anonymized or aggregate data &mdash; such as the number
            of applicants or which activities were popular &mdash; publicly or
            with partners, for purposes like event reporting, transparency, and
            improving future events. We remove direct identifiers such as names
            and email addresses from this data.
          </P>

          <H3>Legal compliance</H3>
          <P>
            We may disclose your information to law enforcement or authorities
            if required by law. We do not sell your personal information.
          </P>

          <H2>Data security</H2>
          <P>
            We take data security seriously and use industry-standard measures
            such as TLS/SSL encryption in transit and hashed credentials at
            rest. Our data is hosted by reputable providers in the United States
            and Canada that meet recognized security and compliance standards.
            If a breach creates a real risk of significant harm, we will notify
            affected individuals and regulators as soon as feasible after
            discovery.
          </P>

          <H2>Data retention</H2>
          <P>
            We retain personal information for as long as reasonably needed to
            operate Hack Western, support current and future events, and meet
            legal or operational requirements, unless you request deletion
            earlier. Deleted data may remain in backups for a short additional
            period before being purged.
          </P>

          <H2>Your rights</H2>

          <H3>Data ownership</H3>
          <P>
            You own your data. With proof of identity, you may email <Mail /> at
            any time to request that we provide, update, or delete the personal
            data we hold about you. We will comply within 30 days, barring legal
            requirements or exceptional circumstances.
          </P>

          <H3>Data freedom</H3>
          <P>You have several ways to limit what you share with us:</P>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-heavy">
            <li>
              <strong>Leave optional fields blank.</strong> You may skip any
              optional field in our forms. Fields marked as required are
              necessary for our operations; if you object to providing them, you
              may stop participating and request deletion of your data.
            </li>
            <li>
              <strong>Opt out of update emails.</strong> You can stop receiving
              our news and update emails at any time via the
              &ldquo;unsubscribe&rdquo; link at the bottom of any such email.
            </li>
            <li>
              <strong>Block analytics.</strong> You may use a browser extension
              to block anonymized analytics if you prefer.
            </li>
          </ul>

          <H2>Questions</H2>
          <P>
            We welcome feedback on our privacy practices. If you have any
            questions, concerns, or complaints, contact us at <Mail />.
          </P>
        </div>
      </div>
    </>
  );
}
