import type { Instrumentation } from "next";

// Todo erro de servidor vira uma linha JSON nos logs do Vercel, com o mesmo `digest`
// que a tela de erro mostra ao usuário — o código que ele informar acha o erro aqui.
// ponytail: só logs do Vercel (retenção curta no Hobby); plugar Sentry aqui se precisar de alerta.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as Error & { digest?: string };
  console.error(
    JSON.stringify({
      nivel: "erro",
      digest: e.digest,
      mensagem: e.message,
      stack: e.stack?.split("\n").slice(0, 6).join("\n"),
      metodo: request.method,
      caminho: request.path.split("?")[0], // sem query: filtros podem ter nome/CPF de cliente
      rota: context.routePath,
      tipo: context.routeType,
    })
  );
};
