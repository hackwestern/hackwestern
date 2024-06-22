import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { DM_Sans } from "next/font/google";

import { api } from "~/utils/api";

import "~/styles/globals.css";

const DM_SANS = DM_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  fallback: ["Inter", "sans-serif"],
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <main className={`${DM_SANS.className}`}>
        <Component {...pageProps} />
      </main>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
