"use client";

import Link from "next/link";

// Erro em qualquer página do sistema: o menu continua na tela e dá pra tentar de novo.
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-fraunces text-2xl text-verde-mata">Algo deu errado</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Não foi possível carregar esta tela. Verifique a internet e tente de novo. Se continuar,
        avise o suporte informando o código abaixo.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">Código: {error.digest}</p>
      )}
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-verde-mata px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-verde-claro"
        >
          Tentar de novo
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-verde-mata transition-colors hover:bg-verde-mata/10"
        >
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
