"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import {
  parseVendasConcluidas,
  parsePercentages,
  parseOccurrences,
} from "./utils/repasseLojasParser";
import { calculateRepasse } from "./utils/calculateRepasse";
import { RelatorioVendasTab } from "./components/RelatorioVendasTab";
import { RepasseLojasTab } from "./components/RepasseLojasTab";
import { RepasseDisplay } from "./components/RepasseDisplay";
import type { DadoRelatorio } from "./utils/relatorioVendas";
import type { PagamentoRecord } from "./utils/pagamentosParser";
import type { ReconciliationResult } from "./utils/reconcileRelatorioPagamentos";
import type { RepasseCalculationResult } from "./utils/calculateRepasse";

type ReportData = {
  relatorioData: DadoRelatorio[];
  pagamentos: PagamentoRecord[];
  reconciliation: ReconciliationResult;
};

type TabType = "relatorio-vendas" | "repasse-lojas";

// Helper function to normalize payment text
function normalizePaymentText(value: string | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ReportView({
  data,
  onBack,
}: {
  data: ReportData;
  onBack: () => void;
}) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [expandedMissing, setExpandedMissing] = useState<
    Record<string, boolean>
  >({});

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMissing = (key: string) => {
    setExpandedMissing((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Group data by Entregador
  const groupedByEntregador = data.relatorioData.reduce(
    (acc, row) => {
      const entregador = row.Entregador || "Sem Entregador";
      if (!acc[entregador]) {
        acc[entregador] = [];
      }
      acc[entregador].push(row);
      return acc;
    },
    {} as Record<string, DadoRelatorio[]>,
  );

  // Find related payments (same value but different time)
  const findRelatedPayments = (missing: DadoRelatorio) => {
    let valorToMatch = missing["Vl. Total (R$)"];

    // If Frete Grátis is "SIM", subtract the delivery value
    if (missing["Frete Grátis"] === "SIM") {
      const vlEntrega = Number(missing["Vl. Entrega (R$)"] ?? 0);
      valorToMatch -= vlEntrega;
    }

    const matchingPayments = data.pagamentos.filter(
      (p) => Math.abs(p.valor - valorToMatch) < 0.01,
    );

    // Find the relatorio entry that matches each payment
    return matchingPayments.map((payment) => {
      const matchedRelatorio = data.relatorioData.find((rel) => {
        const pagamento = normalizePaymentText(rel.Pagamento);
        if (!pagamento.includes("cartao")) return false;

        let relValor = rel["Vl. Total (R$)"];
        if (rel["Frete Grátis"] === "SIM") {
          const vlEntrega = Number(rel["Vl. Entrega (R$)"] ?? 0);
          relValor -= vlEntrega;
        }

        const diffValor = Math.abs(relValor - payment.valor);
        const relData = rel["Dt. Pedido"] || rel["Dt. Entrega"];
        const diffTempo = relData
          ? Math.abs(new Date(relData).getTime() - payment.data.getTime())
          : Infinity;

        return diffValor < 0.01 && diffTempo <= 720 * 60 * 1000;
      });

      return { payment, relatorio: matchedRelatorio };
    });
  };

  // Scroll to payment row in table
  const scrollToPayment = (idPedido: string) => {
    const element = document.getElementById(`payment-${idPedido}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Highlight the row briefly
      element.classList.add("ring-4", "ring-blue-500", "ring-opacity-50");
      setTimeout(() => {
        element.classList.remove("ring-4", "ring-blue-500", "ring-opacity-50");
      }, 2000);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Create summary sheet
    const summaryData = [
      ["RELATÓRIO DE CONCILIAÇÃO"],
      [],
      ["Data de Geração:", new Date().toLocaleString("pt-BR")],
      [],
      ["RESUMO GERAL"],
      [
        "Pagamentos Conciliados",
        data.reconciliation.matchedCount,
        "R$ " + overallTotals.matched.toFixed(2),
      ],
      [
        "Pagamentos Não Conciliados",
        data.reconciliation.missingRelatorioEntries.length,
        "R$ " + overallTotals.notMatched.toFixed(2),
      ],
      [
        "Total de Pedidos",
        data.relatorioData.length,
        "R$ " + overallTotals.total.toFixed(2),
      ],
      [],
      ["TOTAIS POR TIPO DE PAGAMENTO"],
      ["Dinheiro", "", "R$ " + overallTotals.dinheiro.toFixed(2)],
      ["Cartão", "", "R$ " + overallTotals.cartao.toFixed(2)],
      ["Pix", "", "R$ " + overallTotals.pix.toFixed(2)],
      [],
      ["CARTÃO - DETALHAMENTO"],
      ["Conciliado", "", "R$ " + overallTotals.matched.toFixed(2)],
      ["Não Conciliado", "", "R$ " + overallTotals.notMatched.toFixed(2)],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

    // Create a sheet for each Entregador
    Object.entries(groupedByEntregador)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([entregador, rows]) => {
        const totals = calculateTotals(rows);
        const missing = getMissingPerEntregador(entregador);

        const sheetData: (string | number)[][] = [
          [`ENTREGADOR: ${entregador}`],
          [],
          ["TOTAIS"],
          ["Total Geral", "R$ " + totals.total.toFixed(2)],
          ["Dinheiro", "R$ " + totals.dinheiro.toFixed(2)],
          ["Cartão", "R$ " + totals.cartao.toFixed(2)],
          ["Pix", "R$ " + totals.pix.toFixed(2)],
          ["Cartão Conciliado", "R$ " + totals.matched.toFixed(2)],
          ["Cartão Não Conciliado", "R$ " + totals.notMatched.toFixed(2)],
          [],
        ];

        // Add missing payments section if any
        if (missing.length > 0) {
          sheetData.push(["PAGAMENTOS NÃO CONCILIADOS"]);
          sheetData.push([
            "ID Pedido",
            "Data",
            "Pagamento",
            "Valor Total",
            "Frete Grátis",
            "Observação",
          ]);
          missing.forEach((m) => {
            let displayValue = m["Vl. Total (R$)"];
            if (m["Frete Grátis"] === "SIM") {
              const vlEntrega = Number(m["Vl. Entrega (R$)"] ?? 0);
              displayValue -= vlEntrega;
            }
            sheetData.push([
              m["ID Pedido"],
              new Date(m["Dt. Pedido"]).toLocaleString("pt-BR"),
              m.Pagamento,
              displayValue.toFixed(2),
              m["Frete Grátis"] || "NÃO",
              m.Observação || "",
            ]);
          });
          sheetData.push([]);
        }

        // Add all transactions
        sheetData.push(["TODOS OS PEDIDOS"]);
        sheetData.push([
          "ID Pedido",
          "Data Pedido",
          "Data Entrega",
          "Pagamento",
          "Valor Pedido",
          "Valor Entrega",
          "Valor Total",
          "Frete Grátis",
          "Estabelecimento",
          "Status Conciliação",
        ]);

        rows.forEach((row) => {
          const isMatched = data.reconciliation.matchedPairs.some(
            (pair) => pair.relatorio["ID Pedido"] === row["ID Pedido"],
          );
          const isCard = normalizePaymentText(row.Pagamento).includes("cartao");

          sheetData.push([
            row["ID Pedido"],
            new Date(row["Dt. Pedido"]).toLocaleDateString("pt-BR"),
            new Date(row["Dt. Entrega"]).toLocaleDateString("pt-BR"),
            row.Pagamento,
            row["Vl. Pedido (R$)"]?.toFixed(2) || "0.00",
            row["Vl. Entrega (R$)"]?.toFixed(2) || "0.00",
            row["Vl. Total (R$)"]?.toFixed(2) || "0.00",
            row["Frete Grátis"] || "NÃO",
            row.Estabelecimento || "",
            isCard ? (isMatched ? "Conciliado" : "Não Conciliado") : "N/A",
          ]);
        });

        const sheet = XLSX.utils.aoa_to_sheet(sheetData);
        // Sanitize sheet name (max 31 chars, no special chars)
        const sheetName = entregador
          .substring(0, 31)
          .replace(/[:\\/?*\[\]]/g, "-");
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      });

    // Create sheet for all missing payments
    if (data.reconciliation.missingRelatorioEntries.length > 0) {
      const missingData: (string | number)[][] = [
        ["TODOS OS PAGAMENTOS NÃO CONCILIADOS"],
        [],
        [
          "ID Pedido",
          "Entregador",
          "Data Pedido",
          "Pagamento",
          "Valor Total",
          "Frete Grátis",
          "Estabelecimento",
          "Observação",
        ],
      ];

      data.reconciliation.missingRelatorioEntries.forEach((m) => {
        let displayValue = m["Vl. Total (R$)"];
        if (m["Frete Grátis"] === "SIM") {
          const vlEntrega = Number(m["Vl. Entrega (R$)"] ?? 0);
          displayValue -= vlEntrega;
        }
        missingData.push([
          m["ID Pedido"],
          m.Entregador || "Sem Entregador",
          new Date(m["Dt. Pedido"]).toLocaleString("pt-BR"),
          m.Pagamento,
          displayValue.toFixed(2),
          m["Frete Grátis"] || "NÃO",
          m.Estabelecimento || "",
          m.Observação || "",
        ]);
      });

      const missingSheet = XLSX.utils.aoa_to_sheet(missingData);
      XLSX.utils.book_append_sheet(workbook, missingSheet, "Não Conciliados");
    }

    // Generate file and download
    const fileName = `Relatorio_Conciliacao_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Calculate totals per entregador
  const calculateTotals = (rows: DadoRelatorio[]) => {
    const totals = {
      dinheiro: 0,
      cartao: 0,
      pix: 0,
      total: 0,
      matched: 0,
      notMatched: 0,
    };

    rows.forEach((row) => {
      const pagamento = normalizePaymentText(row.Pagamento);
      let valor = row["Vl. Total (R$)"] || 0;

      // If Frete Grátis is "SIM", subtract the delivery value for card payments
      if (row["Frete Grátis"] === "SIM" && pagamento.includes("cartao")) {
        const vlEntrega = Number(row["Vl. Entrega (R$)"] ?? 0);
        valor -= vlEntrega;
      }

      if (pagamento.includes("dinheiro")) {
        totals.dinheiro += valor;
      } else if (pagamento.includes("cartao")) {
        totals.cartao += valor;
        // Check if this card payment was matched
        const isMatched = data.reconciliation.matchedPairs.some(
          (pair) => pair.relatorio["ID Pedido"] === row["ID Pedido"],
        );
        if (isMatched) {
          totals.matched += valor;
        } else {
          totals.notMatched += valor;
        }
      } else if (pagamento.includes("pix")) {
        totals.pix += valor;
      }

      totals.total += row["Vl. Total (R$)"] || 0;
    });

    return totals;
  };

  // Get missing payments per entregador
  const getMissingPerEntregador = (entregador: string) => {
    return data.reconciliation.missingRelatorioEntries.filter(
      (entry) => (entry.Entregador || "Sem Entregador") === entregador,
    );
  };

  // Calculate overall totals
  const overallTotals = Object.keys(groupedByEntregador).reduce(
    (acc, entregador) => {
      const totals = calculateTotals(groupedByEntregador[entregador]);
      return {
        dinheiro: acc.dinheiro + totals.dinheiro,
        cartao: acc.cartao + totals.cartao,
        pix: acc.pix + totals.pix,
        total: acc.total + totals.total,
        matched: acc.matched + totals.matched,
        notMatched: acc.notMatched + totals.notMatched,
      };
    },
    { dinheiro: 0, cartao: 0, pix: 0, total: 0, matched: 0, notMatched: 0 },
  );

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-gray-950 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
              Relatório de Conciliação
            </h1>
            <p className="mt-2 text-slate-600 dark:text-gray-400">
              Análise detalhada dos pagamentos por entregador
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportToExcel}
              className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors dark:bg-green-700 dark:hover:bg-green-600 flex items-center gap-2"
            >
              <span>📊</span> Exportar Excel
            </button>
            <button
              onClick={onBack}
              className="rounded-lg bg-slate-600 px-4 py-2 text-white hover:bg-slate-700 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              ← Voltar
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-6 border-2 border-green-200 dark:border-green-900">
            <h3 className="text-sm font-medium text-green-900 dark:text-green-300">
              Pagamentos Conciliados
            </h3>
            <p className="mt-2 text-3xl font-bold text-green-700 dark:text-green-400">
              {data.reconciliation.matchedCount}
            </p>
            <p className="mt-1 text-sm text-green-600 dark:text-green-500">
              R$ {overallTotals.matched.toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-6 border-2 border-red-200 dark:border-red-900">
            <h3 className="text-sm font-medium text-red-900 dark:text-red-300">
              Pagamentos Não Conciliados
            </h3>
            <p className="mt-2 text-3xl font-bold text-red-700 dark:text-red-400">
              {data.reconciliation.missingRelatorioEntries.length}
            </p>
            <p className="mt-1 text-sm text-red-600 dark:text-red-500">
              R$ {overallTotals.notMatched.toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-6 border-2 border-blue-200 dark:border-blue-900">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">
              Total Geral
            </h3>
            <p className="mt-2 text-3xl font-bold text-blue-700 dark:text-blue-400">
              {data.relatorioData.length}
            </p>
            <p className="mt-1 text-sm text-blue-600 dark:text-blue-500">
              R$ {overallTotals.total.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Reports by Entregador */}
        <div className="space-y-6">
          {Object.entries(groupedByEntregador)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([entregador, rows]) => {
              const totals = calculateTotals(rows);
              const missing = getMissingPerEntregador(entregador);
              const hasMissing = missing.length > 0;
              const sectionKey = `entregador-${entregador}`;
              const isExpanded = expandedSections[sectionKey] ?? hasMissing;

              return (
                <div
                  key={entregador}
                  className={`rounded-xl border-2 ${
                    hasMissing
                      ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                      : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                  } shadow-sm overflow-hidden`}
                >
                  {/* Entregador Header */}
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {hasMissing && (
                        <span className="text-2xl" title="Pagamentos faltantes">
                          ⚠️
                        </span>
                      )}
                      <div className="text-left">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                          {entregador}
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-gray-400">
                          {rows.length} pedidos • {missing.length} não
                          conciliados
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl text-slate-400 dark:text-gray-500">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  </button>

                  {/* Entregador Content */}
                  {isExpanded && (
                    <div className="px-6 pb-6">
                      {/* Missing Payments Section */}
                      {hasMissing && (
                        <div className="mb-6 rounded-lg bg-red-100 dark:bg-red-900/20 p-4 border border-red-300 dark:border-red-800">
                          <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-3 flex items-center gap-2">
                            <span>⚠️</span>
                            Pagamentos Não Conciliados ({missing.length})
                          </h3>
                          <div className="space-y-2">
                            {missing.map((missingEntry, idx) => {
                              const relatedPayments =
                                findRelatedPayments(missingEntry);
                              const missingKey = `missing-${entregador}-${idx}`;
                              const isMissingExpanded =
                                expandedMissing[missingKey] ?? false;

                              let displayValue = missingEntry["Vl. Total (R$)"];
                              if (missingEntry["Frete Grátis"] === "SIM") {
                                const vlEntrega = Number(
                                  missingEntry["Vl. Entrega (R$)"] ?? 0,
                                );
                                displayValue -= vlEntrega;
                              }

                              return (
                                <div
                                  key={idx}
                                  className="bg-white dark:bg-gray-800 rounded-md p-3 border border-red-200 dark:border-red-700"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm bg-slate-100 dark:bg-gray-700 px-2 py-1 rounded">
                                          {missingEntry["ID Pedido"]}
                                        </span>
                                        <span className="text-sm text-slate-600 dark:text-gray-400">
                                          {new Date(
                                            missingEntry["Dt. Pedido"],
                                          ).toLocaleString("pt-BR")}
                                        </span>
                                      </div>
                                      <div className="mt-1 flex items-center gap-4">
                                        <span className="font-semibold text-red-700 dark:text-red-400">
                                          R$ {displayValue.toFixed(2)}
                                        </span>
                                        <span className="text-sm text-slate-600 dark:text-gray-400">
                                          {missingEntry.Pagamento}
                                        </span>
                                        {missingEntry["Frete Grátis"] ===
                                          "SIM" && (
                                          <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
                                            Frete Grátis
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {relatedPayments.length > 0 && (
                                      <button
                                        onClick={() =>
                                          toggleMissing(missingKey)
                                        }
                                        className="ml-2 px-3 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                      >
                                        {relatedPayments.length} relacionado(s){" "}
                                        {isMissingExpanded ? "▲" : "▼"}
                                      </button>
                                    )}
                                  </div>

                                  {/* Related Payments */}
                                  {isMissingExpanded &&
                                    relatedPayments.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-700">
                                        <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-300 mb-2">
                                          Pagamentos Relacionados (mesmo valor):
                                        </h4>
                                        <div className="space-y-2">
                                          {relatedPayments.map(
                                            ({ payment, relatorio }, pIdx) => (
                                              <div
                                                key={pIdx}
                                                className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded text-xs border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors"
                                              >
                                                <div className="flex items-start justify-between mb-2">
                                                  <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                      <span className="font-semibold text-amber-900 dark:text-amber-300">
                                                        {payment.provider.toUpperCase()}{" "}
                                                        {payment.tipo.toUpperCase()}
                                                      </span>
                                                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                                                        R${" "}
                                                        {payment.valor.toFixed(
                                                          2,
                                                        )}
                                                      </span>
                                                    </div>
                                                    <div className="text-amber-600 dark:text-amber-500">
                                                      {new Date(
                                                        payment.data,
                                                      ).toLocaleString("pt-BR")}
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-amber-700 dark:text-amber-400">
                                                  <div>
                                                    <span className="font-medium">
                                                      Transação:
                                                    </span>{" "}
                                                    {payment.codigoTransacao}
                                                  </div>
                                                  {payment.status && (
                                                    <div>
                                                      <span className="font-medium">
                                                        Status:
                                                      </span>{" "}
                                                      {payment.status}
                                                    </div>
                                                  )}
                                                  {payment.terminal && (
                                                    <div>
                                                      <span className="font-medium">
                                                        Terminal:
                                                      </span>{" "}
                                                      {payment.terminal}
                                                    </div>
                                                  )}
                                                  {payment.bandeira && (
                                                    <div>
                                                      <span className="font-medium">
                                                        Bandeira:
                                                      </span>{" "}
                                                      {payment.bandeira}
                                                    </div>
                                                  )}
                                                </div>
                                                {relatorio && (
                                                  <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-700">
                                                    <div className="flex items-center justify-between">
                                                      <div>
                                                        <span className="font-medium text-amber-900 dark:text-amber-300">
                                                          Entregador:{" "}
                                                        </span>
                                                        <span className="text-amber-700 dark:text-amber-400">
                                                          {relatorio.Entregador ||
                                                            "N/A"}
                                                        </span>
                                                        <span className="ml-3 font-medium text-amber-900 dark:text-amber-300">
                                                          ID:{" "}
                                                        </span>
                                                        <span className="font-mono text-amber-700 dark:text-amber-400">
                                                          {
                                                            relatorio[
                                                              "ID Pedido"
                                                            ]
                                                          }
                                                        </span>
                                                      </div>
                                                      <button
                                                        onClick={() =>
                                                          scrollToPayment(
                                                            relatorio[
                                                              "ID Pedido"
                                                            ],
                                                          )
                                                        }
                                                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                                                        title="Ir para o pagamento"
                                                      >
                                                        📍 Ver
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Transactions Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-gray-300">
                                ID Pedido
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-gray-300">
                                Data
                              </th>
                              <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-gray-300">
                                Pagamento
                              </th>
                              <th className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-gray-300">
                                Valor Total
                              </th>
                              <th className="px-4 py-2 text-center font-semibold text-slate-700 dark:text-gray-300">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                            {rows.map((row, idx) => {
                              const isMatched =
                                data.reconciliation.matchedPairs.some(
                                  (pair) =>
                                    pair.relatorio["ID Pedido"] ===
                                    row["ID Pedido"],
                                );
                              const isCard = normalizePaymentText(
                                row.Pagamento,
                              ).includes("cartao");
                              const isMissing = missing.some(
                                (m) => m["ID Pedido"] === row["ID Pedido"],
                              );

                              return (
                                <tr
                                  key={idx}
                                  id={`payment-${row["ID Pedido"]}`}
                                  className={`${
                                    isMissing
                                      ? "bg-red-50 dark:bg-red-950/20"
                                      : "bg-white dark:bg-gray-900"
                                  } hover:bg-slate-50 dark:hover:bg-gray-800 transition-all`}
                                >
                                  <td className="px-4 py-2 font-mono text-xs">
                                    {row["ID Pedido"]}
                                  </td>
                                  <td className="px-4 py-2 text-slate-600 dark:text-gray-400">
                                    {new Date(
                                      row["Dt. Pedido"],
                                    ).toLocaleDateString("pt-BR")}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                        normalizePaymentText(
                                          row.Pagamento,
                                        ).includes("dinheiro")
                                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                          : normalizePaymentText(
                                                row.Pagamento,
                                              ).includes("cartao")
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                                            : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                                      }`}
                                    >
                                      {row.Pagamento}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold text-slate-900 dark:text-white">
                                    R${" "}
                                    {row["Vl. Total (R$)"]?.toFixed(2) ||
                                      "0.00"}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    {isCard ? (
                                      isMatched ? (
                                        <span
                                          className="inline-block text-green-500"
                                          title="Conciliado"
                                        >
                                          ✓
                                        </span>
                                      ) : (
                                        <span
                                          className="inline-block text-red-500"
                                          title="Não conciliado"
                                        >
                                          ✗
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-slate-400 dark:text-gray-600">
                                        —
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {/* Totals Row */}
                          <tfoot className="bg-slate-200 dark:bg-gray-800 font-semibold">
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-3 text-right text-slate-900 dark:text-white"
                              >
                                TOTAIS:
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                                R$ {totals.total.toFixed(2)}
                              </td>
                              <td></td>
                            </tr>
                            <tr className="text-xs">
                              <td
                                colSpan={3}
                                className="px-4 py-1 text-right text-slate-700 dark:text-gray-300"
                              >
                                Dinheiro:
                              </td>
                              <td className="px-4 py-1 text-right text-green-700 dark:text-green-400">
                                R$ {totals.dinheiro.toFixed(2)}
                              </td>
                              <td></td>
                            </tr>
                            <tr className="text-xs">
                              <td
                                colSpan={3}
                                className="px-4 py-1 text-right text-slate-700 dark:text-gray-300"
                              >
                                Cartão:
                              </td>
                              <td className="px-4 py-1 text-right text-blue-700 dark:text-blue-400">
                                R$ {totals.cartao.toFixed(2)}
                              </td>
                              <td></td>
                            </tr>
                            <tr className="text-xs">
                              <td
                                colSpan={3}
                                className="px-4 py-1 text-right text-slate-700 dark:text-gray-300"
                              >
                                Pix:
                              </td>
                              <td className="px-4 py-1 text-right text-purple-700 dark:text-purple-400">
                                R$ {totals.pix.toFixed(2)}
                              </td>
                              <td></td>
                            </tr>
                            <tr className="text-xs border-t border-slate-300 dark:border-gray-700">
                              <td
                                colSpan={3}
                                className="px-4 py-1 text-right text-slate-700 dark:text-gray-300"
                              >
                                Cartão Conciliado:
                              </td>
                              <td className="px-4 py-1 text-right text-green-700 dark:text-green-400">
                                R$ {totals.matched.toFixed(2)}
                              </td>
                              <td></td>
                            </tr>
                            <tr className="text-xs">
                              <td
                                colSpan={3}
                                className="px-4 py-1 text-right text-slate-700 dark:text-gray-300"
                              >
                                Cartão Não Conciliado:
                              </td>
                              <td className="px-4 py-1 text-right text-red-700 dark:text-red-400">
                                R$ {totals.notMatched.toFixed(2)}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Overall Totals */}
        <div className="mt-8 rounded-xl border-2 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-300 mb-4">
            Totais Gerais
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-blue-700 dark:text-blue-400">
                Total Geral
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                R$ {overallTotals.total.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-green-700 dark:text-green-400">
                Dinheiro
              </div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-300">
                R$ {overallTotals.dinheiro.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-blue-700 dark:text-blue-400">
                Cartão
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                R$ {overallTotals.cartao.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-purple-700 dark:text-purple-400">
                Pix
              </div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                R$ {overallTotals.pix.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-green-700 dark:text-green-400">
                Cartão Conciliado
              </div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-300">
                R$ {overallTotals.matched.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-red-700 dark:text-red-400">
                Cartão Não Conciliado
              </div>
              <div className="text-2xl font-bold text-red-900 dark:text-red-300">
                R$ {overallTotals.notMatched.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("relatorio-vendas");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [repasseResult, setRepasseResult] =
    useState<RepasseCalculationResult | null>(null);
  const [showRepasse, setShowRepasse] = useState(false);

  // File states for Relatório de Vendas
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [pixSipagFile, setPixSipagFile] = useState<File | null>(null);
  const [pixSicrediFile, setPixSicrediFile] = useState<File | null>(null);
  const [maquinaSipagFile, setMaquinaSipagFile] = useState<File | null>(null);
  const [maquinaSicrediFile, setMaquinaSicrediFile] = useState<File | null>(
    null,
  );

  // File states for Repasse Lojas
  const [repasseMainFile, setRepasseMainFile] = useState<File | null>(null);
  const [percentagesFile, setPercentagesFile] = useState<File | null>(null);
  const [occurrencesFile, setOccurrencesFile] = useState<File | null>(null);

  // Handle Repasse Lojas file processing
  const handleRepasseProcess = async (files: {
    main: File;
    percentages: File;
    occurrences?: File;
  }) => {
    try {
      // Parse main file
      const { result: vendasResult, error: vendasError } =
        await parseVendasConcluidas(files.main);
      if (vendasError) {
        alert(vendasError);
        return;
      }

      // Parse percentages file
      const { result: percentagesResult, error: percentagesError } =
        await parsePercentages(files.percentages);
      if (percentagesError) {
        alert(percentagesError);
        return;
      }

      // Parse occurrences file (optional)
      let occurrencesResult;
      if (files.occurrences) {
        const { result, error } = await parseOccurrences(files.occurrences);
        if (error) {
          alert(error);
          return;
        }
        occurrencesResult = result;
      }

      // Calculate repasse
      if (vendasResult && percentagesResult) {
        const calculation = calculateRepasse(
          vendasResult.data,
          percentagesResult.data,
          occurrencesResult?.data || [],
        );

        setRepasseResult(calculation);
        setShowRepasse(true);
      }
    } catch (error) {
      console.error("Error processing repasse files:", error);
      alert(
        `Erro ao processar arquivos: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  // If showing Relatorio Vendas report
  if (showReport && reportData) {
    return <ReportView data={reportData} onBack={() => setShowReport(false)} />;
  }

  // If showing Repasse Lojas report
  if (showRepasse && repasseResult) {
    return (
      <RepasseDisplay
        result={repasseResult}
        onBack={() => setShowRepasse(false)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200/60 bg-white p-8 shadow-sm ring-1 ring-slate-200/50 dark:border-gray-800 dark:bg-gray-900 dark:ring-gray-800">
          {/* Tabs Header */}
          <div className="mb-6">
            <div className="flex space-x-1 rounded-lg bg-slate-100 dark:bg-gray-800 p-1">
              <button
                onClick={() => setActiveTab("relatorio-vendas")}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === "relatorio-vendas"
                    ? "bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Relatório de Vendas
              </button>
              <button
                onClick={() => setActiveTab("repasse-lojas")}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === "repasse-lojas"
                    ? "bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Repasse Lojas
              </button>
            </div>
          </div>

          {/* Tab Title */}
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {activeTab === "relatorio-vendas"
              ? "Relatório de Vendas - Upload de Arquivos"
              : "Repasse Lojas - Upload de Arquivos"}
          </h2>
          <p className="text-slate-600 dark:text-gray-400 mb-8">
            Faça o upload dos arquivos necessários para processar os dados
          </p>

          {/* Tab Content */}
          {activeTab === "relatorio-vendas" ? (
            <RelatorioVendasTab
              setShowReport={setShowReport}
              setReportData={setReportData}
              mainFile={mainFile}
              setMainFile={setMainFile}
              pixSipagFile={pixSipagFile}
              setPixSipagFile={setPixSipagFile}
              pixSicrediFile={pixSicrediFile}
              setPixSicrediFile={setPixSicrediFile}
              maquinaSipagFile={maquinaSipagFile}
              setMaquinaSipagFile={setMaquinaSipagFile}
              maquinaSicrediFile={maquinaSicrediFile}
              setMaquinaSicrediFile={setMaquinaSicrediFile}
            />
          ) : (
            <RepasseLojasTab
              onProcess={handleRepasseProcess}
              mainFile={repasseMainFile}
              setMainFile={setRepasseMainFile}
              percentagesFile={percentagesFile}
              setPercentagesFile={setPercentagesFile}
              occurrencesFile={occurrencesFile}
              setOccurrencesFile={setOccurrencesFile}
            />
          )}
        </div>
      </div>
    </main>
  );
}
