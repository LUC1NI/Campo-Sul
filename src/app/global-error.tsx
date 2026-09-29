"use client";

// Último recurso: erro no layout raiz. Precisa do próprio <html>/<body> e não usa o CSS do app.
export default function ErroGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#faf7f0", color: "#2d4a2b", textAlign: "center", padding: "4rem 1rem" }}>
        <h1>Algo deu errado</h1>
        <p>Não foi possível carregar o sistema. Tente de novo em instantes.</p>
        {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12 }}>Código: {error.digest}</p>}
        <button
          onClick={reset}
          style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, border: 0, background: "#2d4a2b", color: "#fff", cursor: "pointer" }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
