"use client";

import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, MessageSquare, PhoneCall, Globe, AlertTriangle, ShieldCheck } from 'lucide-react';
import { apiService } from '../services/api';
import { ScamType, CitizenReport } from '../types';

interface ReportFormProps {
  largeText: boolean;
  onReportSubmitted?: () => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({ largeText, onReportSubmitted }) => {
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'call' | 'web'>('whatsapp');
  const [threatType, setThreatType] = useState<'phone' | 'domain' | 'url'>('phone');
  const [threatValue, setThreatValue] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [scamTypeId, setScamTypeId] = useState<number | undefined>(undefined);
  const [scamTypes, setScamTypes] = useState<ScamType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<CitizenReport | null>(null);

  useEffect(() => {
    async function loadScamTypes() {
      try {
        const types = await apiService.getScamTypes();
        setScamTypes(types);
        if (types.length > 0) {
          setScamTypeId(types[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadScamTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threatValue.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      const newReport = await apiService.submitReport({
        channel,
        threat_type: threatType,
        threat_value: threatValue.trim(),
        description: description.trim(),
        evidence: evidence.trim() || undefined,
        scam_type_id: scamTypeId,
        country: 'AR'
      });
      setSubmittedReport(newReport);
      setThreatValue('');
      setDescription('');
      setEvidence('');
      if (onReportSubmitted) {
        onReportSubmitted();
      }
    } catch (err) {
      console.error(err);
      alert('Hubo un error al enviar el reporte. Por favor intentá nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      <div className="text-center space-y-2">
        <h2 className={`${largeText ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl'} font-extrabold text-white`}>
          Reportar un Intento de Estafa
        </h2>
        <p className={`${largeText ? 'text-lg' : 'text-sm'} text-slate-400`}>
          Tu reporte anónimo ayuda a proteger a miles de adultos mayores. Los datos son revisados por el equipo antes de integrarse al motor de alertas.
        </p>
      </div>

      {submittedReport ? (
        <div className="glass-panel p-8 text-center space-y-5 border-emerald-500/30 bg-emerald-950/20">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">¡Gracias por tu reporte!</h3>
            <p className="text-slate-300 text-sm max-w-md mx-auto">
              El reporte para <strong className="text-white">{submittedReport.threat_value}</strong> quedó registrado con el código <span className="font-mono text-emerald-400">#{submittedReport.id}</span> en estado <strong className="text-amber-400">En Revisión</strong>.
            </p>
          </div>
          <div className="p-4 bg-slate-900/80 rounded-xl text-xs text-slate-400 text-left space-y-1 border border-white/5">
            <span className="font-bold text-slate-300">Próximos pasos en el ecosistema:</span>
            <p>1. El equipo moderador analiza la evidencia reportada.</p>
            <p>2. Al validarse, se propaga automáticamente a todos los celulares con la app Android en su próxima sincronización.</p>
          </div>
          <button
            onClick={() => setSubmittedReport(null)}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-all"
          >
            Reportar otro caso
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-6 sm:p-8 space-y-6">
          {/* Canal de contacto */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">
              ¿Por qué medio te contactaron?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                { id: 'call', label: 'Llamada', icon: PhoneCall },
                { id: 'sms', label: 'Mensaje SMS', icon: MessageSquare },
                { id: 'web', label: 'Sitio Web / Redes', icon: Globe },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = channel === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setChannel(item.id as any);
                      if (item.id === 'call' || item.id === 'whatsapp' || item.id === 'sms') {
                        setThreatType('phone');
                      } else {
                        setThreatType('domain');
                      }
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                      isSelected
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                        : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tipo de amenaza y valor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">
                Tipo de dato
              </label>
              <select
                value={threatType}
                onChange={(e) => setThreatType(e.target.value as any)}
                className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
              >
                <option value="phone">Número de Teléfono</option>
                <option value="domain">Dominio Web</option>
                <option value="url">Enlace / URL</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-slate-300">
                Número, Dominio o Enlace sospechoso
              </label>
              <input
                id="threat-value-input"
                type="text"
                required
                value={threatValue}
                onChange={(e) => setThreatValue(e.target.value)}
                placeholder={threatType === 'phone' ? 'Ej: +54 9 11 1234-5678' : 'Ej: pagina-falsa-anses.com'}
                className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Modalidad de estafa */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">
              ¿Qué tipo de engaño intentaron hacerte?
            </label>
            <select
              value={scamTypeId || ''}
              onChange={(e) => setScamTypeId(Number(e.target.value))}
              className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
            >
              {scamTypes.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Descripción del hecho */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">
              ¿Qué te dijeron o pidieron?
            </label>
            <textarea
              id="threat-desc-input"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Dijeron que eran de Mercado Pago y que tenía que transferir dinero para desbloquear la cuenta..."
              className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Evidencia adicional */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">
              Texto del mensaje o detalles adicionales (Opcional)
            </label>
            <input
              type="text"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Ej: Mandaron CBU falso: 00000031000... o pidieron código de 6 dígitos"
              className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <button
            id="submit-report-button"
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Enviar reporte para revisión</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
