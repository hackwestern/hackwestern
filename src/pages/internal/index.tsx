import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "~/components/ui/button";
import { authRedirect } from "~/utils/redirect";

const Internal = () => {
  const router = useRouter();

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#160524]">
        <div className="flex flex-col gap-3">
          <Button onClick={() => router.push("/internal/review")}>
            Review
          </Button>
          <PreregistrationsButton />
          <ApplicationsButton />
        </div>
      </main>
    </>
  );
}

/**
 * Downloads the CSV if authorized as an organizer.
 * @see ./api/application/all.tswsl --set-default-version 2
 */
function ApplicationsButton() {
  return (
    <Link
      href="/api/application/all?format=csv&mlh"
      className="rounded bg-white p-1 text-center"
    >
      Export Applications
    </Link>
  );
}

/**
 * Downloads the CSV if authorized as an organizer.
 * @see ./api/preregistration/all.ts
 */
function PreregistrationsButton() {
  return (
    <Link
      href="/api/preregistration/all?format=csv"
      className="rounded bg-white p-1 text-center"
    >
      Export Preregistrations
    </Link>
  );
}

export const getServerSideProps = authRedirect;

export default Internal;