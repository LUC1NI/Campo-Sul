"use server";

import { prisma, transacaoSerializavel } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Unidade } from "@prisma/client";
import { parseNfeXml, type NfeParseResult } from "@/lib/nfe-xml-parser";
import { tokenizarNome, mesmoNome, melhoresCandidatos, semTokens } from "@/lib/nfe-correspondencia";
import { Decimal } from "decimal.js";
import { requireAdmin, runAction } from "@/lib/auth-helpers";

function mapUnidade(uCom: string): Unidade {
  const u = uCom.toUpperCase().trim();
  if (["KG", "GR", "G", "GRAMA", "GRAMAS"].includes(u)) return "KG";
  if (["L", "LT", "LTR", "ML", "LITRO", "LITROS"].includes(u)) return "L";
  if (["SC", "SAC", "SACO", "SACOS"].includes(u)) return "SACO";
  if (["CX", "CX.", "CAIXA", "CAIXAS"].includes(u)) return "CX";
  if (["M", "MT", "METRO", "METROS"].includes(u)) return "M";
  return "UN";
}

/** Grama/mililitro viram KG/L: quantidade ÷1000 e preço unitário ×1000. */
function fatorConversao(uCom: string): number {
  return ["GR", "G", "GRAMA", "GRAMAS", "ML"].includes(uCom.toUpperCase().trim()) ? 1000 : 1;
}

/** Itens da nota já normalizados (unidade do sistema). Usado no preview E na confirmação. */
function itensDaNota(parsed: NfeParseResult) {
  return parsed.itens.map((item) => {
    const fator = fatorConversao(item.unidadeComercial);
    return {
      codigoFornecedor: item.codigoFornecedor,
      gtin: item.gtin,
      descricao: item.descricao,
      unidadeNfe: item.unidadeComercial,
      unidadeMapeada: mapUnidade(item.unidadeComercial),
      quantidade: new Decimal(item.quantidade).div(fator).toFixed(4),
      valorUnitario: new Decimal(item.valorUnitario).times(fator).toFixed(4),
      valorTotal: item.valorTotal,
    };
  });
}

const SELECT_PRODUTO = {
  id: true,
  codigo: true,
  nome: true,
  unidade: true,
  podeFracionar: true,
  pesoUnidade: true,
  unidadeFracao: true,
  precoCusto: true,
  quantidade: true,
  ativo: true,
} as const;

type ProdutoDb = {
  id: string;
  codigo: string;
  nome: string;
  unidade: Unidade;
  podeFracionar: boolean;
  pesoUnidade: { toString(): string } | null;
  unidadeFracao: Unidade | null;
  precoCusto: { toString(): string };
  quantidade: { toString(): string };
  ativo: boolean;
};

export interface ProdutoResumo {
  id: string;
  codigo: string;
  nome: string;
  unidade: Unidade;
  podeFracionar: boolean;
  pesoUnidade: string | null;
  unidadeFracao: Unidade | null;
  precoCusto: string;
  quantidade: string;
  ativo: boolean;
}

function resumo(p: ProdutoDb): ProdutoResumo {
  return {
    ...p,
    pesoUnidade: p.pesoUnidade?.toString() ?? null,
    precoCusto: p.precoCusto.toString(),
    quantidade: p.quantidade.toString(),
  };
}

/** Como o item foi reconhecido: código de barras, código do fornecedor (aprendido) ou nome idêntico. */
export type MetodoVinculo = "gtin" | "fornecedor" | "nome";

export interface ItemPreview {
  codigoFornecedor: string | null;
  gtin: string | null;
  descricao: string;
  unidadeNfe: string;
  unidadeMapeada: Unidade;
  quantidade: string;
  valorUnitario: string;
  valorTotal: string;
  vinculo: { produto: ProdutoResumo; metodo: MetodoVinculo } | null;
  /** Nomes parecidos — só preenchido quando não há vínculo. Exige confirmação do usuário. */
  sugestoes: (ProdutoResumo & { score: number })[];
  /** Conversão usada da última vez que esse código do fornecedor entrou (estoque ÷ nota). */
  fatorHistorico: { produtoId: string; fator: string } | null;
}

export interface XmlPreview {
  chaveAcesso: string;
  numeroNf: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  valorTotal: string;
  jaImportada: boolean;
  itens: ItemPreview[];
}

const MAX_XML_BYTES = 5 * 1024 * 1024; // 5 MB

function validarTamanho(xmlContent: unknown): string | null {
  if (typeof xmlContent !== "string" || xmlContent.length === 0) return "XML vazio";
  if (Buffer.byteLength(xmlContent, "utf8") > MAX_XML_BYTES) return "Arquivo XML muito grande (máx. 5 MB)";
  return null;
}

export async function parsearXml(
  xmlContent: string
): Promise<{ ok: true; data: XmlPreview } | { ok: false; erro: string }> {
  await requireAdmin();
  const erroTamanho = validarTamanho(xmlContent);
  if (erroTamanho) return { ok: false, erro: erroTamanho };

  let parsed: NfeParseResult;
  try {
    parsed = parseNfeXml(xmlContent);
  } catch (err) {
    console.error("[xml] parseError", err);
    return { ok: false, erro: err instanceof Error ? err.message.slice(0, 200) : "Erro ao processar XML" };
  }

  return runAction("parsearXml", async () => {
    const itens = itensDaNota(parsed);
    const gtins = [...new Set(itens.map((i) => i.gtin).filter((g): g is string => !!g))];
    const codigos = [...new Set(itens.map((i) => i.codigoFornecedor).filter((c): c is string => !!c))];

    const [existente, porGtin, memoria] = await Promise.all([
      prisma.entradaXml.findUnique({ where: { chaveAcesso: parsed.chaveAcesso }, select: { id: true } }),
      gtins.length
        ? // Sem filtro de ativo: produto desativado com o mesmo GTIN é reaproveitado (e reativado).
          prisma.produto.findMany({ where: { gtin: { in: gtins }, deletedAt: null }, select: { ...SELECT_PRODUTO, gtin: true } })
        : [],
      codigos.length
        ? prisma.itemEntradaXml.findMany({
            where: {
              codigoFornecedor: { in: codigos },
              entrada: { cnpjEmitente: parsed.cnpjEmitente },
              produto: { deletedAt: null },
            },
            orderBy: { entrada: { importadoEm: "desc" } },
            select: { codigoFornecedor: true, fatorConversao: true, produto: { select: SELECT_PRODUTO } },
          })
        : [],
    ]);

    const gtinMap = new Map(porGtin.map((p) => [p.gtin!, p]));
    const memoriaMap = new Map<string, (typeof memoria)[number]>();
    for (const m of memoria) if (!memoriaMap.has(m.codigoFornecedor!)) memoriaMap.set(m.codigoFornecedor!, m);

    const semVinculo = itens.some(
      (i) => !(i.gtin && gtinMap.has(i.gtin)) && !(i.codigoFornecedor && memoriaMap.has(i.codigoFornecedor))
    );
    const catalogo = semVinculo
      ? (await prisma.produto.findMany({ where: { deletedAt: null }, select: SELECT_PRODUTO })).map((p) => ({
          ...resumo(p),
          tokens: tokenizarNome(p.nome),
        }))
      : [];

    const itensPreview: ItemPreview[] = itens.map((item) => {
      const mem = item.codigoFornecedor ? memoriaMap.get(item.codigoFornecedor) : undefined;
      const fatorHistorico =
        mem?.produto ? { produtoId: mem.produto.id, fator: mem.fatorConversao.toString() } : null;
      const base = { ...item, sugestoes: [], fatorHistorico };

      const porCodigoBarras = item.gtin ? gtinMap.get(item.gtin) : undefined;
      if (porCodigoBarras) return { ...base, vinculo: { produto: resumo(porCodigoBarras), metodo: "gtin" as const } };
      if (mem?.produto) return { ...base, vinculo: { produto: resumo(mem.produto), metodo: "fornecedor" as const } };

      const alvo = tokenizarNome(item.descricao);
      const iguais = catalogo.filter((p) => mesmoNome(alvo, p.tokens));
      if (iguais.length === 1) return { ...base, vinculo: { produto: semTokens(iguais[0]), metodo: "nome" as const } };
      return { ...base, vinculo: null, sugestoes: melhoresCandidatos(item.descricao, catalogo) };
    });

    return {
      chaveAcesso: parsed.chaveAcesso,
      numeroNf: parsed.numeroNf,
      cnpjEmitente: parsed.cnpjEmitente,
      nomeEmitente: parsed.nomeEmitente,
      valorTotal: parsed.valorTotal,
      jaImportada: !!existente,
      itens: itensPreview,
    };
  });
}

const decimalPositivo = z.string().max(20).regex(/^\d+(\.\d+)?$/, "Valor numérico inválido");

/**
 * Só as DECISÕES vêm do navegador (qual produto, quanto entra no estoque, preço de venda).
 * Quantidades, valores e códigos são relidos do XML no servidor.
 */
const decisaoSchema = z.object({
  produtoId: z.string().cuid().nullable(),
  /** Quantidade que entra no estoque, na unidade do produto. Obrigatória p/ produto existente. */
  qtdEstoque: decimalPositivo.optional(),
  precoVenda: decimalPositivo.optional(),
  categoriaId: z.string().cuid().nullable().optional(),
});

const confirmarSchema = z.object({
  xmlOriginal: z.string().max(MAX_XML_BYTES),
  itens: z.array(decisaoSchema).min(1).max(500),
});

export type ConfirmarImportacaoInput = z.infer<typeof confirmarSchema>;
export type ConfirmarImportacaoResultado = { novos: number; atualizados: number; custosAtualizados: number };

export async function confirmarImportacaoXml(
  input: ConfirmarImportacaoInput
): Promise<({ ok: true } & ConfirmarImportacaoResultado) | { ok: false; erro: string }> {
  const r = await runAction("confirmarImportacaoXml", async () => {
    const user = await requireAdmin();
    const data = confirmarSchema.parse(input);
    const erroTamanho = validarTamanho(data.xmlOriginal);
    if (erroTamanho) throw new Error(erroTamanho);

    const parsed = parseNfeXml(data.xmlOriginal);
    const itens = itensDaNota(parsed);
    if (itens.length !== data.itens.length) throw new Error("A nota não confere com a revisão. Carregue o XML de novo.");

    const linhas = itens.map((item, idx) => {
      const d = data.itens[idx];
      if (d.produtoId) {
        if (!d.qtdEstoque || new Decimal(d.qtdEstoque).lte(0)) {
          throw new Error(`Informe quanto entra no estoque para: ${item.descricao}`);
        }
        return { ...item, ...d, qtdEstoque: d.qtdEstoque };
      }
      if (!d.precoVenda || new Decimal(d.precoVenda).lte(0)) {
        throw new Error(`Informe o preço de venda para: ${item.descricao}`);
      }
      return { ...item, ...d, qtdEstoque: item.quantidade }; // produto novo nasce na unidade da nota
    });

    const existente = await prisma.entradaXml.findUnique({
      where: { chaveAcesso: parsed.chaveAcesso },
      select: { id: true },
    });
    if (existente) throw new Error("Esta NF-e já foi importada anteriormente.");

    const resultado = await transacaoSerializavel(async (tx) => {
      const idsEscolhidos = [...new Set(linhas.map((l) => l.produtoId).filter((id): id is string => !!id))];
      const escolhidos = await tx.produto.findMany({
        where: { id: { in: idsEscolhidos }, deletedAt: null },
        select: { id: true, gtin: true, quantidade: true },
      });
      if (escolhidos.length !== idsEscolhidos.length) {
        throw new Error("Um dos produtos escolhidos foi excluído. Revise a nota de novo.");
      }

      // GTINs já usados por QUALQUER produto (inclusive excluídos — o índice é único).
      const gtinsNota = [...new Set(linhas.map((l) => l.gtin).filter((g): g is string => !!g))];
      const gtinsOcupados = new Set(
        gtinsNota.length
          ? (await tx.produto.findMany({ where: { gtin: { in: gtinsNota } }, select: { gtin: true } })).map((p) => p.gtin!)
          : []
      );

      const entrada = await tx.entradaXml.create({
        data: {
          chaveAcesso: parsed.chaveAcesso,
          numeroNf: parsed.numeroNf,
          cnpjEmitente: parsed.cnpjEmitente,
          nomeEmitente: parsed.nomeEmitente,
          valorTotal: parsed.valorTotal,
          xmlOriginal: data.xmlOriginal,
          importadoPorId: user.id,
        },
      });

      // --- 1. Produtos novos: o mesmo GTIN/código do fornecedor repetido na nota cria um só ---
      const chaveNovo = (l: (typeof linhas)[number], idx: number) =>
        l.gtin ? `g:${l.gtin}` : l.codigoFornecedor ? `f:${l.codigoFornecedor}` : `i:${idx}`;
      const primeiroPorChave = new Map<string, number>();
      linhas.forEach((l, idx) => {
        if (!l.produtoId && !primeiroPorChave.has(chaveNovo(l, idx))) primeiroPorChave.set(chaveNovo(l, idx), idx);
      });
      const criados = await Promise.all(
        [...primeiroPorChave.values()].map(async (idx) => {
          const l = linhas[idx];
          const p = await tx.produto.create({
            data: {
              codigo: `IMP-${parsed.chaveAcesso.slice(-8)}-${String(idx + 1).padStart(3, "0")}`,
              gtin: l.gtin && !gtinsOcupados.has(l.gtin) ? l.gtin : null,
              nome: l.descricao.slice(0, 200),
              unidade: l.unidadeMapeada,
              precoCusto: l.valorUnitario,
              precoVenda: l.precoVenda!,
              categoriaId: l.categoriaId ?? null,
              quantidade: "0",
            },
            select: { id: true },
          });
          if (l.gtin) gtinsOcupados.add(l.gtin);
          return [idx, p.id] as const;
        })
      );
      const idCriado = new Map(criados);
      const finais = linhas.map((l, idx) => ({
        ...l,
        vinculado: !!l.produtoId, // escolhido pelo usuário (existente) × criado nesta nota
        produtoId: l.produtoId ?? idCriado.get(primeiroPorChave.get(chaveNovo(l, idx))!)!,
        criouProduto: idCriado.has(idx),
        custoUnitario: new Decimal(l.valorTotal).div(l.qtdEstoque).toDecimalPlaces(4),
        fator: new Decimal(l.qtdEstoque).div(l.quantidade).toDecimalPlaces(6),
      }));

      // --- 2. Existentes desativados voltam a ficar ativos ao receber estoque ---
      if (idsEscolhidos.length) {
        await tx.produto.updateMany({ where: { id: { in: idsEscolhidos }, ativo: false }, data: { ativo: true } });
      }

      // --- 3. Estoque somado por produto + custo da última nota + GTIN aprendido ---
      const estoqueAtual = new Map(escolhidos.map((p) => [p.id, new Decimal(p.quantidade.toString())]));
      const gtinAtual = new Map(escolhidos.map((p) => [p.id, p.gtin]));
      const porProduto = new Map<string, { qtd: Decimal; custo?: Decimal; gtin?: string }>();
      for (const f of finais) {
        const acc = porProduto.get(f.produtoId) ?? { qtd: estoqueAtual.get(f.produtoId) ?? new Decimal(0) };
        acc.qtd = acc.qtd.plus(f.qtdEstoque);
        if (f.vinculado) acc.custo = f.custoUnitario;
        if (f.vinculado && f.gtin && !gtinAtual.get(f.produtoId) && !acc.gtin && !gtinsOcupados.has(f.gtin)) {
          acc.gtin = f.gtin;
          gtinsOcupados.add(f.gtin);
        }
        porProduto.set(f.produtoId, acc);
      }
      await Promise.all(
        [...porProduto].map(([id, a]) =>
          tx.produto.update({
            where: { id },
            data: {
              quantidade: a.qtd.toFixed(4),
              ...(a.custo ? { precoCusto: a.custo.toFixed(4) } : {}),
              ...(a.gtin ? { gtin: a.gtin } : {}),
            },
          })
        )
      );

      // --- 4. Histórico: movimentos de estoque + itens da entrada (memória do fornecedor) ---
      await tx.movimentoEstoque.createMany({
        data: finais.map((f) => ({
          produtoId: f.produtoId,
          tipo: "ENTRADA_XML" as const,
          quantidade: new Decimal(f.qtdEstoque).toFixed(4),
          saldoApos: porProduto.get(f.produtoId)!.qtd.toFixed(4), // saldo final da importação (é log)
          precoCusto: f.custoUnitario.toFixed(4),
          referenciaId: entrada.id,
          observacao: `NF-e ${parsed.numeroNf} — ${parsed.nomeEmitente}`.slice(0, 200),
          usuarioId: user.id,
        })),
      });
      await tx.itemEntradaXml.createMany({
        data: finais.map((f) => ({
          entradaId: entrada.id,
          produtoId: f.produtoId,
          gtin: f.gtin,
          codigoFornecedor: f.codigoFornecedor,
          fatorConversao: f.fator.toFixed(6),
          descricao: f.descricao,
          quantidade: f.quantidade,
          valorUnitario: f.valorUnitario,
          valorTotal: f.valorTotal,
          criouProduto: f.criouProduto,
        })),
      });

      return {
        novos: criados.length,
        atualizados: finais.filter((f) => f.vinculado).length,
        custosAtualizados: [...porProduto.values()].filter((a) => a.custo).length,
      };
    });

    revalidatePath("/estoque");
    revalidatePath("/notas");
    return resultado;
  });

  return r.ok ? { ok: true, ...r.data } : { ok: false, erro: r.erro };
}
