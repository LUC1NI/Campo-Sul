import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf") },
    { src: path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "NotoSans", fontSize: 9, color: "#1a1a1a" },
  titulo: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 4, color: "#2d4a2b" },
  subtitulo: { fontSize: 10, textAlign: "center", marginBottom: 2, color: "#555" },
  linha: { borderBottom: "1px solid #e0d9c8", marginVertical: 8 },
  tabelaHeader: { flexDirection: "row", backgroundColor: "#f4ead5", padding: "4 6", fontWeight: "bold" },
  tabelaRow: { flexDirection: "row", padding: "4 6", borderBottom: "0.5px solid #e0d9c8" },
  totaisRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  negrito: { fontWeight: "bold" },
  cinza: { color: "#555" },
  verde: { color: "#2d4a2b" },
  rodape: { marginTop: 20, fontSize: 8, color: "#888", textAlign: "center" },
});

interface ReciboDocProps {
  numero: number;
  serie: string;
  data: string;
  itens: Array<{
    nomeProduto: string;
    quantidade: string;
    unidadeVenda: string;
    precoUnitario: string;
    total: string;
  }>;
  subtotal: string;
  desconto: string;
  total: string;
  pagamentos: Array<{ metodo: string; valor: string }>;
  empresa: {
    razaoSocial: string;
    cnpj: string;
    endereco: string;
    fone: string;
  };
  tipo: "NOTA" | "RECIBO";
  cpfCnpj?: string | null;
  nomeCliente?: string | null;
}

const METODO_LABEL: Record<string, string> = {
  DINHEIRO: "Dinheiro", DEBITO: "Cartão Débito", CREDITO: "Cartão Crédito", PIX: "PIX",
};

const UNIDADE_LABEL: Record<string, string> = {
  UN: "un", KG: "kg", L: "L", SACO: "saco", CX: "cx", M: "m",
};

export function ReciboDoc({
  numero, serie, data, itens, subtotal, desconto, total, pagamentos, empresa, tipo, cpfCnpj, nomeCliente,
}: ReciboDocProps) {
  const isNota = tipo === "NOTA";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Cabeçalho empresa */}
        <Text style={s.titulo}>{empresa.razaoSocial}</Text>
        <Text style={s.subtitulo}>CNPJ: {empresa.cnpj}</Text>
        <Text style={s.subtitulo}>{empresa.endereco}</Text>
        <Text style={s.subtitulo}>Tel: {empresa.fone}</Text>

        <View style={s.linha} />

        {/* Título do documento */}
        <Text style={{ fontSize: 14, fontWeight: "bold", textAlign: "center", marginBottom: 2 }}>
          {isNota ? "NOTA FISCAL SIMPLIFICADA" : "RECIBO"}
        </Text>
        <Text style={{ fontSize: 10, textAlign: "center", color: "#555", marginBottom: 8 }}>
          Nº {String(numero).padStart(6, "0")} · Série {serie} · {data}
        </Text>

        {isNota && (
          <View style={{ marginBottom: 8, padding: "4 6", backgroundColor: "#f4ead5", borderRadius: 4 }}>
            <Text><Text style={s.negrito}>Cliente: </Text>{nomeCliente || "Consumidor não identificado"}</Text>
            {cpfCnpj && <Text><Text style={s.negrito}>CPF/CNPJ: </Text>{cpfCnpj}</Text>}
          </View>
        )}

        {!isNota && (
          <Text style={{ color: "#555", textAlign: "center", marginBottom: 8, fontSize: 8 }}>
            Consumidor não identificado
          </Text>
        )}

        {/* Tabela de itens */}
        <View style={s.tabelaHeader}>
          <Text style={{ flex: 4 }}>PRODUTO</Text>
          <Text style={{ flex: 1.5, textAlign: "center" }}>QTDE</Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>UNIT.</Text>
          <Text style={{ flex: 1.5, textAlign: "right" }}>TOTAL</Text>
        </View>

        {itens.map((item, i) => (
          <View key={i} style={[s.tabelaRow, i % 2 === 1 ? { backgroundColor: "#faf7f0" } : {}]}>
            <Text style={{ flex: 4 }}>{item.nomeProduto}</Text>
            <Text style={{ flex: 1.5, textAlign: "center" }}>
              {Number(item.quantidade).toFixed(3)} {UNIDADE_LABEL[item.unidadeVenda] ?? item.unidadeVenda}
            </Text>
            <Text style={{ flex: 1.5, textAlign: "right" }}>
              R$ {Number(item.precoUnitario).toFixed(2)}
            </Text>
            <Text style={{ flex: 1.5, textAlign: "right", fontWeight: "bold" }}>
              R$ {Number(item.total).toFixed(2)}
            </Text>
          </View>
        ))}

        <View style={s.linha} />

        {/* Totais */}
        <View style={{ alignItems: "flex-end", marginBottom: 8 }}>
          <View style={s.totaisRow}>
            <Text style={[s.cinza, { marginRight: 40 }]}>Subtotal</Text>
            <Text>R$ {Number(subtotal).toFixed(2)}</Text>
          </View>
          {Number(desconto) > 0 && (
            <View style={s.totaisRow}>
              <Text style={[s.cinza, { marginRight: 40 }]}>Desconto</Text>
              <Text>- R$ {Number(desconto).toFixed(2)}</Text>
            </View>
          )}
          <View style={[s.totaisRow, { marginTop: 4 }]}>
            <Text style={[s.negrito, { marginRight: 40 }]}>TOTAL</Text>
            <Text style={[s.negrito, s.verde]}>R$ {Number(total).toFixed(2)}</Text>
          </View>
        </View>

        {/* Pagamentos */}
        <View style={{ marginBottom: 12 }}>
          <Text style={[s.negrito, { marginBottom: 4 }]}>Forma de pagamento</Text>
          {pagamentos.map((p, i) => (
            <View key={i} style={s.totaisRow}>
              <Text style={s.cinza}>{METODO_LABEL[p.metodo] ?? p.metodo}</Text>
              <Text>R$ {Number(p.valor).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <Text style={s.rodape}>
          {isNota
            ? "Documento auxiliar não fiscal. Emitido para fins de controle interno."
            : "Recibo emitido como comprovante de pagamento. Não é documento fiscal."}
        </Text>
      </Page>
    </Document>
  );
}
