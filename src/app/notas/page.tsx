export const dynamic = "force-dynamic";

import { AppLayout } from "@/components/app/app-layout";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDataHora } from "@/lib/format";
import { FileText, Receipt } from "lucide-react";
import { PdfLink } from "@/components/notas/pdf-link";
import { BotaoEmitirNF } from "@/components/notas/botao-emitir-nf";

async function getNotas() {
  return prisma.documento.findMany({
    orderBy: { emitidoEm: "desc" },
    take: 100,
    include: {
      venda: { select: { total: true, numero: true } },
      emitidoPor: { select: { nome: true } },
    },
  });
}

export default async function NotasPage() {
  const notas = await getNotas();
  const comErro = notas.filter((n) => n.statusDoc === "ERRO_PDF").length;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-fraunces text-2xl font-bold text-verde-mata">Notas e Recibos</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">{notas.length} documentos emitidos</p>
            {comErro > 0 && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <FileText className="w-3 h-3" />
                {comErro} com erro de PDF
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Documento</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {notas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Nenhum documento emitido ainda
                  </td>
                </tr>
              ) : (
                notas.map((nota) => (
                  <tr
                    key={nota.id}
                    className={`hover:bg-muted/30 transition-colors ${nota.statusDoc === "ERRO_PDF" ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium">
                        Nº {String(nota.numero).padStart(6, "0")} / {nota.serie}
                      </span>
                      <div className="text-xs text-muted-foreground">Venda #{nota.venda.numero}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {nota.tipo === "NOTA" ? (
                          <><FileText className="w-3.5 h-3.5 text-verde-claro" /><span>Nota Fiscal</span></>
                        ) : (
                          <><Receipt className="w-3.5 h-3.5 text-terra" /><span>Recibo</span></>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDataHora(nota.emitidoEm)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {nota.nomeCliente || nota.cpfCnpj || "Não identificado"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-verde-mata">
                      {formatBRL(Number(nota.venda.total))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <PdfLink
                          documentoId={nota.id}
                          tipo={nota.tipo}
                          numero={nota.numero}
                          statusDoc={nota.statusDoc}
                          erroInfo={nota.erroInfo}
                        />
                        {nota.tipo === "RECIBO" && (
                          <BotaoEmitirNF documentoId={nota.id} numeroRecibo={nota.numero} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
