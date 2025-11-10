import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected routes
  const protectedRoutes = [
    "/dashboard",
    "/chatbot",
    "/upload",
    "/topic",
    "/state",
    "/district",
  ];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If authenticated, allow access
  if (token) {
    return NextResponse.next();
  }

  // Check if guest mode is enabled (check via cookie or header)
  const guestModeCookie = request.cookies.get("guest_mode_enabled");

  // For guest mode, we'll check the settings via a special header or cookie
  // Since we can't access localStorage in middleware, we'll allow access if coming from landing page
  const referer = request.headers.get("referer");
  const isFromLandingPage = referer?.includes(request.nextUrl.origin);

  // If guest mode cookie exists or coming from landing page with guest param, allow access
  const searchParams = request.nextUrl.searchParams;
  const isGuestAccess = searchParams.get("guest") === "true";

  if (isGuestAccess || guestModeCookie) {
    // Set a cookie to remember guest mode for this session
    const response = NextResponse.next();
    response.cookies.set("guest_mode_enabled", "true", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });
    return response;
  }

  // Not authenticated and not guest mode - redirect to sign in
  const signInUrl = new URL("/api/auth/signin", request.url);
  signInUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/chatbot/:path*",
    "/upload/:path*",
    "/topic/:path*",
    "/state/:path*",
    "/district/:path*",
  ],
};
