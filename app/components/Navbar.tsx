"use client";

import { useState } from "react";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const [activeTab, setActiveTab] = useState("tab1");

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent dark:from-white dark:to-gray-300">
              Mais Delivery Automação
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {/* <div className="flex space-x-1 rounded-lg bg-slate-100/80 p-1 dark:bg-gray-800">
              <button
                onClick={() => setActiveTab("tab1")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === "tab1"
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                }`}
              >
                Relatório de Vendas
              </button>
              <button
                onClick={() => setActiveTab("tab2")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === "tab2"
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                }`}
              >
                Repasse lojas
              </button>
            </div> */}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
