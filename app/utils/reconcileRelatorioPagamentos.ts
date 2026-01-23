import { type ParsedRelatorio, type DadoRelatorio } from "./relatorioVendas";
import { type PagamentoRecord } from "./pagamentosParser";

type CardEntry = {
  data: Date;
  valor: number;
  source: DadoRelatorio;
  matched: boolean;
};

type ReconcileOptions = {
  toleranceMinutes?: number;
  valueTolerance?: number;
};

export type ReconciliationResult = {
  missingRelatorioEntries: DadoRelatorio[];
  matchedPairs: { pagamento: PagamentoRecord; relatorio: DadoRelatorio }[];
  matchedCount: number;
  totalPagamentosCartao: number;
  totalRelatorioCartao: number;
};

function normalizePaymentText(value: string | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isCartao(value: string | undefined): boolean {
  const normalized = normalizePaymentText(value);
  return normalized.includes("cartao");
}

function toValidDate(value: unknown): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function buildCardEntries(relatorio: ParsedRelatorio): CardEntry[] {
  const entries: CardEntry[] = [];

  for (const row of relatorio.data) {
    if (!isCartao((row as DadoRelatorio)["Pagamento"])) continue;

    const data =
      toValidDate((row as DadoRelatorio)["Dt. Pedido"]) ||
      toValidDate((row as DadoRelatorio)["Dt. Entrega"]);
    let valor = Number((row as DadoRelatorio)["Vl. Total (R$)"] ?? 0);

    // If Frete Grátis is "SIM", subtract the delivery value
    if ((row as DadoRelatorio)["Frete Grátis"] === "SIM") {
      const vlEntrega = Number((row as DadoRelatorio)["Vl. Entrega (R$)"] ?? 0);
      valor -= vlEntrega;
    }

    if (!data || !isFinite(valor)) continue;

    entries.push({ data, valor, source: row as DadoRelatorio, matched: false });
  }

  return entries;
}

export function reconcileRelatorioWithPagamentos(
  params: {
    relatorio: ParsedRelatorio;
    pagamentos: PagamentoRecord[];
  } & ReconcileOptions,
): ReconciliationResult {
  const {
    relatorio,
    pagamentos,
    toleranceMinutes = 720,
    valueTolerance = 1.0,
  } = params;

  const toleranceMs = toleranceMinutes * 60 * 1000;
  const cardEntries = buildCardEntries(relatorio);
  const matchedPagamentos = new Set<number>();
  const matchedPairs: {
    pagamento: PagamentoRecord;
    relatorio: DadoRelatorio;
  }[] = [];

  cardEntries.forEach((entry) => {
    const pagamentoIndex = pagamentos.findIndex((pagamento, idx) => {
      if (matchedPagamentos.has(idx)) return false;
      const diffValor = Math.abs(entry.valor - pagamento.valor);
      const diffTempo = Math.abs(
        entry.data.getTime() - pagamento.data.getTime(),
      );
      return diffValor <= valueTolerance && diffTempo <= toleranceMs;
    });

    if (pagamentoIndex >= 0) {
      entry.matched = true;
      matchedPagamentos.add(pagamentoIndex);
      matchedPairs.push({
        pagamento: pagamentos[pagamentoIndex],
        relatorio: entry.source,
      });
    }
  });

  const missingRelatorioEntries = cardEntries
    .filter((entry) => !entry.matched)
    .map((entry) => entry.source);

  const matchedCount = matchedPairs.length;

  return {
    missingRelatorioEntries,
    matchedPairs,
    matchedCount,
    totalPagamentosCartao: pagamentos.length,
    totalRelatorioCartao: cardEntries.length,
  };
}
