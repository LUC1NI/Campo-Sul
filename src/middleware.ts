import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROTAS_PROTEGIDAS = [
  "/dashboard",
  "/vendas",
  "/estoque",
  "/notas",
  "/relatorios",
  "/usuarios",
];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Auth.js v5 usa __Secure- prefix em produção (HTTPS) e sem prefix em dev
  const sessionCookie =
    req.cookies.get("__Secure-authjs.session-token") ??
    req.cookies.get("authjs.session-token");

  const isLoggedIn = !!sessionCookie?.value;
  const isProtected = ROTAS_PROTEGIDAS.some((r) => path.startsWith(r));

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (path === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
