import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/settings(.*)", "/personas(.*)", "/products(.*)", "/generate(.*)", "/video-creator(.*)", "/history(.*)", "/slideshows(.*)", "/collections(.*)", "/admin(.*)"]);


export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname === "/dashboard") {
    const url = req.nextUrl.clone();
    url.pathname = "/generate";
    return NextResponse.redirect(url);
  }
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
