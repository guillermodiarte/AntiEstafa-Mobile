"use client";

import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldX, Clock, RefreshCw, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react';
import { apiService } from '../services/api';
import { CitizenReport } from '../types';

interface AdminModerationProps {
  onDataChanged?: () => void;
  syncVersion: number;
}

export const AdminModeration: React.FC<AdminModerationProps> = ({ onDataChanged, syncVersion }) => {
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'pending' | 'validated' | 'all'>('pending');
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await apiService.getReports(filter === 'all' ? undefined : filter);
      setReports(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [filter]);

  const handleValidate = async (reportId: number, threatVal: string) => {
    setActionLoadingId(reportId);
    try {
      await apiService.updateReportStatus(
        reportId,
        'validated',
        'Validado por equipo moderador. Incorporado a la base central.'
      );
      setLastActionMessage(`¡Amenaza "${threatVal}" validada con éxito! La versión de sincronización subió a v${syncVersion + 1}, impactando de inmediato en los celulares.`);
      await loadReports();
      if (onDataChanged) onDataChanged();
      setTimeout(() => setLastActionMessage(null), 6000);
    } catch (err) {
      console.error(err);
      alert('Error al validar reporte.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (reportId: number) => {
    setActionLoadingId(reportId);
    try {
      await apiService.updateReportStatus(
        reportId,
        'rejected',
        'Descartado: Información insuficiente o número legítimo.'
      );
      setLastActionMessage(`Reporte #${reportId} descartado.`);
      await loadReports();
      if (onDataChanged) onDataChanged();
      setTimeout(() => setLastActionMessage(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Error al descartar reporte.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      {/* Header and status banner */}
      <div className="glass-panel p-6 border-indigo-500/30 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              Panel Administrativo
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Versión Global: <strong className="text-emerald-400">v{syncVersion}</strong>
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white mt-1">
            Moderación y Flujo de Validación Comunitaria
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Cada amenaza que validás aquí genera un incremento en la versión de sincronización y se propaga en tiempo real a los teléfonos con la app móvil.
          </p>
        </div>

        <button
          onClick={loadReports}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-white/10 flex items-center gap-2 transition-all self-end md:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Action Notification */}
      {lastActionMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{lastActionMessage}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        {[
          { id: 'pending', label: 'Pendientes de Revisión' },
          { id: 'validated', label: 'Validados' },
          { id: 'all', label: 'Todos los Reportes' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              filter === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 space-y-2">
          <Clock className="w-8 h-8 mx-auto text-slate-500" />
          <p className="text-base font-medium">No hay reportes en este estado.</p>
          <p className="text-xs">Podés enviar uno desde la solapa "Reportar Estafa" para probar la validación en vivo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="glass-panel p-5 sm:p-6 border-white/10 space-y-4 hover:border-white/20 transition-all"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    report.status === 'validated'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : report.status === 'rejected'
                      ? 'bg-slate-800 text-slate-400 border border-white/10'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {report.status === 'validated' ? 'Validado' : report.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">Canal: {report.channel.toUpperCase()}</span>
                  <span className="text-xs text-slate-500">ID #{report.id}</span>
                </div>

                <div className="text-xs text-slate-400">
                  {report.created_at ? new Date(report.created_at).toLocaleDateString() : 'Hoy'}
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Dato reportado ({report.threat_type}):</span>
                <span className="text-lg font-mono font-bold text-white tracking-wide">
                  {report.threat_value}
                </span>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2">
                <p className="text-xs font-semibold text-slate-400">Descripción del ciudadano:</p>
                <p className="text-sm text-slate-200">{report.description}</p>
                {report.evidence && (
                  <p className="text-xs text-indigo-300 italic pt-1 border-t border-white/5">
                    Evidencia: {report.evidence}
                  </p>
                )}
                {report.reviewer_notes && (
                  <p className="text-xs text-emerald-400 font-medium pt-1">
                    Nota moderación: {report.reviewer_notes}
                  </p>
                )}
              </div>

              {/* Botones de acción solo si está pendiente */}
              {report.status === 'pending' && (
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleReject(report.id!)}
                    disabled={actionLoadingId === report.id}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10 transition-all flex items-center gap-1.5"
                  >
                    <ShieldX className="w-4 h-4 text-slate-400" />
                    <span>Descartar</span>
                  </button>

                  <button
                    onClick={() => handleValidate(report.id!, report.threat_value)}
                    disabled={actionLoadingId === report.id}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    {actionLoadingId === report.id ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Validar e incorporar a la base</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
