import React from "react";
import { useRouter } from "next/router";

export function usePendingNavigation() {
    const router = useRouter();
    const [pending, setPending] = React.useState(false);

    React.useEffect(() => {
        const handleComplete = () => setPending(false);
        const handleError = () => setPending(false);

        router.events.on("routeChangeComplete", handleComplete);
        router.events.on("routeChangeError", handleError);

        return () => {
            router.events.off("routeChangeComplete", handleComplete);
            router.events.off("routeChangeError", handleError);
        };
    }, [router.events]);

    const navigate = (path: string) => {
        setPending(true);
        void router.push(path).catch(() => setPending(false));
    };

    return { pending, navigate, setPending } as const;
}
