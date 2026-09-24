"use client";

import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { ThreatSearch } from '../components/ThreatSearch';
import { ScamTypesGuide } from '../components/ScamTypesGuide';
import { ReportForm } from '../components/ReportForm';
import { AdminModeration } from '../components/AdminModeration';
import { StatsAndApi } from '../components/StatsAndApi';
import { apiService } from '../services/api';
import { Shield, Heart, Lock, Smartphone, RefreshCw } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('search');
  const [largeText, setLargeText] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncVersion, setSyncVersion] = useState(10);

  const fetchGlobalMeta = async () => {
    try {
      const stats = await apiService.getStats();
      setSyncVersion(stats.current_sync_version);

      const pendingReports = await apiService.getReports('pending');
      setPendingCount(pendingReports.length);
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
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col flex-grow">
        {/* Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          largeText={largeText}
          setLargeText={setLargeText}
          pendingCount={pendingCount}
          syncVersion={syncVersion}
        />

        {/* Hero Section Banner for Demo */}
        <section className="border-b border-white/5 bg-gradient-to-b from-indigo-950/20 to-transparent py-4 px-4 text-center">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Shield className="w-3.5 h-3.5" />
              Protección 100% Offline Integrada
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Lock className="w-3.5 h-3.5" />
              Privacidad por Diseño (Sin leer chats completos)
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
              <Smartphone className="w-3.5 h-3.5" />
              Sincronización Android v{syncVersion}
            </span>
          </div>
        </section>

        {/* Main Content Area */}
        <main className="flex-grow max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 lg:py-12">
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
                setActiveTab('admin');
              }}
            />
          )}

          {activeTab === 'stats' && (
            <StatsAndApi />
          )}

          {activeTab === 'admin' && (
            <AdminModeration
              syncVersion={syncVersion}
              onDataChanged={fetchGlobalMeta}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-950/80 backdrop-blur-md py-8 px-4 text-center text-xs text-slate-500 space-y-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-xs">
              E
            </div>
            <span className="font-bold text-slate-300">Escudo Digital</span>
            <span>— Prevención y Asistencia Preventiva de Estafas Digitales</span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <span>Desarrollado para</span>
            <strong className="text-white">FormosaHack</strong>
            <span>con foco en adultos mayores</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 inline fill-rose-500" />
          </div>
        </div>
      </footer>
    </div>
  );
}
