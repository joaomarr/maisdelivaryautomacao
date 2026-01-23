import type {
  VendaConcluidaRow,
  PercentageRow,
  OccurrenceRow,
} from "./repasseLojasParser";
import { normalizeEstablishmentName } from "./repasseLojasParser";

export type EstablishmentCalculation = {
  estabelecimento: string;
  normalizedName: string;
  baseValue: number; // Produtos + Valor Cupom Adm + Valor Promocao Adm
  occurrencesBeforeTax: OccurrenceRow[];
  occurrencesAfterTax: OccurrenceRow[];
  totalOccurrencesBeforeTax: number;
  totalOccurrencesAfterTax: number;
  valueBeforeTax: number; // baseValue - occurrencesBeforeTax
  percentage: number | null; // Tax percentage (as decimal)
  taxAmount: number; // Amount to apply as tax
  valueAfterTax: number; // After applying percentage (if available)
  finalValue: number; // After applying percentage and subtracting post-tax occurrences
  hasPercentage: boolean;
  salesData: VendaConcluidaRow[];
};

export type RepasseCalculationResult = {
  calculations: EstablishmentCalculation[];
  totalRepasse: number;
};

/**
 * Calculate repasse values for each establishment
 *
 * Formula:
 * 1. Base = Produtos + Valor Cupom Adm + Valor Promocao Adm (sum all sales for establishment)
 * 2. Subtract "Ocorrência de Pedido" occurrences (before tax)
 * 3. Apply percentage/tax
 * 4. Subtract other occurrences (after tax)
 */
export function calculateRepasse(
  vendas: VendaConcluidaRow[],
  percentages: PercentageRow[],
  occurrences: OccurrenceRow[],
): RepasseCalculationResult {
  // Group sales by establishment
  const salesByEstablishment = new Map<string, VendaConcluidaRow[]>();
  vendas.forEach((venda) => {
    const normalized = normalizeEstablishmentName(venda.estabelecimento);
    if (!salesByEstablishment.has(normalized)) {
      salesByEstablishment.set(normalized, []);
    }
    salesByEstablishment.get(normalized)!.push(venda);
  });

  // Create percentage lookup map
  const percentageMap = new Map<string, number>();
  percentages.forEach((p) => {
    const normalized = normalizeEstablishmentName(p.estabelecimento);
    percentageMap.set(normalized, p.porcentagem);
  });

  // Group occurrences by establishment
  const occurrencesByEstablishment = new Map<string, OccurrenceRow[]>();
  occurrences.forEach((occ) => {
    const normalized = normalizeEstablishmentName(occ.nomeEstabelecimento);
    if (!occurrencesByEstablishment.has(normalized)) {
      occurrencesByEstablishment.set(normalized, []);
    }
    occurrencesByEstablishment.get(normalized)!.push(occ);
  });

  // Calculate for each establishment
  const calculations: EstablishmentCalculation[] = [];

  salesByEstablishment.forEach((sales, normalizedName) => {
    const originalName = sales[0].estabelecimento;

    // 1. Calculate base value (sum of all sales)
    const baseValue = sales.reduce((sum, sale) => {
      return sum + sale.produtos + sale.valorCupomAdm + sale.valorPromocaoAdm;
    }, 0);

    // 2. Get occurrences for this establishment
    const establishmentOccurrences =
      occurrencesByEstablishment.get(normalizedName) || [];

    // Separate occurrences by type (before/after tax)
    const occurrencesBeforeTax = establishmentOccurrences.filter(
      (occ) =>
        normalizeEstablishmentName(occ.tipoOcorrencia).includes("pedido") ||
        occ.tipoOcorrencia.toLowerCase().includes("ocorrência de pedido"),
    );

    const occurrencesAfterTax = establishmentOccurrences.filter(
      (occ) =>
        !normalizeEstablishmentName(occ.tipoOcorrencia).includes("pedido") &&
        !occ.tipoOcorrencia.toLowerCase().includes("ocorrência de pedido"),
    );

    const totalOccurrencesBeforeTax = occurrencesBeforeTax.reduce(
      (sum, occ) => sum + occ.valorDesconto,
      0,
    );

    const totalOccurrencesAfterTax = occurrencesAfterTax.reduce(
      (sum, occ) => sum + occ.valorDesconto,
      0,
    );

    // 3. Calculate value before tax (subtract before-tax occurrences)
    const valueBeforeTax = baseValue - totalOccurrencesBeforeTax;

    // 4. Get percentage and apply tax
    const percentage = percentageMap.get(normalizedName) || null;
    const hasPercentage = percentage !== null;

    // Apply percentage when available
    const taxAmount =
      hasPercentage && percentage !== null ? valueBeforeTax * percentage : 0;

    // Value after applying percentage (or unchanged if missing)
    const valueAfterTax = hasPercentage
      ? valueBeforeTax - taxAmount
      : valueBeforeTax;

    // 5. Subtract after-tax occurrences (final value includes percentage effect)
    const finalValue = valueAfterTax - totalOccurrencesAfterTax;

    calculations.push({
      estabelecimento: originalName,
      normalizedName,
      baseValue,
      occurrencesBeforeTax,
      occurrencesAfterTax,
      totalOccurrencesBeforeTax,
      totalOccurrencesAfterTax,
      valueBeforeTax,
      percentage,
      taxAmount,
      valueAfterTax,
      finalValue,
      hasPercentage,
      salesData: sales,
    });
  });

  // Sort by establishment name
  calculations.sort((a, b) =>
    a.estabelecimento.localeCompare(b.estabelecimento),
  );

  // Calculate total
  const totalRepasse = calculations.reduce(
    (sum, calc) => sum + calc.finalValue,
    0,
  );

  return {
    calculations,
    totalRepasse,
  };
}
