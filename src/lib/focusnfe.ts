/**
 * Cliente Focus NFe API — Plano Retail (NFCe + NFe)
 * Documentação: https://focusnfe.com.br/doc/
 *
 * Variáveis de ambiente necessárias:
 *   FOCUSNFE_TOKEN   — token do ambiente de produção
 *   FOCUSNFE_TOKEN_HML — token do ambiente de homologação (testes)
 *   FOCUSNFE_AMBIENTE — "producao" | "homologacao" (default: homologacao)
 */

const BASE_URL = "https://api.focusnfe.com.br/v2";
const BASE_URL_HML = "https://homologacao.focusnfe.com.br/v2";

function getConfig(): { baseUrl: string; token: string } {
  const ambiente = process.env.FOCUSNFE_AMBIENTE ?? "homologacao";
  if (ambiente === "producao") {
    const token = process.env.FOCUSNFE_TOKEN;
    if (!token) throw new Error("FOCUSNFE_TOKEN não configurado");
    return { baseUrl: BASE_URL, token };
  }
  const token = process.env.FOCUSNFE_TOKEN_HML ?? process.env.FOCUSNFE_TOKEN ?? "";
  return { baseUrl: BASE_URL_HML, token };
}

async function apiCall<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const { baseUrl, token } = getConfig();
  const headers: HeadersInit = {
    Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      (data as { mensagem?: string; erros?: { mensagem: string }[] })?.mensagem ??
      (data as { erros?: { mensagem: string }[] })?.erros?.[0]?.mensagem ??
      `Erro HTTP ${res.status}`;
    throw new Error(`FocusNFe: ${msg}`);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Tipos básicos
// ---------------------------------------------------------------------------

export type StatusNFCe =
  | "autorizado"
  | "cancelado"
  | "erro_autorizacao"
  | "processando_autorizacao"
  | "denegado";

export type RespostaNFCe = {
  status: StatusNFCe;
  status_sefaz: string;
  mensagem_sefaz: string;
  numero: string;
  serie: string;
  chave_nfe?: string;
  caminho_danfe_pdf?: string;
  caminho_xml_nota_fiscal?: string;
};

// Estrutura mínima para emissão de NFCe (Nota Fiscal Consumidor Eletrônica)
export type ItemNFCe = {
  numero_item: number;
  codigo_ncm: string;
  descricao: string;
  cfop: string;
  unidade_comercial: string;
  quantidade_comercial: number;
  valor_unitario_comercial: number;
  valor_bruto: number;
  codigo_ean_comercial?: string;
  icms_situacao_tributaria: string; // ex: "102" para simples nacional isento
  icms_origem: string;              // "0" nacional
  pis_situacao_tributaria: string;  // "07" para operação isenta
  cofins_situacao_tributaria: string;
};

export type EmitirNFCeInput = {
  /** Referência única — pode ser o ID da venda no sistema */
  referencia: string;
  natureza_operacao: string;
  /** CNPJ da empresa (sem formatação) */
  cnpj_emitente: string;
  /** CPF ou CNPJ do destinatário (opcional para consumidor final) */
  cpf_destinatario?: string;
  cnpj_destinatario?: string;
  nome_destinatario?: string;
  forma_pagamento: "0" | "1" | "2" | "3" | "4" | "5" | "15" | "17" | "99";
  /** Valor total pago */
  valor_pago?: number;
  itens: ItemNFCe[];
  informacoes_adicionais_contribuinte?: string;
};

// ---------------------------------------------------------------------------
// Funções públicas
// ---------------------------------------------------------------------------

/**
 * Emite uma NFCe (Nota Fiscal do Consumidor Eletrônica).
 * Retorna imediatamente — o processamento é assíncrono na Focus.
 * Use `consultarNFCe` para verificar o status.
 */
export async function emitirNFCe(dados: EmitirNFCeInput): Promise<RespostaNFCe> {
  return apiCall<RespostaNFCe>("POST", `/nfce?ref=${encodeURIComponent(dados.referencia)}`, dados);
}

/**
 * Consulta o status de uma NFCe pelo campo `referencia`.
 */
export async function consultarNFCe(referencia: string): Promise<RespostaNFCe> {
  return apiCall<RespostaNFCe>("GET", `/nfce/${encodeURIComponent(referencia)}`);
}

/**
 * Cancela uma NFCe autorizada.
 */
export async function cancelarNFCe(
  referencia: string,
  justificativa: string
): Promise<{ status: string; mensagem: string }> {
  return apiCall("DELETE", `/nfce/${encodeURIComponent(referencia)}`, { justificativa });
}

/**
 * Emite uma NF-e (modelo 55) — para compras de fornecedor ou vendas B2B.
 * Retorna imediatamente; processar é assíncrono.
 */
export async function emitirNFe(referencia: string, dados: unknown): Promise<RespostaNFCe> {
  return apiCall<RespostaNFCe>("POST", `/nfe?ref=${encodeURIComponent(referencia)}`, dados);
}

/**
 * Retorna a URL do DANFE PDF de uma nota autorizada.
 * Requer que a nota já esteja com status "autorizado".
 */
export function urlDanfePDF(caminhoPdf: string): string {
  const { baseUrl } = getConfig();
  return `${baseUrl}${caminhoPdf}`;
}

/**
 * Helpers para mapear MetodoPagamento do sistema para código Focus NFe.
 */
export function metodoPagamentoParaFocus(
  metodo: "DINHEIRO" | "DEBITO" | "CREDITO" | "PIX"
): EmitirNFCeInput["forma_pagamento"] {
  const mapa: Record<string, EmitirNFCeInput["forma_pagamento"]> = {
    DINHEIRO: "1",  // Dinheiro
    DEBITO: "4",    // Débito
    CREDITO: "3",   // Crédito
    PIX: "17",      // PIX — código "17" para tPag NFe (NFCe usa "99" ou "17")
  };
  return mapa[metodo] ?? "99";
}
