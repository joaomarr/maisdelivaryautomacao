"use client";

type RepasseLojasTabProps = {
  onProcess: (files: {
    main: File;
    percentages: File;
    occurrences?: File;
  }) => void;
  mainFile: File | null;
  setMainFile: (file: File | null) => void;
  percentagesFile: File | null;
  setPercentagesFile: (file: File | null) => void;
  occurrencesFile: File | null;
  setOccurrencesFile: (file: File | null) => void;
};

export function RepasseLojasTab({
  onProcess,
  mainFile,
  setMainFile,
  percentagesFile,
  setPercentagesFile,
  occurrencesFile,
  setOccurrencesFile,
}: RepasseLojasTabProps) {
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".xlsx")) {
      setter(file);
    } else {
      setter(null);
    }
  };

  const isLoadButtonEnabled = mainFile && percentagesFile;

  const handleLoad = async () => {
    if (!isLoadButtonEnabled) return;

    onProcess({
      main: mainFile,
      percentages: percentagesFile,
      occurrences: occurrencesFile || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Main File - Relatorio vendas concluidas */}
      <div className="rounded-lg border-2 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                1
              </span>
              Relatório Vendas Concluídas
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 ml-8">
              Arquivo principal obrigatório (XLSX)
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
              accept=".xlsx"
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

      {/* Percentages File */}
      <div className="rounded-lg border-2 border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs text-white">
                2
              </span>
              Porcentagens
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 ml-8">
              Arquivo de percentuais por estabelecimento (XLSX)
            </p>
          </div>
          {percentagesFile && (
            <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
              ✓ Carregado
            </span>
          )}
        </div>
        <div className="ml-8">
          <label className="block">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => handleFileChange(e, setPercentagesFile)}
              className="block w-full text-sm text-slate-600 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-purple-500 file:text-white
                hover:file:bg-purple-600
                file:cursor-pointer cursor-pointer
                dark:file:bg-purple-600 dark:hover:file:bg-purple-700"
            />
          </label>
          {percentagesFile && (
            <div className="mt-2 flex items-center justify-between text-sm text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-md p-2">
              <span className="flex-1">📄 {percentagesFile.name}</span>
              <button
                onClick={() => setPercentagesFile(null)}
                className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                aria-label="Remove file"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Occurrences File - Optional */}
      <div className="rounded-lg border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500 text-xs text-white">
                3
              </span>
              Ocorrências
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 ml-8">
              Arquivo opcional de ocorrências (XLSX)
            </p>
          </div>
          {occurrencesFile && (
            <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
              ✓ Carregado
            </span>
          )}
        </div>
        <div className="ml-8">
          <label className="block">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => handleFileChange(e, setOccurrencesFile)}
              className="block w-full text-sm text-slate-600 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-slate-500 file:text-white
                hover:file:bg-slate-600
                file:cursor-pointer cursor-pointer
                dark:file:bg-gray-600 dark:hover:file:bg-gray-500"
            />
          </label>
          {occurrencesFile && (
            <div className="mt-2 flex items-center justify-between text-sm text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-md p-2">
              <span className="flex-1">📄 {occurrencesFile.name}</span>
              <button
                onClick={() => setOccurrencesFile(null)}
                className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                aria-label="Remove file"
              >
                ✕
              </button>
            </div>
          )}
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
            ? "🚀 Calcular Repasses"
            : "⏳ Aguardando Arquivos"}
        </button>
        {!mainFile && (
          <p className="mt-3 text-sm text-center text-amber-600 dark:text-amber-500">
            ⚠️ O arquivo &quot;Relatório Vendas Concluídas&quot; é obrigatório
          </p>
        )}
        {mainFile && !percentagesFile && (
          <p className="mt-3 text-sm text-center text-amber-600 dark:text-amber-500">
            ⚠️ O arquivo de &quot;Porcentagens&quot; é obrigatório
          </p>
        )}
      </div>
    </div>
  );
}
