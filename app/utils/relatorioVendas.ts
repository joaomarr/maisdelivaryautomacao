import * as XLSX from "xlsx";

export type DadoRelatorio = {
  Entregador: string;
  "Dt. Pedido": Date;
  "Dt. Entrega": Date;
  Estabelecimento: string;
  "Frete Grátis": string;
  Pagamento: string;
  "ID Pedido": string;
  Observação: string;
  "Vl. Entrega (R$)": number;
  "Vl. Pedido (R$)": number;
  "Vl. Total (R$)": number;
};

export type ParsedRelatorio = {
  headers: string[];
  data: DadoRelatorio[];
};

const normalize = (s: string) => s.trim().toLowerCase();

// Parse date string in DD/MM/YYYY or DD/MM/YYYY HH:MM:SS format
function parseBRDate(dateString: string): Date {
  if (!dateString || typeof dateString !== "string") {
    return new Date();
  }

  const trimmed = dateString.trim();
  // Split date and time parts
  const [datePart, timePart] = trimmed.split(" ");

  if (!datePart) {
    return new Date();
  }

  const [day, month, year] = datePart.split("/");
  if (!day || !month || !year) {
    return new Date();
  }

  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10) - 1; // Month is 0-indexed in Date
  const yearNum = parseInt(year, 10);

  if (timePart) {
    const [hours, minutes, seconds] = timePart.split(":");
    const date = new Date(
      yearNum,
      monthNum,
      dayNum,
      parseInt(hours, 10),
      parseInt(minutes, 10),
      parseInt(seconds, 10),
    );
    return date;
  }

  return new Date(yearNum, monthNum, dayNum);
}

// Set expected headers to enforce structure validation if known.
// Leave as [] to skip strict header comparison.
const EXPECTED_HEADERS: string[] = [];

type CellPrimitive = string | number | boolean | Date;
export type CellValue = CellPrimitive | null;

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

function isEmptyRow(row: Record<string, CellValue>): boolean {
  const values = Object.values(row);
  return values.every(isEmptyValue);
}

function startsWithTotais(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.trim().toLowerCase().startsWith("totais");
}

export async function parseRelatorioDeVendas(
  file: File,
): Promise<{ result?: ParsedRelatorio; error?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { error: "Arquivo Excel sem planilhas." };
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows: CellPrimitive[][] = XLSX.utils.sheet_to_json<CellPrimitive[]>(
      sheet,
      {
        header: 1,
        defval: "",
      },
    );
    if (!rows || rows.length === 0) {
      return { error: "Planilha vazia." };
    }

    const headersRaw = (rows[0] || []).map((h) =>
      typeof h === "string" ? h : String(h),
    );
    const headers = headersRaw.map((h) => h.trim());

    if (headers.length === 0 || headers.every((h) => h === "")) {
      return { error: "Cabeçalho ausente ou inválido no arquivo." };
    }

    if (EXPECTED_HEADERS.length > 0) {
      const expected = EXPECTED_HEADERS.map(normalize);
      const actual = headers.map(normalize);
      const sameLength = expected.length === actual.length;
      const sameValues =
        sameLength && expected.every((h, i) => h === actual[i]);
      if (!sameValues) {
        return {
          error: "Estrutura do relatório não corresponde ao formato esperado.",
        };
      }
    }

    const dataRows = rows.slice(1);
    const objects = dataRows.map((rowArr) => {
      const obj: Record<string, CellValue> = {};
      headers.forEach((h, i) => {
        const val = rowArr[i];
        obj[h] = (val === undefined ? null : val) as CellValue;
      });
      return obj;
    });

    const filtered = objects.filter((row) => {
      if (isEmptyRow(row)) return false;
      const firstHeader = headers[0];
      const firstValue = row[firstHeader];
      if (startsWithTotais(firstValue)) return false;
      return true;
    });

    if (filtered.length === 0) {
      return {
        error: "Nenhuma linha válida encontrada após aplicar as regras.",
      };
    }

    // Convert date-like fields to actual Date objects
    const commonDateFields = [
      "data",
      "date",
      "data da venda",
      "data da transação",
      "data do pagamento",
      "dt. pedido",
      "dt. entrega",
    ];
    const convertedData = filtered.map((row) => {
      const newRow: Record<string, CellValue> = { ...row };

      for (const header of headers) {
        const headerLower = header.toLowerCase();
        // Check if header contains common date field indicators
        if (commonDateFields.some((field) => headerLower.includes(field))) {
          const value = row[header];
          if (typeof value === "string" && value.trim()) {
            newRow[header] = parseBRDate(value);
          }
        }
      }

      return newRow;
    });

    return { result: { headers, data: convertedData as DadoRelatorio[] } };
  } catch (err) {
    return {
      error:
        "Falha ao processar o arquivo: " +
        (err instanceof Error ? err.message : String(err)),
    };
  }
}
