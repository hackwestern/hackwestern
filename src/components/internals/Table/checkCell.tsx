import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { CheckDetail } from "~/lib/cheat-checks/types";

type CheckCellProps = {
    check?: CheckDetail
}

export default function CheckCell ({check} : CheckCellProps){
    if (!check){
        return <span>-</span>
    }

    return(
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button className="font-bold">
          {check.passed ? "✓" : "✗"}
        </button>
      </TooltipTrigger>

      <TooltipContent className="max-w-sm">
        <div className="space-y-1 text-sm">
          <p>
            <strong>Result:</strong>{" "}
            {check.passed ? "Passed" : "Failed"}
          </p>

          <p>
            <strong>Checked at:</strong>{" "}
            {new Date(check.checkedAt).toLocaleString("en-CA", {
                dateStyle: "medium",
                timeStyle: "short",
                })}
          </p>

          <p>
            <strong>Checked by:</strong>{" "}
            {check.checkedbyName}
          </p>

          {check.manualOverride !== null && (
            <p>
              <strong>Override:</strong>{" "}
              {check.manualOverride ? "Yes" : "No"}
            </p>
          )}

          {check.notes && (
            <p>
              <strong>Notes:</strong> {check.notes}
            </p>
          )}
          
        </div>
      </TooltipContent>
    </Tooltip>
    )
}