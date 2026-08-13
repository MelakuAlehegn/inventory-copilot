import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Route protection: unauthenticated users can only reach /login; logged-in users on /login
// are sent to the app. Everything else requires a session.
export default auth((req) => {
  const loggedIn = !!req.auth;
  const onLogin = req.nextUrl.pathname.startsWith("/login");

  if (!loggedIn && !onLogin) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  if (loggedIn && onLogin) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icons).*)"],
};
