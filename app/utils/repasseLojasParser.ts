import * as XLSX from "xlsx";

// Types for parsed data
export type VendaConcluidaRow = {
  estabelecimento: string;
  valorCupomAdm: number;
  valorPromocaoAdm: number;
  produtos: number;
};

export type PercentageRow = {
  estabelecimento: string;
  porcentagem: number; // As decimal (e.g., 20% = 0.20)
};

export type OccurrenceRow = {
  tipoOcorrencia: string;
  nomeEstabelecimento: string;
  valorDesconto: number;
};

export type ParsedVendasConcluidas = {
  data: VendaConcluidaRow[];
};

export type ParsedPercentages = {
  data: PercentageRow[];
};

export type ParsedOccurrences = {
  data: OccurrenceRow[];
};

// Helper function to parse percentage string (e.g., "20%" -> 0.20)
function parsePercentage(value: unknown): number {
  if (typeof value === "number") {
    // If already a number, check if it's > 1 (assume it's percentage like 20) or < 1 (assume it's decimal like 0.20)
    return value > 1 ? value / 100 : value;
  }

  if (typeof value === "string") {
    // Remove % sign and convert to decimal
    const cleaned = value.replace("%", "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num > 1 ? num / 100 : num;
  }

  return 0;
}

// Helper function to normalize establishment names for matching
export function normalizeEstablishmentName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Detects total rows so they can be ignored in parsing
function isTotalEstabelecimento(name: string): boolean {
  const normalized = normalizeEstablishmentName(name).replace(/:+$/, "");
  return normalized === "total" || normalized === "total geral";
}

// Helper to safely parse number values
function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Parse the main sales file (Relatorio Vendas Concluidas)
 * Looks for columns: Estabelecimento, Valor Cupom Adm (R$), Valor Promocao Adm (R$), Produtos (R$)
 */
export async function parseVendasConcluidas(
  file: File,
): Promise<{ result?: ParsedVendasConcluidas; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);

    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
    }) as Record<string, unknown>[];

    if (!rawData || rawData.length === 0) {
      return { error: "O arquivo de vendas está vazio" };
    }

    // Find the column names (case-insensitive and flexible)
    const firstRow = rawData[0];
    const headers = Object.keys(firstRow);

    const estabelecimentoCol = headers.find((h) =>
      h.toLowerCase().includes("estabelecimento"),
    );
    const valorCupomCol = headers.find(
      (h) =>
        h.toLowerCase().includes("cupom") && h.toLowerCase().includes("adm"),
    );
    const valorPromocaoCol = headers.find(
      (h) =>
        h.toLowerCase().includes("promocao") && h.toLowerCase().includes("adm"),
    );
    const produtosCol = headers.find((h) =>
      h.toLowerCase().includes("produtos"),
    );

    if (!estabelecimentoCol) {
      return {
        error: 'Coluna "Estabelecimento" não encontrada no arquivo de vendas',
      };
    }
    if (!valorCupomCol) {
      return {
        error:
          'Coluna "Valor Cupom Adm (R$)" não encontrada no arquivo de vendas',
      };
    }
    if (!valorPromocaoCol) {
      return {
        error:
          'Coluna "Valor Promocao Adm (R$)" não encontrada no arquivo de vendas',
      };
    }
    if (!produtosCol) {
      return {
        error: 'Coluna "Produtos (R$)" não encontrada no arquivo de vendas',
      };
    }

    // Parse the data
    const parsed: VendaConcluidaRow[] = rawData.map((row) => ({
      estabelecimento: String(row[estabelecimentoCol] || "").trim(),
      valorCupomAdm: parseNumber(row[valorCupomCol]),
      valorPromocaoAdm: parseNumber(row[valorPromocaoCol]),
      produtos: parseNumber(row[produtosCol]),
    }));

    // Filter out empty rows and the total row
    const filtered = parsed.filter(
      (row) =>
        row.estabelecimento && !isTotalEstabelecimento(row.estabelecimento),
    );

    return { result: { data: filtered } };
  } catch (error) {
    console.error("Error parsing vendas concluidas:", error);
    return {
      error: `Erro ao processar arquivo de vendas: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Parse the percentages file
 * Looks for columns: Estabelecimento, Porcentagem
 */
export async function parsePercentages(
  file: File,
): Promise<{ result?: ParsedPercentages; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);

    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
    }) as Record<string, unknown>[];

    if (!rawData || rawData.length === 0) {
      return { error: "O arquivo de porcentagens está vazio" };
    }

    // Find the column names
    const firstRow = rawData[0];
    const headers = Object.keys(firstRow);

    const estabelecimentoCol = headers.find((h) =>
      h.toLowerCase().includes("estabelecimento"),
    );
    const porcentagemCol = headers.find((h) =>
      h.toLowerCase().includes("porcetagem"),
    );

    if (!estabelecimentoCol) {
      return {
        error:
          'Coluna "Estabelecimento" não encontrada no arquivo de porcentagens',
      };
    }
    if (!porcentagemCol) {
      return {
        error: 'Coluna "Porcentagem" não encontrada no arquivo de porcentagens',
      };
    }

    // Parse the data
    const parsed: PercentageRow[] = rawData.map((row) => ({
      estabelecimento: String(row[estabelecimentoCol] || "").trim(),
      porcentagem: parsePercentage(row[porcentagemCol]),
    }));

    // Filter out empty rows
    const filtered = parsed.filter((row) => row.estabelecimento);

    return { result: { data: filtered } };
  } catch (error) {
    console.error("Error parsing percentages:", error);
    return {
      error: `Erro ao processar arquivo de porcentagens: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Parse the occurrences file (optional)
 * Looks for columns: Qual tipo de ocorrência deseja registrar?, Nome do Estabelecimento, Valor do desconto
 */
export async function parseOccurrences(
  file: File,
): Promise<{ result?: ParsedOccurrences; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);

    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
    }) as Record<string, unknown>[];

    if (!rawData || rawData.length === 0) {
      return { result: { data: [] } }; // Empty but valid
    }

    // Find the column names
    const firstRow = rawData[0];
    const headers = Object.keys(firstRow);

    const tipoOcorrenciaCol = headers.find(
      (h) =>
        h.toLowerCase().includes("tipo") &&
        h.toLowerCase().includes("ocorrência"),
    );
    const nomeEstabelecimentoCol = headers.find(
      (h) =>
        h.toLowerCase().includes("nome") &&
        h.toLowerCase().includes("estabelecimento"),
    );
    const valorDescontoCol = headers.find(
      (h) =>
        h.toLowerCase().includes("valor") &&
        h.toLowerCase().includes("desconto"),
    );

    if (!tipoOcorrenciaCol) {
      return {
        error:
          'Coluna "Qual tipo de ocorrência deseja registrar?" não encontrada',
      };
    }
    if (!nomeEstabelecimentoCol) {
      return {
        error: 'Coluna "Nome do Estabelecimento" não encontrada',
      };
    }
    if (!valorDescontoCol) {
      return {
        error: 'Coluna "Valor do desconto" não encontrada',
      };
    }

    // Parse the data
    console.log(rawData);
    const parsed: OccurrenceRow[] = rawData.map((row) => ({
      tipoOcorrencia: String(row[tipoOcorrenciaCol] || "").trim(),
      nomeEstabelecimento: String(row[nomeEstabelecimentoCol] || "").trim(),
      valorDesconto: parseNumber(row[valorDescontoCol]),
    }));

    // Filter out empty rows
    const filtered = parsed.filter(
      (row) => row.nomeEstabelecimento && row.tipoOcorrencia,
    );

    return { result: { data: filtered } };
  } catch (error) {
    console.error("Error parsing occurrences:", error);
    return {
      error: `Erro ao processar arquivo de ocorrências: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
