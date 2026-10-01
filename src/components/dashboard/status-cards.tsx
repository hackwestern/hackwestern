import * as React from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";

export interface StatusCardProps {
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

function StatusCard({ title, description, primaryAction }: StatusCardProps) {
  return (
    <div className="flex max-w-[440px] flex-col items-start gap-6 text-white">
      <h1 className="font-primary text-[36px] font-bold leading-tight text-highlight">
        {title}
      </h1>
      <p className="font-figtree text-md-p text-highlight">{description}</p>
      {primaryAction && (
        <div className="mt-2">
          {primaryAction.href ? (
            <Button asChild variant="primary" size="lg">
              <Link href={primaryAction.href}>{primaryAction.label}</Link>
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function SubmittedStatusCard() {
  return (
    <StatusCard
      title="Your application has been submitted"
      description="Thank you for applying to Hack Western 13! A copy of your responses has been sent to your email."
      primaryAction={{ label: "Return home", href: "/" }}
    />
  );
}

export function AcceptedStatusCard({ onRsvp }: { onRsvp?: () => void }) {
  return (
    <StatusCard
      title="You're in — welcome to Hack Western 13!"
      description="We can't wait to see what you build. RSVP below to lock in your spot for the weekend."
      primaryAction={onRsvp ? { label: "RSVP", onClick: onRsvp } : undefined}
    />
  );
}

export function NotSubmittedStatusCard() {
  return (
    <StatusCard
      title="Applications are closed"
      description="We didn't receive a submitted application from you before the deadline. We hope to see you at the next Hack Western!"
      primaryAction={{ label: "Return home", href: "/" }}
    />
  );
}

export function WaitlistedStatusCard() {
  return (
    <StatusCard
      title="You're on the waitlist"
      description="Spots open up as accepted hackers finalize their plans. We'll email you as soon as we can make room."
    />
  );
}

export function DeclinedStatusCard() {
  return (
    <StatusCard
      title="Application decision"
      description="Thank you for applying to Hack Western 13. Unfortunately we can't offer you a spot this year — hope to see your application again next year!"
      primaryAction={{ label: "Return home", href: "/" }}
    />
  );
}
