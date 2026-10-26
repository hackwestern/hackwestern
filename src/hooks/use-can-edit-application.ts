import { useEffect, useState } from "react";
import { APPLICATION_DEADLINE } from "~/lib/date";

/** Whether an application in this status can still be changed at `now`. */
export function canEditApplication(status: string, now: number) {
  const editable = status === "NOT_STARTED" || status === "IN_PROGRESS";
  return editable && now < APPLICATION_DEADLINE.getTime();
}

/** False once the deadline passes, even on a page that was opened before it. */
export function useApplicationsOpen() {
  return useOpenUntil(APPLICATION_DEADLINE);
}

/** True until `deadline`, even on a page that was opened before it. */
export function useOpenUntil(deadline: Date) {
  // Start open and check after mount, so the server render and the first
  // client render agree. The server refuses late saves either way.
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const check = () => {
      const stillOpen = Date.now() < deadline.getTime();
      setOpen(stillOpen);
      if (!stillOpen && id) clearInterval(id);
      return stillOpen;
    };
    if (check()) id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, [deadline]);

  return open;
}

/** The apply forms' "can edit" check: right status, and applications still open. */
export function useCanEditApplication(status: string) {
  const open = useApplicationsOpen();
  return open && canEditApplication(status, Date.now());
}
