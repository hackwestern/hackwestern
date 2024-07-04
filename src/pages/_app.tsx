import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { DM_Sans, Salsa } from "next/font/google";
import localFont from "next/font/local";

import { api } from "~/utils/api";

import "~/styles/globals.css";

const DM_SANS = DM_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-dmsans",
  fallback: ["Inter", "sans-serif"],
});

const SalsaFont = Salsa({
  subsets: ["latin"],
  variable: "--font-salsa",
  weight: "400",
});

const MagicRetro = localFont({
  src: "../../public/fonts/magic_retro/MagicRetro.ttf",
  variable: "--font-magicretro",
  display: "swap",
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <main
        className={`${MagicRetro.variable} ${DM_SANS.variable} font-DM_Sans`}
      >
        <Component {...pageProps} />
      </main>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
