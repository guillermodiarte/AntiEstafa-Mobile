"use client";

import React, { useState } from 'react';
import { Search, AlertTriangle, ShieldCheck, HelpCircle, Phone, Globe, Link as LinkIcon, ArrowRight, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/api';
import { ThreatCheckResult } from '../types';

interface ThreatSearchProps {
  largeText: boolean;
}

export const ThreatSearch: React.FC<ThreatSearchProps> = ({ largeText }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ThreatCheckResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [allowedNumbers, setAllowedNumbers] = useState<string[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  const handleSearch = async (valToSearch?: string) => {
    const term = (valToSearch !== undefined ? valToSearch : query).trim();
    if (!term) return;

    if (valToSearch) {
      setQuery(valToSearch);
    }

    setLoading(true);
    setHasSearched(true);
    setNotification(null);

    try {
      let res: ThreatCheckResult;
      if (term.includes('http://') || term.includes('https://') || term.includes('/')) {
        res = await apiService.checkUrl(term);
      } else if (term.includes('.') && !term.startsWith('+')) {
        res = await apiService.checkDomain(term);
      } else {
        res = await apiService.checkPhone(term);
      }
      setResult(res);
    } catch (e) {
      console.error(e);
      setResult({
        is_threat: false,
        risk_level: 'unknown',
        message: 'No pudimos verificar en este momento. Por precaución, no compartas datos sensibles.',
        details: null
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAllowNumber = (number: string) => {
    if (!allowedNumbers.includes(number)) {
      setAllowedNumbers([...allowedNumbers, number]);
      setNotification(`El número ${number} ha sido agregado a tu lista de confianza local.`);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const samplePresets = [
    { label: 'Teléfono sospechoso (Falso familiar)', value: '+5491138901234' },
    { label: 'Web fraudulenta (ANSES falsa)', value: 'anses-beneficios-gob-ar.site' },
    { label: 'Enlace phishing (Mercado Pago)', value: 'seguridad-mercadopago-alerta.com' },
    { label: 'Número de prueba limpio', value: '+5491144445555' },
  ];

  return (
    <div className="space-y-10 animate-fadeIn w-full">
      {/* Hero Presentation */}
      <div className="text-center max-w-4xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Buscador Preventivo de Seguridad Comunitaria</span>
        </div>
        <h1 className={`${largeText ? 'text-4xl lg:text-5xl' : 'text-3xl lg:text-4xl'} font-black tracking-tight text-white`}>
          ¿Tenés dudas sobre un mensaje o llamada?
        </h1>
        <p className={`${largeText ? 'text-xl' : 'text-base sm:text-lg'} text-slate-400 leading-relaxed max-w-3xl mx-auto`}>
          Escribí el <strong className="text-slate-200">número de teléfono</strong>, el <strong className="text-slate-200">enlace</strong> o la <strong className="text-slate-200">página web</strong> que te contactó. Te explicaremos en lenguaje simple y directo si presenta riesgos conocidos.
        </p>
      </div>

      {/* Search Input Box - Amplio y responsivo */}
      <div className="max-w-4xl mx-auto w-full">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="relative flex flex-col sm:flex-row items-center shadow-2xl rounded-2xl border-2 border-indigo-500/30 focus-within:border-indigo-500 bg-slate-900/90 transition-all p-1.5 gap-2"
        >
          <div className="flex items-center w-full pl-3 flex-grow">
            <Search className="w-6 h-6 text-indigo-400 flex-shrink-0" />
            <input
              id="threat-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: +54 9 11 3890-1234 o pagina-sospechosa.com"
              className={`w-full py-3.5 px-3 bg-transparent text-white placeholder-slate-500 outline-none ${
                largeText ? 'text-xl font-medium' : 'text-base sm:text-lg'
              }`}
            />
          </div>

          <button
            id="threat-search-button"
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-shrink-0"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Verificar Ahora</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick test buttons for jury / demo */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-slate-500 font-semibold mr-1">Pruebas rápidas:</span>
          {samplePresets.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSearch(item.value)}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-indigo-950/70 border border-slate-700/80 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-200 transition-all font-medium"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className="max-w-4xl mx-auto p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      {/* Result Card - Amplio, limpio y con excelente contraste */}
      {hasSearched && result && (
        <div className="max-w-5xl mx-auto animate-fadeIn w-full">
          {result.is_threat ? (
            /* Alerta de Riesgo Alto / Medio */
            <div className="glass-panel p-6 sm:p-10 border-rose-500/40 bg-gradient-to-b from-rose-950/20 via-slate-900/95 to-slate-900/95 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500"></div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0 shadow-lg shadow-rose-500/10">
                    <ShieldAlert className="w-9 h-9 animate-pulse" />
                  </div>
                  <div>
                    <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider">
                      🔴 Señales de Riesgo Detectadas
                    </span>
                    <h2 className={`${largeText ? 'text-3xl' : 'text-2xl sm:text-3xl'} font-black text-white mt-1 font-mono tracking-tight`}>
                      {result.details?.valor || query}
                    </h2>
                  </div>
                </div>

                <div className="text-left sm:text-right sm:self-center bg-slate-950/40 px-4 py-2 rounded-xl border border-white/5">
                  <span className="text-xs text-slate-400 block font-medium">Reportes en el sistema</span>
                  <span className="text-xl font-black text-rose-400">
                    {result.details?.cantidad_reportes || 1} advertencias
                  </span>
                </div>
              </div>

              {/* 3 Preguntas Clave según AGENTS.md (Sección 25) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 my-8">
                <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-2">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">1. ¿Qué detectamos?</span>
                  <p className={`${largeText ? 'text-lg font-semibold' : 'text-base font-semibold'} text-slate-100`}>
                    Modalidad: <span className="text-white underline decoration-rose-500/40">{result.details?.categoria || 'Posible fraude'}</span>
                  </p>
                </div>

                <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">2. ¿Por qué es peligroso?</span>
                  <p className={`${largeText ? 'text-base' : 'text-sm'} text-slate-300 leading-relaxed`}>
                    Coincide con estafas reportadas por la comunidad y verificadas en la base central de seguridad.
                  </p>
                </div>

                <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/5 space-y-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">3. ¿Qué hacer ahora?</span>
                  <p className={`${largeText ? 'text-base font-semibold' : 'text-sm font-semibold'} text-emerald-300 leading-relaxed`}>
                    {result.details?.recomendacion || 'No respondas, no transfieras dinero ni entregues códigos.'}
                  </p>
                </div>
              </div>

              {/* Botón de acción: Permitir número si el usuario sabe que es un conocido */}
              {result.details?.tipo === 'phone' && (
                <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
                  <p className="text-xs text-slate-400">
                    ¿Es el teléfono de un familiar o amigo real? Podés agregarlo a tu lista blanca local en la app móvil.
                  </p>
                  <button
                    onClick={() => handleAllowNumber(result.details?.valor || query)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-white/10 transition-all whitespace-nowrap"
                  >
                    Permitir este número en mi dispositivo
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Resultado Sin Antecedentes */
            <div className="glass-panel p-6 sm:p-10 border-emerald-500/30 bg-gradient-to-b from-emerald-950/15 via-slate-900/95 to-slate-900/95 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500"></div>

              <div className="flex items-start gap-5">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0 shadow-lg shadow-emerald-500/10">
                  <ShieldCheck className="w-9 h-9" />
                </div>
                <div className="space-y-3 flex-grow">
                  <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                    🟢 Sin antecedentes negativos
                  </span>
                  <h2 className={`${largeText ? 'text-3xl' : 'text-2xl sm:text-3xl'} font-black text-white font-mono`}>
                    {query}
                  </h2>
                  <p className={`${largeText ? 'text-lg' : 'text-base'} text-slate-300 leading-relaxed`}>
                    No encontramos denuncias activas en la base central comunitaria para este registro.
                  </p>

                  <div className="p-5 rounded-2xl bg-slate-950/70 border border-white/5 mt-4 space-y-1.5">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4" />
                      Consejo de Prevención Permanente
                    </span>
                    <p className={`${largeText ? 'text-base' : 'text-sm'} text-slate-300 leading-relaxed`}>
                      Aunque un número sea nuevo o no tenga reportes aún, recordá: ningún banco ni organismo oficial (ANSES, PAMI, AFIP) te pedirá claves, tokens de 6 dígitos ni que te acerques a un cajero automático para cobrar un beneficio.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
