import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "~/components/ui/button";
import { authRedirect } from "~/utils/redirect";

const Internal = () => {
  const router = useRouter();

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#160524]">
        <h1 className="text-white text-3xl mb-5">
          Internal Dashboard
        </h1>
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => router.push("/internal/review")}
            className="rounded bg-white p-1 text-center text-black hover:bg-gray-300"
          >
            Review Portal
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
    >
      <Button
        className="rounded bg-white p-1 text-center text-black hover:bg-gray-300 w-max w-full"
      >
        Export Applications
      </Button>
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
    >
      <Button
        className="rounded bg-white p-1 text-center text-black hover:bg-gray-300 mx-auto"
      >
        Export Preregistrations
      </Button>
    </Link>
  );
}

export const getServerSideProps = authRedirect;

export default Internal;