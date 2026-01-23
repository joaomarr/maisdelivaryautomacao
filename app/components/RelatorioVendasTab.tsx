"use client";

import { parseRelatorioDeVendas } from "../utils/relatorioVendas";
import { parseTodosPagamentos } from "../utils/pagamentosParser";
import { reconcileRelatorioWithPagamentos } from "../utils/reconcileRelatorioPagamentos";
import type { DadoRelatorio } from "../utils/relatorioVendas";
import type { PagamentoRecord } from "../utils/pagamentosParser";
import type { ReconciliationResult } from "../utils/reconcileRelatorioPagamentos";

type ReportData = {
  relatorioData: DadoRelatorio[];
  pagamentos: PagamentoRecord[];
  reconciliation: ReconciliationResult;
};

type RelatorioVendasTabProps = {
  setShowReport: (show: boolean) => void;
  setReportData: (data: ReportData | null) => void;
  mainFile: File | null;
  setMainFile: (file: File | null) => void;
  pixSipagFile: File | null;
  setPixSipagFile: (file: File | null) => void;
  pixSicrediFile: File | null;
  setPixSicrediFile: (file: File | null) => void;
  maquinaSipagFile: File | null;
  setMaquinaSipagFile: (file: File | null) => void;
  maquinaSicrediFile: File | null;
  setMaquinaSicrediFile: (file: File | null) => void;
};

export function RelatorioVendasTab({
  setShowReport,
  setReportData,
  mainFile,
  setMainFile,
  pixSipagFile,
  setPixSipagFile,
  pixSicrediFile,
  setPixSicrediFile,
  maquinaSipagFile,
  setMaquinaSipagFile,
  maquinaSicrediFile,
  setMaquinaSicrediFile,
}: RelatorioVendasTabProps) {
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".csv"))) {
      setter(file);
    } else {
      setter(null);
    }
  };

  const hasPixFiles = pixSipagFile || pixSicrediFile;
  const hasMaquinaFiles = maquinaSipagFile || maquinaSicrediFile;
  const isLoadButtonEnabled = mainFile && (hasPixFiles || hasMaquinaFiles);

  const handleLoad = async () => {
    if (!isLoadButtonEnabled) return;

    let relatorioData;

    // Parse main file (Relatório de Vendas)
    if (mainFile) {
      const { result, error } = await parseRelatorioDeVendas(mainFile);
      if (error) {
        alert(error);
        return;
      }
      relatorioData = result;
    }

    // Parse payment files (Pix and Maquininha)
    const { result: pagamentos, errors } = await parseTodosPagamentos({
      pixSipag: pixSipagFile || undefined,
      pixSicredi: pixSicrediFile || undefined,
      maquinaSipag: maquinaSipagFile || undefined,
      maquinaSicredi: maquinaSicrediFile || undefined,
    });

    if (errors.length > 0) {
      alert(
        "Alguns arquivos de pagamento apresentaram erros:\n" +
          errors.join("\n"),
      );
      return;
    }

    if (pagamentos && pagamentos.length > 0 && relatorioData) {
      const reconciliation = reconcileRelatorioWithPagamentos({
        relatorio: relatorioData,
        pagamentos,
        toleranceMinutes: 720,
      });

      setReportData({
        relatorioData: relatorioData.data,
        pagamentos,
        reconciliation,
      });
      setShowReport(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main File - Relatorio de vendas */}
      <div className="rounded-lg border-2 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                1
              </span>
              Relatório de Vendas
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 ml-8">
              Arquivo principal obrigatório (XLSX ou CSV)
            </p>
          </div>
          {mainFile && (
            <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
              ✓ Carregado
            </span>
          )}
        </div>
        <div className="ml-8">
          <label className="block">
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => handleFileChange(e, setMainFile)}
              className="block w-full text-sm text-slate-600 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-500 file:text-white
                hover:file:bg-blue-600
                file:cursor-pointer cursor-pointer
                dark:file:bg-blue-600 dark:hover:file:bg-blue-700"
            />
          </label>
          {mainFile && (
            <div className="mt-2 flex items-center justify-between text-sm text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-md p-2">
              <span className="flex-1">📄 {mainFile.name}</span>
              <button
                onClick={() => setMainFile(null)}
                className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                aria-label="Remove file"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pix File */}
      <div className="rounded-lg border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500 text-xs text-white">
                2
              </span>
              Pix
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 ml-8">
              Arquivos opcionais (XLSX ou CSV)
            </p>
          </div>
          {hasPixFiles && (
            <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
              ✓ {[pixSipagFile, pixSicrediFile].filter(Boolean).length}{" "}
              arquivo(s)
            </span>
          )}
        </div>
        <div className="ml-8 space-y-4">
          {/* Sipag File */}
          <div className="rounded-md border border-slate-200 dark:border-gray-700 p-4 bg-slate-50 dark:bg-gray-800/50">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
              Sipag
            </label>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => handleFileChange(e, setPixSipagFile)}
              className="block w-full text-sm text-slate-600 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-slate-500 file:text-white
                hover:file:bg-slate-600
                file:cursor-pointer cursor-pointer
                dark:file:bg-gray-600 dark:hover:file:bg-gray-500"
            />
            {pixSipagFile && (
              <div className="mt-2 flex items-center justify-between text-sm text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-md p-2">
                <span className="flex-1">📄 {pixSipagFile.name}</span>
                <button
                  onClick={() => setPixSipagFile(null)}
                  className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Sicredi File */}
          <div className="rounded-md border border-slate-200 dark:border-gray-700 p-4 bg-slate-50 dark:bg-gray-800/50">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
              Sicredi
            </label>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => handleFileChange(e, setPixSicrediFile)}
              className="block w-full text-sm text-slate-600 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-slate-500 file:text-white
                hover:file:bg-slate-600
                file:cursor-pointer cursor-pointer
                dark:file:bg-gray-600 dark:hover:file:bg-gray-500"
            />
            {pixSicrediFile && (
              <div className="mt-2 flex items-center justify-between text-sm text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-md p-2">
                <span className="flex-1">📄 {pixSicrediFile.name}</span>
                <button
                  onClick={() => setPixSicrediFile(null)}
                  className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Máquina File */}
      <div className="rounded-lg border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500 text-xs text-white">
                3
              </span>
              Máquina
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 ml-8">
              Arquivos opcionais (XLSX ou CSV)
            </p>
          </div>
          {hasMaquinaFiles && (
            <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
              ✓ {[maquinaSipagFile, maquinaSicrediFile].filter(Boolean).length}{" "}
              arquivo(s)
            </span>
          )}
        </div>
        <div className="ml-8 space-y-4">
          {/* Sipag File */}
          <div className="rounded-md border border-slate-200 dark:border-gray-700 p-4 bg-slate-50 dark:bg-gray-800/50">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
              Sipag
            </label>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => handleFileChange(e, setMaquinaSipagFile)}
              className="block w-full text-sm text-slate-600 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-slate-500 file:text-white
                hover:file:bg-slate-600
                file:cursor-pointer cursor-pointer
                dark:file:bg-gray-600 dark:hover:file:bg-gray-500"
            />
            {maquinaSipagFile && (
              <div className="mt-2 flex items-center justify-between text-sm text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-md p-2">
                <span className="flex-1">📄 {maquinaSipagFile.name}</span>
                <button
                  onClick={() => setMaquinaSipagFile(null)}
                  className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Sicredi File */}
          <div className="rounded-md border border-slate-200 dark:border-gray-700 p-4 bg-slate-50 dark:bg-gray-800/50">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
              Sicredi
            </label>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => handleFileChange(e, setMaquinaSicrediFile)}
              className="block w-full text-sm text-slate-600 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-slate-500 file:text-white
                hover:file:bg-slate-600
                file:cursor-pointer cursor-pointer
                dark:file:bg-gray-600 dark:hover:file:bg-gray-500"
            />
            {maquinaSicrediFile && (
              <div className="mt-2 flex items-center justify-between text-sm text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-md p-2">
                <span className="flex-1">📄 {maquinaSicrediFile.name}</span>
                <button
                  onClick={() => setMaquinaSicrediFile(null)}
                  className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Load Button */}
      <div className="pt-6 border-t border-slate-200 dark:border-gray-700">
        <button
          onClick={handleLoad}
          disabled={!isLoadButtonEnabled}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-lg transition-all ${
            isLoadButtonEnabled
              ? "bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-xl dark:bg-green-600 dark:hover:bg-green-700"
              : "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600"
          }`}
        >
          {isLoadButtonEnabled
            ? "🚀 Processar Arquivos"
            : "⏳ Aguardando Arquivos"}
        </button>
        {!mainFile && (
          <p className="mt-3 text-sm text-center text-amber-600 dark:text-amber-500">
            ⚠️ O arquivo principal &quot;Relatório de Vendas&quot; é obrigatório
          </p>
        )}
        {mainFile && !hasPixFiles && !hasMaquinaFiles && (
          <p className="mt-3 text-sm text-center text-amber-600 dark:text-amber-500">
            ⚠️ É necessário pelo menos um arquivo adicional (Pix ou Máquina)
          </p>
        )}
      </div>
    </div>
  );
}
