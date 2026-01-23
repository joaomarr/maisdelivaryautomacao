"use client";

import { useState } from "react";
import type { RepasseCalculationResult } from "../utils/calculateRepasse";

type RepasseDisplayProps = {
  result: RepasseCalculationResult;
  onBack: () => void;
};

export function RepasseDisplay({ result, onBack }: RepasseDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const formatPercentage = (value: number) => {
    return (value * 100).toFixed(2) + "%";
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Relatório de Repasse às Lojas
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
              {result.calculations.length} estabelecimento(s) processado(s)
            </p>
          </div>
          <button
            onClick={onBack}
            className="rounded-lg bg-slate-500 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            ← Voltar
          </button>
        </div>

        {/* Summary Card */}
        <div className="mb-6 rounded-xl border border-slate-200/60 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-sm dark:border-gray-800 dark:from-green-950/20 dark:to-emerald-950/20">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Total Geral de Repasse
          </h2>
          <p className="text-4xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(result.totalRepasse)}
          </p>
        </div>

        {/* Establishments List */}
        <div className="space-y-4">
          {result.calculations.map((calc) => (
            <div
              key={calc.normalizedName}
              className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              {/* Header - Always visible */}
              <button
                onClick={() => toggleSection(calc.normalizedName)}
                className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors rounded-t-xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {expandedSections[calc.normalizedName] ? "▼" : "▶"}
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {calc.estabelecimento}
                        </h3>
                        {!calc.hasPercentage && (
                          <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                            ⚠️ Porcentagem não encontrada
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(calc.finalValue)}
                    </div>
                    {calc.hasPercentage && calc.percentage !== null && (
                      <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
                        Taxa aplicada: {formatPercentage(calc.percentage)}
                      </p>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {expandedSections[calc.normalizedName] && (
                <div className="border-t border-slate-200 dark:border-gray-700 px-6 py-4">
                  <div className="space-y-4">
                    {/* Calculation Breakdown */}
                    <div className="rounded-lg bg-slate-50 dark:bg-gray-800/50 p-4">
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                        Detalhamento do Cálculo
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-gray-400">
                            Valor Base (Produtos + Cupons + Promoções):
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {formatCurrency(calc.baseValue)}
                          </span>
                        </div>

                        {calc.occurrencesBeforeTax.length > 0 && (
                          <>
                            <div className="flex justify-between text-red-600 dark:text-red-400">
                              <span>
                                (-) Ocorrências antes da taxa (
                                {calc.occurrencesBeforeTax.length}):
                              </span>
                              <span className="font-medium">
                                {formatCurrency(calc.totalOccurrencesBeforeTax)}
                              </span>
                            </div>
                            <div className="ml-4 space-y-1 text-xs text-slate-500 dark:text-gray-500">
                              {calc.occurrencesBeforeTax.map((occ, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>• {occ.tipoOcorrencia}</span>
                                  <span>
                                    {formatCurrency(occ.valorDesconto)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        <div className="flex justify-between border-t border-slate-300 dark:border-gray-600 pt-2">
                          <span className="text-slate-600 dark:text-gray-400">
                            Subtotal antes da taxa:
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {formatCurrency(calc.valueBeforeTax)}
                          </span>
                        </div>

                        {calc.hasPercentage && calc.percentage !== null && (
                          <div className="flex justify-between text-blue-600 dark:text-blue-400">
                            <span>
                              Taxa aplicada: {formatPercentage(calc.percentage)}
                            </span>
                            <span className="font-medium">
                              {formatCurrency(calc.taxAmount)}
                            </span>
                          </div>
                        )}

                        {calc.occurrencesAfterTax.length > 0 && (
                          <>
                            <div className="flex justify-between text-red-600 dark:text-red-400">
                              <span>
                                (-) Ocorrências depois da taxa (
                                {calc.occurrencesAfterTax.length}):
                              </span>
                              <span className="font-medium">
                                {formatCurrency(calc.totalOccurrencesAfterTax)}
                              </span>
                            </div>
                            <div className="ml-4 space-y-1 text-xs text-slate-500 dark:text-gray-500">
                              {calc.occurrencesAfterTax.map((occ, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>• {occ.tipoOcorrencia}</span>
                                  <span>
                                    {formatCurrency(occ.valorDesconto)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        <div className="flex justify-between border-t-2 border-green-500 dark:border-green-600 pt-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            Valor Final de Repasse (com taxa aplicada):
                          </span>
                          <span className="text-lg font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(calc.finalValue)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sales Details */}
                    <div className="rounded-lg bg-slate-50 dark:bg-gray-800/50 p-4">
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                        Vendas ({calc.salesData.length} registro(s))
                      </h4>
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-slate-100 dark:bg-gray-700">
                            <tr>
                              <th className="px-2 py-1 text-left text-slate-700 dark:text-gray-300">
                                Produtos
                              </th>
                              <th className="px-2 py-1 text-right text-slate-700 dark:text-gray-300">
                                Cupom Adm
                              </th>
                              <th className="px-2 py-1 text-right text-slate-700 dark:text-gray-300">
                                Promoção Adm
                              </th>
                              <th className="px-2 py-1 text-right text-slate-700 dark:text-gray-300">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {calc.salesData.map((sale, idx) => {
                              const total =
                                sale.produtos +
                                sale.valorCupomAdm +
                                sale.valorPromocaoAdm;
                              return (
                                <tr
                                  key={idx}
                                  className="border-b border-slate-200 dark:border-gray-700"
                                >
                                  <td className="px-2 py-1 text-slate-900 dark:text-white">
                                    {formatCurrency(sale.produtos)}
                                  </td>
                                  <td className="px-2 py-1 text-right text-slate-900 dark:text-white">
                                    {formatCurrency(sale.valorCupomAdm)}
                                  </td>
                                  <td className="px-2 py-1 text-right text-slate-900 dark:text-white">
                                    {formatCurrency(sale.valorPromocaoAdm)}
                                  </td>
                                  <td className="px-2 py-1 text-right font-medium text-slate-900 dark:text-white">
                                    {formatCurrency(total)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
