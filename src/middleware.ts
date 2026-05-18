// Sem imports de Node — usa apenas Web APIs nativas do Edge runtime.
// Aqui acontecem 2 coisas:
//   1. Checagem rápida de cookie de sessão (defesa em profundidade — a
//      validação real do JWT acontece em auth() dentro do AppLayout/actions).
//   2. Geração de Content-Security-Policy com nonce por request (em produção).

import { NextResponse, type NextRequest } from "next/server";

const PROTEGIDAS = /^\/(dashboard|vendas|estoque|notas|relatorios|usuarios)/;

// CSP do landing/login (paths públicos) — pode ser idêntica à protegida;
// mantemos uma só por simplicidade.
function gerarCsp(nonce: string, isDev: boolean): string {
  const directives = [
    `default-src 'self'`,
    // 'strict-dynamic' faz o browser confiar nos scripts carregados pelos
    // scripts originais (Next.js cuida disso) — é a recomendação atual.
    // 'unsafe-eval' só em dev (Next HMR precisa).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React não consegue colocar nonce em `style={...}` props — mantemos
    // 'unsafe-inline'. É o padrão recomendado pelo próprio Next.js.
    // Google Fonts entrega CSS de fonts.googleapis.com.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https://images.unsplash.com`,
    // Google Fonts entrega TTF/WOFF de fonts.gstatic.com.
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `manifest-src 'self'`,
    // upgrade-insecure-requests só em produção (HTTPS).
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ];
  return directives.join("; ");
}

function gerarNonce(): string {
  // 16 bytes aleatórios → 128 bits de entropia (mais que suficiente).
  // btoa(String.fromCharCode(...)) é seguro no edge runtime.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
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

  // ── CSP com nonce ─────────────────────────────────────────────────────────
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = gerarNonce();
  const csp = gerarCsp(nonce, isDev);

  // Repassa o nonce em request headers — Next.js 15 lê `x-nonce` e injeta
  // automaticamente em todos os <script> que ele gera (RSC, chunks, hydration).
  // Em Server Components, dá pra ler com `headers().get("x-nonce")` caso
  // precise renderizar um script customizado.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
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
