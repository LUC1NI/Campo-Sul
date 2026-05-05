// Sem imports — usa apenas Web APIs nativas do Edge runtime
// A validação real do JWT acontece no AppLayout (auth()) e nas Server Actions

const PROTEGIDAS = /^\/(dashboard|vendas|estoque|notas|relatorios|usuarios)/;

export function middleware(request: Request) {
  const { pathname } = new URL(request.url);
  const cookie = request.headers.get("cookie") ?? "";

  // Auth.js v5: cookie sem prefixo em HTTP (dev) e com __Secure- em HTTPS (prod)
  const isLoggedIn =
    cookie.includes("__Secure-authjs.session-token=") ||
    cookie.includes("authjs.session-token=");

  if (PROTEGIDAS.test(pathname) && !isLoggedIn) {
    return Response.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && isLoggedIn) {
    return Response.redirect(new URL("/dashboard", request.url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
