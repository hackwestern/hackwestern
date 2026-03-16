import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const rawPath = url.pathname;

  // Intercept PDF requests in the public folder
  if (rawPath.toLowerCase().endsWith(".pdf")) {
    // --- Sticky visitor identification ---
    let visitorId = request.cookies.get("hw_visitor")?.value;
    const isNewVisitor = !visitorId;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
    }

    // Fire-and-forget: call the tracker API in the background
    // The PDF is served immediately — tracking never blocks the user
    const trackingUrl = new URL("/api/tracker", request.url);
    trackingUrl.searchParams.set("file", rawPath);
    trackingUrl.searchParams.set("vid", visitorId);
    trackingUrl.searchParams.set("ref", request.headers.get("referer") ?? "");

    void fetch(trackingUrl.toString(), {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        "user-agent": request.headers.get("user-agent") ?? "",
        "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
        "x-vercel-ip-city": request.headers.get("x-vercel-ip-city") ?? "",
        "x-vercel-ip-country-region":
          request.headers.get("x-vercel-ip-country-region") ?? "",
        "x-vercel-ip-country": request.headers.get("x-vercel-ip-country") ?? "",
        "x-vercel-ip-latitude":
          request.headers.get("x-vercel-ip-latitude") ?? "",
        "x-vercel-ip-longitude":
          request.headers.get("x-vercel-ip-longitude") ?? "",
      },
    }).catch((e) => console.error("[tracker] fetch failed:", e));

    // Serve the PDF immediately
    const response = NextResponse.next();

    // Set the persistent hw_visitor cookie on first visit
    if (isNewVisitor) {
      response.cookies.set("hw_visitor", visitorId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*.pdf$)"],
};
