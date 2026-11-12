// TEMPORARY: put this at pages/dev/table-map.tsx while reviewing the map, then delete it.
import { TableMapDemo } from "~/components/judging/map/map-demo";
import { disabledRedirect } from "~/utils/redirect";

export default function TableMapPreviewPage() {
  return (
    <main className="min-h-dvh bg-dashboard-bg-page px-5 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <TableMapDemo />
      </div>
    </main>
  );
}

// Locked on production (hackwestern.com), open on preview and local builds.
export const getServerSideProps = disabledRedirect;
