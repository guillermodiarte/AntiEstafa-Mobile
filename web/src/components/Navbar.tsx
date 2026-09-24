"use client";

import React from 'react';
import { Shield, Search, BookOpen, AlertCircle, BarChart3, Lock, Eye } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  largeText: boolean;
  setLargeText: (val: boolean) => void;
  pendingCount: number;
  syncVersion: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  largeText,
  setLargeText,
  pendingCount,
  syncVersion
}) => {
  const navItems = [
    { id: 'search', label: 'Buscador de Amenazas', icon: Search },
    { id: 'scams', label: 'Modalidades Comunes', icon: BookOpen },
    { id: 'report', label: 'Reportar Estafa', icon: AlertCircle },
    { id: 'stats', label: 'Métricas & API', icon: BarChart3 },
    { 
      id: 'admin', 
      label: 'Panel Moderador', 
      icon: Lock,
      badge: pendingCount > 0 ? pendingCount : undefined
    },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#080d1a]/85 border-b border-white/10 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                Escudo Digital
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                v{syncVersion} Activo
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Ecosistema Abierto de Prevención de Estafas • FormosaHack
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-xl border border-white/10 shadow-inner overflow-x-auto max-w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 text-[11px] font-bold rounded-full bg-amber-500 text-slate-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Accessibility Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLargeText(!largeText)}
            title="Aumentar tamaño de letra para lectura más accesible"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              largeText
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-900 text-slate-400 border-white/10 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{largeText ? 'Letra Estándar' : 'Letra Grande (Adultos Mayores)'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
