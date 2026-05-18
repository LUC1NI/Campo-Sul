import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: {
    default: "CampoSul Agropecuária",
    template: "%s | CampoSul",
  },
  description:
    "Tradição e qualidade em produtos agropecuários para o Sul do Brasil.",
  keywords: ["agropecuária", "ração", "sementes", "insumos", "CampoSul"],
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce do CSP injetado pelo middleware. Usamos no <link> do Google Fonts
  // — embora style-src libere fonts.googleapis.com, alguns navegadores
  // bloqueiam o stylesheet sem nonce quando há nonce na política.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          nonce={nonce}
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
