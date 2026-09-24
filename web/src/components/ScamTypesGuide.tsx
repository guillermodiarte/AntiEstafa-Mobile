"use client";

import React, { useState, useEffect } from 'react';
import { Users, CreditCard, Landmark, ShieldAlert, ShoppingBag, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { apiService } from '../services/api';
import { ScamType } from '../types';

interface ScamTypesGuideProps {
  largeText: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  users: Users,
  'credit-card': CreditCard,
  landmark: Landmark,
  'shield-alert': ShieldAlert,
  'shopping-bag': ShoppingBag
};

export const ScamTypesGuide: React.FC<ScamTypesGuideProps> = ({ largeText }) => {
  const [types, setTypes] = useState<ScamType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(1);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await apiService.getScamTypes();
        setTypes(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className={`${largeText ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl'} font-extrabold text-white`}>
          Modalidades Frecuentes de Estafas Digitales
        </h2>
        <p className={`${largeText ? 'text-lg' : 'text-sm'} text-slate-400 max-w-2xl mx-auto`}>
          Aprender a reconocer los engaños más comunes es la mejor herramienta de protección para vos y tu familia.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {types.map((scam) => {
            const Icon = iconMap[scam.icon || 'shield-alert'] || ShieldAlert;
            const isExpanded = expandedId === scam.id;

            return (
              <div
                key={scam.id}
                className="glass-panel overflow-hidden border-white/10 hover:border-indigo-500/40 transition-all"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : scam.id)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 bg-slate-900/50 hover:bg-slate-900/80 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className={`${largeText ? 'text-xl' : 'text-lg'} font-bold text-white`}>
                        {scam.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Categoría validada en la base central
                      </p>
                    </div>
                  </div>
                  <div className="text-slate-400 p-2">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-5 sm:p-6 border-t border-white/5 space-y-5 bg-slate-950/40">
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        ¿Cómo funciona este engaño?
                      </span>
                      <p className={`${largeText ? 'text-lg font-medium' : 'text-sm'} text-slate-200 leading-relaxed`}>
                        {scam.description}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" />
                        ¿Qué tenés que hacer si recibís esto?
                      </span>
                      <p className={`${largeText ? 'text-base font-semibold' : 'text-sm'} text-emerald-200 leading-relaxed`}>
                        {scam.advice}
                      </p>
                    </div>

                    {/* Señales de Alerta Típicas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                      <div className="bg-slate-900 p-3 rounded-lg border border-white/5">
                        <strong className="text-rose-400 block mb-1">🚨 Sensación de urgencia</strong>
                        Te dicen que se vence hoy o que alguien corre peligro para que no pienses.
                      </div>
                      <div className="bg-slate-900 p-3 rounded-lg border border-white/5">
                        <strong className="text-rose-400 block mb-1">🔑 Piden códigos o transferencias</strong>
                        Solicitan que mandes dinero o compartas el código de 6 dígitos de WhatsApp.
                      </div>
                      <div className="bg-slate-900 p-3 rounded-lg border border-white/5">
                        <strong className="text-rose-400 block mb-1">📱 Número desconocido</strong>
                        El contacto no figura en tu agenda o dice ser un 'nuevo número'.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
