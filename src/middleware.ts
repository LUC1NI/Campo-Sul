// Sem imports de Node — usa apenas Web APIs nativas do Edge runtime.
// Aqui acontecem 2 coisas:
//   1. Checagem rápida de cookie de sessão (defesa em profundidade — a
//      validação real do JWT acontece em auth() dentro do (app)/layout.
//   2. Aplicação do Content-Security-Policy em todas as respostas.

import { NextResponse, type NextRequest } from "next/server";

const PROTEGIDAS = /^\/(dashboard|vendas|estoque|notas|relatorios|usuarios)/;

// CSP do landing/login (paths públicos) — pode ser idêntica à protegida;
// mantemos uma só por simplicidade.
function gerarCsp(isDev: boolean): string {
  const directives = [
    `default-src 'self'`,
    // 'unsafe-inline' é necessário porque o Next.js 15 não aplica nonce
    // de forma confiável em todos os inline scripts (especialmente em
    // páginas que misturam SSG/dynamic). Mantemos 'self' pra bloquear
    // script de host externo. 'unsafe-eval' só em dev (Next HMR precisa).
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    // React não consegue colocar nonce em `style={...}` props — mantemos
    // 'unsafe-inline'. Google Fonts entrega CSS de fonts.googleapis.com.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https://images.unsplash.com https://*.googleusercontent.com https://*.gstatic.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    // Iframe do Google Maps na landing.
    `frame-src 'self' https://www.google.com https://maps.google.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `manifest-src 'self'`,
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ];
  return directives.join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookie = request.headers.get("cookie") ?? "";

  // Auth.js v5: cookie sem prefixo em HTTP (dev) e com __Secure- em HTTPS.
  const isLoggedIn =
    cookie.includes("__Secure-authjs.session-token=") ||
    cookie.includes("authjs.session-token=");

  // Redirecionamentos de auth (sem CSP — são respostas curtas)
  if (PROTEGIDAS.test(pathname) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── CSP ─────────────────────────────────────────────────────────────────
  const isDev = process.env.NODE_ENV !== "production";
  const csp = gerarCsp(isDev);

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    // Roda em tudo exceto assets estáticos e arquivos com extensão.
    // CSP em JSON/imagens não atrapalha (browsers ignoram), mas evitamos
    // o overhead de gerar nonce em cada PNG.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
