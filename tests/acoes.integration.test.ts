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

describe("importação de NF-e", () => {
  type Det = { cProd: string; ean?: string; nome: string; un: string; qtd: string; vUn: string; vProd: string };
  let seq = 0;
  const nota = (dets: Det[], cnpj = "11111111000111") => {
    const chave = `4126050000000000010055001${String(++seq).padStart(9, "0")}1000012345`.slice(0, 44);
    return `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave}">
      <ide><nNF>${seq}</nNF></ide><emit><CNPJ>${cnpj}</CNPJ><xNome>Agro Fornecedor</xNome></emit>
      ${dets.map((d, i) => `<det nItem="${i + 1}"><prod><cProd>${d.cProd}</cProd><cEAN>${d.ean ?? "SEM GTIN"}</cEAN>
        <xProd>${d.nome}</xProd><uCom>${d.un}</uCom><qCom>${d.qtd}</qCom><vUnCom>${d.vUn}</vUnCom><vProd>${d.vProd}</vProd></prod></det>`).join("")}
      <total><ICMSTot><vNF>1</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
  };

  it("vincula existente (custo da última nota + GTIN aprendido) e cria novo sem GTIN", async () => {
    const xmlA = nota([
      { cProd: "MART-01", ean: "7890000000024", nome: "MARTELO UNHA 27MM", un: "UN", qtd: "3", vUn: "22.5", vProd: "67.50" },
      { cProd: "SAL-30", nome: "SAL MINERAL BOVINO 30KG", un: "SC", qtd: "4", vUn: "80", vProd: "320.00" },
    ]);
    const prev = await xml.parsearXml(xmlA);
    if (!prev.ok) throw new Error(prev.erro);
    expect(prev.data.itens[0].vinculo).toBeNull(); // nome diferente de "Martelo": não vincula sozinho
    const antes = Number((await estoque(marteloId)).quantidade);

    const r = await xml.confirmarImportacaoXml({
      xmlOriginal: xmlA,
      itens: [{ produtoId: marteloId, qtdEstoque: "3" }, { produtoId: null, precoVenda: "110" }],
    });
    expect(r).toEqual({ ok: true, novos: 1, atualizados: 1, custosAtualizados: 1 });
    const martelo = await prisma.produto.findUniqueOrThrow({ where: { id: marteloId } });
    expect(Number(martelo.quantidade)).toBe(antes + 3);
    expect(martelo.precoCusto.toString()).toBe("22.5");
    expect(martelo.gtin).toBe("7890000000024");

    const reimport = await xml.confirmarImportacaoXml({ xmlOriginal: xmlA, itens: [{ produtoId: marteloId, qtdEstoque: "3" }, { produtoId: null, precoVenda: "110" }] });
    expect(reimport).toEqual({ ok: false, erro: "Esta NF-e já foi importada anteriormente." });
  });

  it("próxima nota do fornecedor: reconhece por GTIN e por código do fornecedor mesmo com nome mudado", async () => {
    const xmlB = nota([
      { cProd: "MART-01", ean: "7890000000024", nome: "MARTELO 27MM", un: "UN", qtd: "1", vUn: "25", vProd: "25.00" },
      { cProd: "SAL-30", nome: "SAL MIN. BOV. 30 KG - NOVA EMBALAGEM", un: "SC", qtd: "2", vUn: "85", vProd: "170.00" },
    ]);
    const prev = await xml.parsearXml(xmlB);
    if (!prev.ok) throw new Error(prev.erro);
    expect(prev.data.itens[0].vinculo?.metodo).toBe("gtin");
    expect(prev.data.itens[0].vinculo?.produto.id).toBe(marteloId);
    expect(prev.data.itens[1].vinculo?.metodo).toBe("fornecedor");
    expect(prev.data.itens[1].vinculo?.produto.nome).toBe("SAL MINERAL BOVINO 30KG");

    // Outro fornecedor com o mesmo cProd NÃO herda a memória
    const outro = await xml.parsearXml(nota([{ cProd: "SAL-30", nome: "CIMENTO 50KG", un: "SC", qtd: "1", vUn: "40", vProd: "40.00" }], "22222222000122"));
    if (!outro.ok) throw new Error(outro.erro);
    expect(outro.data.itens[0].vinculo).toBeNull();
  });

  it("nome parecido vira sugestão (nunca vínculo) e medidas diferentes não são sugeridas", async () => {
    const prev = await xml.parsearXml(
      nota([
        { cProd: "R-25", nome: "RACAO CAES 25 KG", un: "SC", qtd: "1", vUn: "70", vProd: "70.00" },
        { cProd: "R-40", nome: "RACAO CAES 40KG", un: "SC", qtd: "1", vUn: "90", vProd: "90.00" },
      ], "33333333000133")
    );
    if (!prev.ok) throw new Error(prev.erro);
    expect(prev.data.itens[0].vinculo).toBeNull();
    expect(prev.data.itens[0].sugestoes.map((s) => s.id)).toContain(racaoId);
    expect(prev.data.itens[1].sugestoes.map((s) => s.id)).not.toContain(racaoId);
  });

  it("nota em KG entrando em produto em SACO: converte estoque e custo, e memoriza o fator", async () => {
    const antes = Number((await estoque(racaoId)).quantidade);
    const xmlKg = nota([{ cProd: "RAC-KG", nome: "RACAO GRANEL", un: "KG", qtd: "500", vUn: "3", vProd: "1500.00" }], "44444444000144");
    const r = await xml.confirmarImportacaoXml({ xmlOriginal: xmlKg, itens: [{ produtoId: racaoId, qtdEstoque: "20" }] });
    expect(r.ok).toBe(true);
    const racao = await prisma.produto.findUniqueOrThrow({ where: { id: racaoId } });
    expect(Number(racao.quantidade)).toBe(antes + 20);
    expect(racao.precoCusto.toString()).toBe("75"); // R$ 1500 ÷ 20 sacos

    const prox = await xml.parsearXml(nota([{ cProd: "RAC-KG", nome: "RACAO GRANEL", un: "KG", qtd: "250", vUn: "3", vProd: "750.00" }], "44444444000144"));
    if (!prox.ok) throw new Error(prox.erro);
    expect(prox.data.itens[0].vinculo?.produto.id).toBe(racaoId);
    expect(prox.data.itens[0].fatorHistorico).toEqual({ produtoId: racaoId, fator: "0.04" });
  });

  it("valida decisões: quantidade do existente, preço do novo e itens da nota", async () => {
    const x = nota([{ cProd: "V-1", nome: "BALDE", un: "UN", qtd: "1", vUn: "10", vProd: "10.00" }]);
    expect(await xml.confirmarImportacaoXml({ xmlOriginal: x, itens: [{ produtoId: marteloId }] })).toEqual({
      ok: false, erro: "Informe quanto entra no estoque para: BALDE",
    });
    expect(await xml.confirmarImportacaoXml({ xmlOriginal: x, itens: [{ produtoId: null }] })).toEqual({
      ok: false, erro: "Informe o preço de venda para: BALDE",
    });
    const r = await xml.confirmarImportacaoXml({ xmlOriginal: x, itens: [{ produtoId: null, precoVenda: "1" }, { produtoId: null, precoVenda: "1" }] });
    expect(r.ok).toBe(false);
  });

  it("funcionário não importa", async () => {
    sessao.user.role = "FUNCIONARIO";
    const r = await xml.confirmarImportacaoXml({
      xmlOriginal: nota([{ cProd: "X", nome: "X", un: "UN", qtd: "1", vUn: "1", vProd: "1.00" }]),
      itens: [{ produtoId: marteloId, qtdEstoque: "1" }],
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
