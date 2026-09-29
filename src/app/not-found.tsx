import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-off-white px-4 text-center">
      <h1 className="font-fraunces text-3xl text-verde-mata">Página não encontrada</h1>
      <p className="mt-3 text-sm text-muted-foreground">O endereço pode estar errado ou a página foi removida.</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-verde-mata px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-verde-claro"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
