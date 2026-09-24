"use client";

import React, { useState, useEffect } from 'react';
import { Users, CreditCard, Landmark, ShieldAlert, ShoppingBag, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
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
    <div className="space-y-10 animate-fadeIn w-full">
      <div className="text-center max-w-4xl mx-auto space-y-3">
        <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
          Educación y Detección Temprana
        </span>
        <h2 className={`${largeText ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl'} font-black text-white tracking-tight`}>
          Modalidades Frecuentes de Estafas Digitales
        </h2>
        <p className={`${largeText ? 'text-lg' : 'text-base'} text-slate-400 max-w-2xl mx-auto leading-relaxed`}>
          Aprender a reconocer los engaños más comunes es la primera y mejor línea de defensa para vos y toda tu familia.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center p-16">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {types.map((scam) => {
            const Icon = iconMap[scam.icon || 'shield-alert'] || ShieldAlert;

            return (
              <div
                key={scam.id}
                className="glass-panel p-6 sm:p-7 border-white/10 hover:border-indigo-500/30 flex flex-col justify-between transition-all group hover:shadow-2xl hover:shadow-indigo-500/10 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-60 group-hover:opacity-100 transition-opacity"></div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className={`${largeText ? 'text-xl' : 'text-lg'} font-bold text-white leading-snug`}>
                      {scam.name}
                    </h3>
                  </div>

                  <p className={`${largeText ? 'text-base' : 'text-sm'} text-slate-300 leading-relaxed`}>
                    {scam.description}
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-white/10 space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">¿Cómo protegerte?</span>
                  </div>
                  <div className="bg-slate-950/70 p-4 rounded-xl border border-white/5">
                    <p className={`${largeText ? 'text-base' : 'text-xs sm:text-sm'} font-medium text-slate-200 leading-relaxed`}>
                      {scam.advice || 'Desconfiá de la urgencia y verificá siempre con fuentes oficiales.'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
