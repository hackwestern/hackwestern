import { Download } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  buildDetailedCsv,
  buildEmailCsv,
  buildScenarioJson,
  datedFilename,
  downloadTextFile,
} from "../export";
import type { RankedApplicant, RankingScenario } from "../types";

type ExportPanelProps = {
  appliedScenario: RankingScenario;
  appliedApplicants: RankedApplicant[];
};

export function ExportPanel({
  appliedScenario,
  appliedApplicants,
}: ExportPanelProps) {
  const exportCount = Math.min(
    appliedScenario.exportCount,
    appliedApplicants.length,
  );
  const exportApplicants = appliedApplicants.slice(0, exportCount);
  const disabled = exportApplicants.length === 0;

  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#3b294f]">Export</h3>
          <p className="mt-1 text-sm text-gray-500">
            Exporting top {exportCount} from weighted scenario:{" "}
            {appliedScenario.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            disabled={disabled}
            onClick={() =>
              downloadTextFile(
                buildEmailCsv(exportApplicants),
                datedFilename(`rankingsv2-emails-top${exportCount}`, "csv"),
                "text/csv",
              )
            }
          >
            <Download className="h-4 w-4" />
            Emails
          </Button>
          <Button
            variant="primary"
            disabled={disabled}
            onClick={() =>
              downloadTextFile(
                buildDetailedCsv(exportApplicants),
                datedFilename(`rankingsv2-detailed-top${exportCount}`, "csv"),
                "text/csv",
              )
            }
          >
            <Download className="h-4 w-4" />
            Detailed CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              downloadTextFile(
                buildScenarioJson(appliedScenario),
                datedFilename("rankingsv2-scenario", "json"),
                "application/json",
              )
            }
          >
            Scenario JSON
          </Button>
        </div>
      </div>
    </section>
  );
}
