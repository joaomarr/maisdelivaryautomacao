import * as XLSX from "xlsx";

// Parse date string in DD/MM/YYYY or DD/MM/YYYY HH:MM:SS format
function parseBRDate(dateString: string | null | undefined): Date {
  if (!dateString || typeof dateString !== "string") {
    return new Date();
  }

  const trimmed = dateString.trim();
  if (!trimmed) {
    return new Date();
  }

  // Split date and time parts
  const parts = trimmed.split(" ");
  const datePart = parts[0];
  const timePart = parts.slice(1).join(" ");

  const [day, month, year] = datePart.split("/");
  if (!day || !month || !year) {
    return new Date();
  }

  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10) - 1; // Month is 0-indexed in Date
  const yearNum = parseInt(year, 10);

  if (timePart) {
    const [hours, minutes, seconds] = timePart.split(":");
    const hoursNum = parseInt(hours, 10) || 0;
    const minutesNum = parseInt(minutes, 10) || 0;
    const secondsNum = parseInt(seconds, 10) || 0;
    const date = new Date(
      yearNum,
      monthNum,
      dayNum,
      hoursNum,
      minutesNum,
      secondsNum,
    );
    return date;
  }

  return new Date(yearNum, monthNum, dayNum);
}

// Unified payment record structure
export type PagamentoRecord = {
  tipo: "pix" | "maquina";
  provider: "sipag" | "sicredi";
  data: Date;
  valor: number;
  status: string;
  codigoTransacao: string;
  terminal?: string;
  nomePagador?: string;
  bandeira?: string;
  formaPagamento?: string;
  numeroCartao?: string;
  valorLiquido?: number;
  desconto?: number;
  rawData: Record<string, CellValue>;
};

type CellPrimitive = string | number | boolean | Date;
export type CellValue = CellPrimitive | null;

function parseCSV(content: string): CellPrimitive[][] {
  const lines = content.split(/\r?\n/);
  return lines.map((line) => {
    const cells: CellPrimitive[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ";" && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

function parseMoneyValue(value: string): number {
  if (!value || value === "-") return 0;

  // Remove currency symbol
  let cleaned = value.replace(/R\$\s*/g, "").trim();

  // Determine decimal separator: the last occurrence of . or , is the decimal
  const lastDotIndex = cleaned.lastIndexOf(".");
  const lastCommaIndex = cleaned.lastIndexOf(",");

  if (lastDotIndex > lastCommaIndex) {
    // Dot is the decimal separator, remove commas as thousands separators
    cleaned = cleaned.replace(/,/g, "");
  } else if (lastCommaIndex > lastDotIndex) {
    // Comma is the decimal separator, remove dots as thousands separators
    cleaned = cleaned.replace(/\./g, "");
    // Replace comma with dot for JavaScript parsing
    cleaned = cleaned.replace(",", ".");
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function isEmptyRow(cells: CellPrimitive[]): boolean {
  return cells.every((c) => !c || String(c).trim() === "");
}

function startsWithTotais(value: CellPrimitive): boolean {
  if (typeof value !== "string") return false;
  return (
    value.trim().toLowerCase().startsWith("totais") ||
    value.trim().toLowerCase() === "total"
  );
}

async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function parseXLSXToRows(buffer: ArrayBuffer): CellPrimitive[][] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<CellPrimitive[]>(worksheet, {
    header: 1,
  });
  return rows;
}

// Parse Pix Sipag CSV
export async function parsePixSipag(
  file: File,
): Promise<{ result?: PagamentoRecord[]; error?: string }> {
  try {
    const content = await readFileContent(file);
    const rows = parseCSV(content);

    // Find header row - it starts with "Estabelecimento"
    let headerIndex = -1;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      if (
        rows[i][0] &&
        String(rows[i][0]).toLowerCase().includes("estabelecimento") &&
        !String(rows[i][1]).includes("CB-")
      ) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return {
        error:
          "Estrutura do arquivo Pix Sipag inválida - cabeçalho não encontrado.",
      };
    }

    const headers = rows[headerIndex].map((h) => String(h).trim());
    const dataRows = rows.slice(headerIndex + 1);

    const records: PagamentoRecord[] = [];
    for (const row of dataRows) {
      if (isEmptyRow(row) || startsWithTotais(row[0])) continue;

      const obj: Record<string, CellValue> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : null;
      });

      const dataVenda = String(obj["Data da Venda"] || "");
      const valorStr = String(obj["Valor da Venda"] || "");
      const valor = parseMoneyValue(valorStr);

      if (valor > 0) {
        records.push({
          tipo: "pix",
          provider: "sipag",
          data: parseBRDate(dataVenda),
          valor,
          status: String(obj["Status"] || ""),
          codigoTransacao: String(obj["Código da Transação"] || ""),
          terminal: String(obj["Nº Terminal"] || ""),
          nomePagador: String(obj["Nome do Pagador"] || ""),
          rawData: obj,
        });
      }
    }

    return { result: records };
  } catch (err) {
    return {
      error:
        "Falha ao processar Pix Sipag: " +
        (err instanceof Error ? err.message : String(err)),
    };
  }
}

// Parse Pix Sicredi - handles both CSV and XLSX formats
export async function parsePixSicredi(
  file: File,
): Promise<{ result?: PagamentoRecord[]; error?: string }> {
  try {
    let rows: CellPrimitive[][];

    if (file.name.toLowerCase().endsWith(".xlsx")) {
      const buffer = await readFileAsArrayBuffer(file);
      rows = parseXLSXToRows(buffer);
    } else {
      const content = await readFileContent(file);
      rows = parseCSV(content);
    }

    let headerIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (
        rows[i].some(
          (cell) => String(cell).toLowerCase().trim() === "data da venda",
        )
      ) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return {
        error:
          "Estrutura do arquivo Pix Sicredi inválida - cabeçalho não encontrado.",
      };
    }

    const headers = rows[headerIndex].map((h) => String(h).trim());
    const dataRows = rows.slice(headerIndex + 1);

    const records: PagamentoRecord[] = [];
    for (const row of dataRows) {
      if (isEmptyRow(row)) continue;

      const obj: Record<string, CellValue> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : null;
      });

      // Adjust field names based on Sicredi format
      const [dataVendaPart, horaVendaPart] = String(obj["Data da venda"] || "")
        .trim()
        .split("às");
      const valorStr = String(obj["Valor bruto"] || "");
      const valor = parseMoneyValue(valorStr);

      if (valor > 0) {
        const fullDateTime = horaVendaPart
          ? dataVendaPart.trim() + " " + horaVendaPart.trim()
          : dataVendaPart.trim();
        records.push({
          tipo: "pix",
          provider: "sicredi",
          data: parseBRDate(fullDateTime),
          valor,
          status: String(obj["Status"] || ""),
          codigoTransacao: String(obj["Cód. de autorização"] || ""),
          terminal: String(obj["Terminal"] || ""),
          nomePagador: String(obj["Número do estabelecimento"] || ""),
          rawData: obj,
        });
      }
    }

    return { result: records };
  } catch (err) {
    return {
      error:
        "Falha ao processar Pix Sicredi: " +
        (err instanceof Error ? err.message : String(err)),
    };
  }
}

// Parse Maquininha Sipag CSV
export async function parseMaquinaSipag(
  file: File,
): Promise<{ result?: PagamentoRecord[]; error?: string }> {
  try {
    const content = await readFileContent(file);
    const rows = parseCSV(content);

    // Find header row
    let headerIndex = -1;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      if (
        rows[i][0] &&
        String(rows[i][0]).toLowerCase().includes("estabelecimento") &&
        !String(rows[i][1]).includes("CB-")
      ) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return {
        error:
          "Estrutura do arquivo Maquininha Sipag inválida - cabeçalho não encontrado.",
      };
    }

    const headers = rows[headerIndex].map((h) => String(h).trim());
    const dataRows = rows.slice(headerIndex + 1);

    const records: PagamentoRecord[] = [];
    for (const row of dataRows) {
      if (isEmptyRow(row) || startsWithTotais(row[0])) continue;

      const obj: Record<string, CellValue> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : null;
      });

      const dataTransacao = String(obj["Data da transação"] || "");
      const valorBrutoStr = String(obj["Valor parcela bruto"] || "");
      const valorLiquidoStr = String(obj["Valor parcela liquido"] || "");
      const descontoStr = String(obj["Desconto parcela"] || "");

      const valor = parseMoneyValue(valorBrutoStr);
      const valorLiquido = parseMoneyValue(valorLiquidoStr);
      const desconto = parseMoneyValue(descontoStr);

      if (valor > 0) {
        records.push({
          tipo: "maquina",
          provider: "sipag",
          data: parseBRDate(dataTransacao),
          valor,
          valorLiquido,
          desconto,
          status: String(obj["Status"] || ""),
          codigoTransacao: String(obj["Nº da transação"] || ""),
          terminal: String(obj["Número do terminal"] || ""),
          bandeira: String(obj["Bandeira"] || ""),
          formaPagamento: String(obj["Forma de Pagamento"] || ""),
          numeroCartao: String(obj["Número do cartão"] || ""),
          rawData: obj,
        });
      }
    }

    return { result: records };
  } catch (err) {
    return {
      error:
        "Falha ao processar Maquininha Sipag: " +
        (err instanceof Error ? err.message : String(err)),
    };
  }
}

// Parse Maquininha Sicredi - handles both CSV and XLSX formats
export async function parseMaquinaSicredi(
  file: File,
): Promise<{ result?: PagamentoRecord[]; error?: string }> {
  try {
    let rows: CellPrimitive[][];

    if (file.name.toLowerCase().endsWith(".xlsx")) {
      const buffer = await readFileAsArrayBuffer(file);
      rows = parseXLSXToRows(buffer);
    } else {
      const content = await readFileContent(file);
      rows = parseCSV(content);
    }

    let headerIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (
        rows[i].some(
          (cell) => String(cell).toLowerCase().trim() === "data da venda",
        )
      ) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return {
        error:
          "Estrutura do arquivo Maquininha Sicredi inválida - cabeçalho não encontrado.",
      };
    }

    const headers = rows[headerIndex].map((h) => String(h).trim());
    const dataRows = rows.slice(headerIndex + 1);

    const records: PagamentoRecord[] = [];
    for (const row of dataRows) {
      if (isEmptyRow(row) || startsWithTotais(row[0])) continue;

      const obj: Record<string, CellValue> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : null;
      });

      let dataTransacao = String(obj["Data da venda"] || "");
      const horaTransacao = String(obj["Hora da venda"] || "");
      if (horaTransacao) {
        // Append time to date if available
        dataTransacao = dataTransacao.concat(" " + horaTransacao);
      }
      const valorBrutoStr = String(obj["Valor bruto da transação"] || "");

      const valor = parseMoneyValue(valorBrutoStr);

      if (valor > 0) {
        records.push({
          tipo: "maquina",
          provider: "sicredi",
          data: parseBRDate(dataTransacao),
          valor,
          status: String(obj["Status"] || ""),
          codigoTransacao: String(obj["Código de pagamento"] || ""),
          bandeira: String(obj["Tipo de cartão"] || ""),
          formaPagamento: String(obj["Tipo de cartão"] || ""),
          numeroCartao: String(obj["Número do cartão"] || ""),
          rawData: obj,
        });
      }
    }

    return { result: records };
  } catch (err) {
    return {
      error:
        "Falha ao processar Maquininha Sicredi: " +
        (err instanceof Error ? err.message : String(err)),
    };
  }
}

// Combined parser for all files
export async function parseTodosPagamentos(files: {
  pixSipag?: File;
  pixSicredi?: File;
  maquinaSipag?: File;
  maquinaSicredi?: File;
}): Promise<{ result?: PagamentoRecord[]; errors: string[] }> {
  const allRecords: PagamentoRecord[] = [];
  const errors: string[] = [];

  if (files.pixSipag) {
    const { result, error } = await parsePixSipag(files.pixSipag);
    if (error) {
      errors.push(error);
      console.error("Erro ao processar Pix Sipag:", error);
    }
    if (result) {
      allRecords.push(...result);
      console.log("Pix Sipag processado com sucesso:", result);
    }
  }

  if (files.pixSicredi) {
    const { result, error } = await parsePixSicredi(files.pixSicredi);
    if (error) {
      errors.push(error);
      console.error("Erro ao processar Pix Sicredi:", error);
    }
    if (result) {
      allRecords.push(...result);
      console.log("Pix Sicredi processado com sucesso:", result);
    }
  }

  if (files.maquinaSipag) {
    const { result, error } = await parseMaquinaSipag(files.maquinaSipag);
    if (error) {
      errors.push(error);
      console.error("Erro ao processar Maquininha Sipag:", error);
    }
    if (result) {
      allRecords.push(...result);
      console.log("Maquininha Sipag processado com sucesso:", result);
    }
  }

  if (files.maquinaSicredi) {
    const { result, error } = await parseMaquinaSicredi(files.maquinaSicredi);
    if (error) {
      errors.push(error);
      console.error("Erro ao processar Maquininha Sicredi:", error);
    }
    if (result) {
      allRecords.push(...result);
      console.log("Maquininha Sicredi processado com sucesso:", result);
    }
  }

  console.log("Resultado final - Total de registros:", allRecords.length);
  console.log("Resultado final - Erros encontrados:", errors);
  console.log("Resultado final - Todos os registros:", allRecords);

  return { result: allRecords, errors };
}
