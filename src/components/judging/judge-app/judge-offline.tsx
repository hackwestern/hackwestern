import { useEffect, useState } from "react";

import { warningBanner } from "~/components/judging/shared/judge-ui";

/** Whether the phone thinks it has a connection. Assumes yes until told. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** Tells the judge a score can't be sent yet. Their answers stay on the phone. */
export function JudgeOfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <p role="status" className={warningBanner}>
      You&apos;re offline. Your answers are saved on this phone, but scores
      can&apos;t be sent until you&apos;re back online.
    </p>
  );
}