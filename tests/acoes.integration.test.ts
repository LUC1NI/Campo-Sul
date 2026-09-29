/**
 * Integração: Server Actions (venda, cancelamento, importação NF-e) contra Postgres real
 * (PGlite exposto via socket — Prisma conecta como num banco normal, sem Docker).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const sessao = { user: { id: "", role: "ADMIN" as "ADMIN" | "FUNCIONARIO", email: "", name: "" } };
vi.mock("@/lib/auth", () => ({ auth: async () => sessao }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const PORTA = 54329;
let db: PGlite;
let srv: PGLiteSocketServer;
let prisma: typeof import("@/lib/prisma").prisma;
let acoes: typeof import("@/app/actions/vendas");
let xml: typeof import("@/app/actions/xml");
let racaoId: string; // SACO de 25 kg, fracionável
let marteloId: string; // UN

async function estoque(id: string) {
  const p = await prisma.produto.findUniqueOrThrow({ where: { id } });
  return { quantidade: p.quantidade.toString(), saldo: p.saldoFracionado.toString() };
}

function vender(
  itens: { produtoId: string; unidadeVenda: "SACO" | "KG" | "UN"; quantidade: number; precoUnitario?: number }[],
  total: number,
  chave?: string
) {
  return acoes.finalizarVenda({
    itens,
    pagamentos: [{ metodo: "PIX", valor: total }],
    chaveIdempotencia: chave,
  });
}

beforeAll(async () => {
  db = await PGlite.create();
  srv = new PGLiteSocketServer({ db, port: PORTA, host: "127.0.0.1" });
  await srv.start();
  await db.exec(
    execSync("npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString()
  );
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORTA}/postgres?connection_limit=1&sslmode=disable`;

  ({ prisma } = await import("@/lib/prisma"));
  acoes = await import("@/app/actions/vendas");
  xml = await import("@/app/actions/xml");

  const admin = await prisma.usuario.create({
    data: { email: "admin@teste", nome: "Admin", senhaHash: "x", role: "ADMIN" },
  });
  sessao.user.id = admin.id;
  await prisma.counter.createMany({ data: [{ chave: "VENDA" }, { chave: "NOTA:1" }, { chave: "RECIBO:1" }] });
  racaoId = (
    await prisma.produto.create({
      data: {
        codigo: "R1", nome: "Ração 25kg", unidade: "SACO", precoCusto: "70", precoVenda: "100",
        podeFracionar: true, pesoUnidade: "25", unidadeFracao: "KG", precoFracao: "5", quantidade: "10",
      },
    })
  ).id;
  marteloId = (
    await prisma.produto.create({
      data: { codigo: "M1", nome: "Martelo", unidade: "UN", precoCusto: "20", precoVenda: "30", quantidade: "5" },
    })
  ).id;
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await srv?.stop();
  await db?.close();
});

describe("finalizarVenda", () => {
  it("venda inteira baixa estoque, grava movimento e numera", async () => {
    const r = await vender([{ produtoId: racaoId, unidadeVenda: "SACO", quantidade: 2 }], 200);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await estoque(racaoId)).toEqual({ quantidade: "8", saldo: "0" });

    const venda = await prisma.venda.findUniqueOrThrow({ where: { id: r.data.vendaId } });
    expect(venda.total.toString()).toBe("200");
    const mov = await prisma.movimentoEstoque.findMany({ where: { referenciaId: venda.id } });
    expect(mov).toHaveLength(1);
    expect(mov[0].quantidade.toString()).toBe("-2");
  });

  it("venda fracionada acumula saldo e abre saco quando passa do peso", async () => {
    const antes = await estoque(racaoId);
    const r = await vender([{ produtoId: racaoId, unidadeVenda: "KG", quantidade: 30 }], 150);
    expect(r.ok).toBe(true);
    const depois = await estoque(racaoId);
    // 30 kg = 1 saco (25) + 5 kg de saldo aberto
    expect(Number(depois.quantidade)).toBe(Number(antes.quantidade) - 1);
    expect(Number(depois.saldo)).toBe(5);
  });

  it("ignora preço enviado pelo cliente (vale o catálogo)", async () => {
    const r = await vender([{ produtoId: marteloId, unidadeVenda: "UN", quantidade: 1, precoUnitario: 0.01 }], 30);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = await prisma.venda.findUniqueOrThrow({ where: { id: r.data.vendaId } });
    expect(v.total.toString()).toBe("30");
  });

  it("mesma chave de idempotência não duplica venda nem baixa estoque duas vezes", async () => {
    const chave = randomUUID();
    const antes = await estoque(marteloId);
    const a = await vender([{ produtoId: marteloId, unidadeVenda: "UN", quantidade: 1 }], 30, chave);
    const b = await vender([{ produtoId: marteloId, unidadeVenda: "UN", quantidade: 1 }], 30, chave);
    expect(a.ok && b.ok && a.data.vendaId === b.data.vendaId).toBe(true);
    expect(Number((await estoque(marteloId)).quantidade)).toBe(Number(antes.quantidade) - 1);
    expect(await prisma.venda.count({ where: { chaveIdempotencia: chave } })).toBe(1);
  });

  it("produto desativado bloqueia a venda sem mexer no estoque", async () => {
    await prisma.produto.update({ where: { id: marteloId }, data: { ativo: false } });
    const antes = await estoque(marteloId);
    const r = await vender([{ produtoId: marteloId, unidadeVenda: "UN", quantidade: 1 }], 30);
    await prisma.produto.update({ where: { id: marteloId }, data: { ativo: true } });
    expect(r.ok).toBe(false);
    expect(await estoque(marteloId)).toEqual(antes);
  });
});

describe("cancelarVenda", () => {
  it("devolve exatamente o estoque (inteiro + fracionado) e não cancela duas vezes", async () => {
    const antes = await estoque(racaoId);
    const r = await vender(
      [
        { produtoId: racaoId, unidadeVenda: "SACO", quantidade: 1 },
        { produtoId: racaoId, unidadeVenda: "KG", quantidade: 22 },
      ],
      210
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await estoque(racaoId)).not.toEqual(antes);

    expect((await acoes.cancelarVenda(r.data.vendaId)).ok).toBe(true);
    const depois = await estoque(racaoId);
    expect(Number(depois.quantidade)).toBe(Number(antes.quantidade));
    expect(Number(depois.saldo)).toBe(Number(antes.saldo));

    const denovo = await acoes.cancelarVenda(r.data.vendaId);
    expect(denovo).toEqual({ ok: false, erro: "Esta venda já foi cancelada." });
  });

  it("funcionário não pode cancelar", async () => {
    const r = await vender([{ produtoId: marteloId, unidadeVenda: "UN", quantidade: 1 }], 30);
    if (!r.ok) throw new Error(r.erro);
    sessao.user.role = "FUNCIONARIO";
    const c = await acoes.cancelarVenda(r.data.vendaId);
    sessao.user.role = "ADMIN";
    expect(c.ok).toBe(false);
    expect((await prisma.venda.findUniqueOrThrow({ where: { id: r.data.vendaId } })).status).toBe("CONCLUIDA");
  });
});

describe("confirmarImportacaoXml", () => {
  const CHAVE = "41260500000000000100550010000012341000012345";
  const item = (o: { gtin: string | null; produtoId: string | null; quantidade: string; descricao?: string }) => ({
    descricao: o.descricao ?? "Item", unidadeNfe: "UN", valorUnitario: "10", valorTotal: "10",
    unidadeMapeada: "UN" as const, ...o,
  });
  const importar = (itens: ReturnType<typeof item>[]) =>
    xml.confirmarImportacaoXml({
      chaveAcesso: CHAVE, numeroNf: "1234", cnpjEmitente: "00000000000100",
      nomeEmitente: "Fornecedor", valorTotal: "100", xmlOriginal: "<x/>", itens,
    });

  it("soma estoque do existente, cria novo uma vez por GTIN e bloqueia reimportação", async () => {
    const antes = Number((await estoque(marteloId)).quantidade);
    const r = await importar([
      item({ gtin: null, produtoId: marteloId, quantidade: "3" }),
      item({ gtin: "7890000000017", produtoId: null, quantidade: "2", descricao: "Arame" }),
      item({ gtin: "7890000000017", produtoId: null, quantidade: "4", descricao: "Arame" }),
    ]);
    expect(r).toEqual({ ok: true, novos: 1, atualizados: 2 });
    expect(Number((await estoque(marteloId)).quantidade)).toBe(antes + 3);

    const arame = await prisma.produto.findUniqueOrThrow({ where: { gtin: "7890000000017" } });
    expect(arame.quantidade.toString()).toBe("6");
    expect(await prisma.movimentoEstoque.count({ where: { tipo: "ENTRADA_XML" } })).toBe(3);

    const denovo = await importar([item({ gtin: null, produtoId: marteloId, quantidade: "3" })]);
    expect(denovo).toEqual({ ok: false, erro: "Esta NF-e já foi importada anteriormente." });
    expect(Number((await estoque(marteloId)).quantidade)).toBe(antes + 3);
  });

  it("funcionário não importa", async () => {
    sessao.user.role = "FUNCIONARIO";
    const r = await xml.confirmarImportacaoXml({
      chaveAcesso: "4".repeat(44), numeroNf: "1", cnpjEmitente: "1", nomeEmitente: "F",
      valorTotal: "1", xmlOriginal: "<x/>", itens: [item({ gtin: null, produtoId: marteloId, quantidade: "1" })],
    });
    sessao.user.role = "ADMIN";
    expect(r.ok).toBe(false);
  });
});

describe("atualizarUsuario", () => {
  it("trocar só o nome não derruba a sessão; trocar senha derruba", async () => {
    const u = await prisma.usuario.create({
      data: { email: "func@teste.com", nome: "Func", senhaHash: "x", role: "FUNCIONARIO" },
    });
    const { atualizarUsuario } = await import("@/app/actions/usuarios");
    const base = { email: "func@teste.com", role: "FUNCIONARIO" as const, ativo: true };

    expect((await atualizarUsuario(u.id, { ...base, nome: "Funcionário" })).ok).toBe(true);
    const r1 = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(r1.nome).toBe("Funcionário");
    expect(r1.updatedAt.getTime()).toBe(u.updatedAt.getTime());

    expect((await atualizarUsuario(u.id, { ...base, nome: "Funcionário", novaSenha: "nova-senha-123" })).ok).toBe(true);
    const r2 = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(r2.updatedAt.getTime()).toBeGreaterThan(u.updatedAt.getTime());
  });

  it("não deixa o sistema sem admin ativo", async () => {
    const outro = await prisma.usuario.create({
      data: { email: "admin2@teste.com", nome: "Admin 2", senhaHash: "x", role: "ADMIN" },
    });
    const { atualizarUsuario } = await import("@/app/actions/usuarios");
    // desativa o admin da sessão pelo banco, sobrando só "outro"
    await prisma.usuario.update({ where: { id: sessao.user.id }, data: { ativo: false } });
    const r = await atualizarUsuario(outro.id, { nome: "Admin 2", email: "admin2@teste.com", role: "FUNCIONARIO", ativo: true });
    await prisma.usuario.update({ where: { id: sessao.user.id }, data: { ativo: true } });
    expect(r).toEqual({ ok: false, erro: "O sistema precisa de pelo menos um administrador ativo." });
  });
});
