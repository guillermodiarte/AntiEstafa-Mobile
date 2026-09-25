"use client";

import React from 'react';
import { Shield, Search, BookOpen, AlertCircle, BarChart3, Eye } from 'lucide-react';
import Link from 'next/link';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  largeText: boolean;
  setLargeText: (val: boolean) => void;
  syncVersion: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  largeText,
  setLargeText,
  syncVersion
}) => {
  const navItems = [
    { id: 'search', label: 'Buscador de Amenazas', icon: Search },
    { id: 'report', label: 'Reportar Estafa', icon: AlertCircle },
    { id: 'scams', label: 'Modalidades Comunes', icon: BookOpen },
    { id: 'stats', label: 'Métricas & API', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#080d1a]/90 border-b border-white/10 px-4 sm:px-6 lg:px-10 py-3.5 transition-all">
      <div className="w-full max-w-[1600px] mx-auto flex flex-col xl:flex-row items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3.5 flex-shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                Escudo Digital
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                v{syncVersion} Activo
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Ecosistema Abierto de Prevención de Estafas • FormosaHack
            </p>
          </div>
        </div>

        {/* Navigation Tabs - Sin scroll horizontal, amplio y fluido */}
        <nav className="flex items-center flex-wrap justify-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 shadow-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/35 ring-1 ring-white/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls & Accessibility */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setLargeText(!largeText)}
            title="Aumentar tamaño de letra para lectura más accesible"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${largeText
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
              : 'bg-slate-900/90 text-slate-400 border-white/10 hover:text-slate-200 hover:border-white/20'
              }`}
          >
            <Eye className="w-4 h-4" />
            <span>{largeText ? 'Letra Estándar' : 'Letra Grande'}</span>
          </button>


        </div>
      </div>
    </header>
  );
};
