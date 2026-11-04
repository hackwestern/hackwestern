import { useRouter } from "next/router";
import Link from "next/link";
import SEO from "~/components/seo";
import { api } from "~/utils/api";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SponsorHubPage() {
  const router = useRouter();
  const rawId = (router.query.uuid ?? router.query.id) as string | undefined;
  const id = typeof rawId === "string" ? rawId : "";
  const validUuid = uuidRegex.test(id);

  const sponsorQ = api.sponsorJudging.getSponsorPortalInfo.useQuery(
    { sponsor: id },
    {
      enabled: validUuid,
      refetchOnWindowFocus: false,
    },
  );

  const data = sponsorQ.data;

  if (!router.isReady) {
    return (
      <Shell>
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-28 w-full animate-pulse rounded-3xl bg-[#e3e7ef]" />
          <div className="h-32 w-full animate-pulse rounded-2xl bg-[#e3e7ef]" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="h-24 w-full animate-pulse rounded-2xl bg-[#e3e7ef]" />
            <div className="h-24 w-full animate-pulse rounded-2xl bg-[#e3e7ef]" />
          </div>
        </div>
      </Shell>
    );
  }

  if (!validUuid || (sponsorQ.isError && sponsorQ.error.data?.code === "NOT_FOUND")) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="m-0 text-xl font-bold text-[#0b2238]">
            Link not recognised
          </h1>
          <p className="mb-0 mt-2 text-sm leading-relaxed text-[#4a5d73]">
            This private link isn&apos;t valid. If you believe this is an error,
            please reach out to your Hack Western organizer contact for assistance.
          </p>
        </div>
      </Shell>
    );
  }

  const sponsorName = data?.sponsorName ?? "Sponsor";
  const roomNumber = data?.roomNumber ?? "TBD";
  const boothLocation = data?.boothLocation ?? "TBD";
  const hwContact = data?.hwContact && data.hwContact !== "—" ? data.hwContact : null;
  const hwContactPhone = data?.hwContactPhone ?? null;
  const picksCount = data?.picksCount ?? 0;

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        {/* Greeting Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#5b3fa0] via-[#6f4bb8] to-[#9165cc] p-6 text-white shadow-md sm:p-7">
          <div className="relative z-10 flex flex-col gap-2">
            <div className="inline-flex items-center self-start rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold tracking-wide text-white backdrop-blur-sm">
              Hack Western 13
            </div>

            <h1 className="m-0 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[32px]">
              Welcome, {sponsorName}!
            </h1>

            <p className="m-0 text-[14px] leading-relaxed text-purple-100 sm:text-[15px]">
              We&apos;re thrilled to have you with us this weekend. Use this portal
              to check your booth and judging details and pick your top projects.
            </p>
          </div>

          {/* Decorative geometric blur circles */}
          <div className="pointer-events-none absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -top-12 right-16 h-36 w-36 rounded-full bg-purple-400/20 blur-xl" />
        </div>

        {/* Primary Action: Go to Picks Page */}
        <div className="rounded-2xl border-2 border-[#a16bc7]/40 bg-white p-5 shadow-sm transition hover:border-[#a16bc7]">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[12px] font-bold uppercase tracking-wider text-purple-700">
                  Judging
                </span>
                <h2 className="m-0 text-[19px] font-bold text-[#0b2238]">
                  Pick your top teams
                </h2>
              </div>

              {picksCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-bold text-emerald-800">
                  {picksCount} picked
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-[12px] font-bold text-purple-700">
                  Pending
                </span>
              )}
            </div>

            <p className="m-0 text-[14px] leading-relaxed text-[#4a5d73]">
              Select between 5 and 10 teams for your sponsored awards. You can
              update and save your selections anytime before judging closes.
            </p>

            <Link
              href={`/sponsors/${id}/picks`}
              className="mt-1 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5b3fa0] px-5 text-[16px] font-bold text-white shadow-sm transition hover:bg-[#4b3387] active:scale-[0.99]"
            >
              <span>{picksCount > 0 ? "Review & edit your picks" : "Select top teams"}</span>
              <span className="text-lg">→</span>
            </Link>
          </div>
        </div>

        {/* Venue & Event Logistics */}
        <div className="flex flex-col gap-2.5">
          <h3 className="m-0 text-[13px] font-bold uppercase tracking-wider text-slate-500">
            Event Details
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Booth Location */}
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                Booth Location
              </span>
              <span className="mt-1 text-[17px] font-bold text-[#0b2238]">
                {boothLocation}
              </span>
              <span className="mt-0.5 text-[12px] text-slate-500">
                {boothLocation === "TBD"
                  ? "Check in with your organizer on arrival"
                  : "Your assigned sponsor booth table"}
              </span>
            </div>

            {/* Judging Room */}
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                Judging Room
              </span>
              <span className="mt-1 text-[17px] font-bold text-[#0b2238]">
                {roomNumber === "TBD" ? "TBD" : `Room ${roomNumber}`}
              </span>
              <span className="mt-0.5 text-[12px] text-slate-500">
                {roomNumber === "TBD"
                  ? "Room assignment will be confirmed before judging"
                  : "Head here when judging deliberations start"}
              </span>
            </div>
          </div>

          {/* Hack Western Contact Card */}
          <div className="flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                Your Hack Western Contact
              </span>
              <span className="mt-1 text-[16px] font-bold text-[#0b2238]">
                {hwContact ?? "Hack Western Organizer Team"}
              </span>
              {hwContact && hwContactPhone && (
                <a
                  href={`tel:${hwContactPhone.replace(/[^\d+]/g, "")}`}
                  className="mt-0.5 text-[14px] font-semibold text-[#5b3fa0] underline-offset-2 hover:underline"
                >
                  {hwContactPhone}
                </a>
              )}
            </div>

            <span className="self-start rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 sm:self-auto">
              On-Site Support
            </span>
          </div>
        </div>

        {/* Footer Note */}
        <p className="m-0 mt-2 text-center text-[12px] leading-relaxed text-[#4a5d73]">
          Need immediate assistance during the hackathon? Reach out to your HW
          contact.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SEO title="Sponsor Portal" noindex />
      <div className="min-h-screen bg-[#eef1f6] px-4 pb-12 pt-6 font-figtree text-[#0b2238] sm:px-5">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
          <header className="flex items-center justify-between">
            <span className="text-[15px] font-extrabold tracking-tight text-[#0b2238]">
              Hack Western 13
            </span>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
