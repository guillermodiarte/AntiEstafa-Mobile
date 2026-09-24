"use client";

import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { ThreatSearch } from '../components/ThreatSearch';
import { ScamTypesGuide } from '../components/ScamTypesGuide';
import { ReportForm } from '../components/ReportForm';
import { StatsAndApi } from '../components/StatsAndApi';
import { apiService } from '../services/api';
import { Shield, Heart, Lock, Smartphone } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [activeTab, setActiveTab] = useState('search');
  const [largeText, setLargeText] = useState(false);
  const [syncVersion, setSyncVersion] = useState(10);

  const fetchGlobalMeta = async () => {
    try {
      const stats = await apiService.getStats();
      setSyncVersion(stats.current_sync_version);
    } catch (e) {
      console.warn("Could not refresh meta:", e);
    }
  };

  useEffect(() => {
    fetchGlobalMeta();
  }, []);

  return (
    <div className={`min-h-screen flex flex-col justify-between transition-all ${largeText ? 'text-lg' : 'text-base'}`}>
      {/* Background radial effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[32rem] h-[32rem] bg-indigo-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-[32rem] h-[32rem] bg-cyan-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-[32rem] h-[32rem] bg-emerald-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col flex-grow">
        {/* Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          largeText={largeText}
          setLargeText={setLargeText}
          syncVersion={syncVersion}
        />

        {/* Hero Section Banner for Demo */}
        <section className="border-b border-white/5 bg-gradient-to-b from-indigo-950/20 to-transparent py-3.5 px-4 text-center">
          <div className="max-w-[1560px] mx-auto flex flex-wrap items-center justify-center gap-4 md:gap-8 text-xs text-slate-400">
            <span className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Shield className="w-4 h-4" />
              Protección 100% Offline Integrada en Móvil
            </span>
            <span className="hidden sm:inline text-slate-700">•</span>
            <span className="flex items-center gap-2 text-cyan-400 font-semibold">
              <Lock className="w-4 h-4" />
              Privacidad por Diseño (Sin leer chats completos)
            </span>
            <span className="hidden sm:inline text-slate-700">•</span>
            <span className="flex items-center gap-2 text-indigo-400 font-semibold">
              <Smartphone className="w-4 h-4" />
              Sincronización Incremental Android v{syncVersion}
            </span>
          </div>
        </section>

        {/* Main Content Area - Responsivo y amplio aprovechando toda la pantalla */}
        <main className="flex-grow max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-12">
          {activeTab === 'search' && (
            <ThreatSearch largeText={largeText} />
          )}

          {activeTab === 'scams' && (
            <ScamTypesGuide largeText={largeText} />
          )}

          {activeTab === 'report' && (
            <ReportForm
              largeText={largeText}
              onReportSubmitted={() => {
                fetchGlobalMeta();
              }}
            />
          )}

          {activeTab === 'stats' && (
            <StatsAndApi />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-950/90 backdrop-blur-md py-6 px-4 sm:px-6 lg:px-10 text-xs text-slate-500">
        <div className="max-w-[1560px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-black text-xs shadow-sm">
              E
            </div>
            <span className="font-bold text-slate-300">Escudo Digital</span>
            <span className="text-slate-500 hidden sm:inline">— Prevención y Asistencia Preventiva de Estafas Digitales</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Desarrollado para</span>
              <strong className="text-white">FormosaHack</strong>
              <span>con foco en adultos mayores</span>
              <Heart className="w-3.5 h-3.5 text-rose-500 inline fill-rose-500 ml-0.5" />
            </div>

            <Link
              href="/admin"
              className="text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-1 text-[11px] font-mono border-l border-white/10 pl-4"
              title="Panel Administrativo"
            >
              <Lock className="w-3 h-3" />
              Acceso Moderador
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
