"use client";

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldX,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Plus,
  Search,
  Filter,
  Phone,
  Globe,
  Link as LinkIcon,
  ChevronDown,
  Layers
} from 'lucide-react';
import { apiService } from '../services/api';
import { CitizenReport, ThreatRecord, ScamType } from '../types';

interface AdminModerationProps {
  onDataChanged?: () => void;
  syncVersion: number;
}

export const AdminModeration: React.FC<AdminModerationProps> = ({ onDataChanged, syncVersion }) => {
  // Main view tab: 'reports' | 'records'
  const [activeAdminTab, setActiveAdminTab] = useState<'reports' | 'records'>('reports');

  // Reports state
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [reportFilter, setReportFilter] = useState<'pending' | 'validated' | 'all'>('pending');
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  // All records state
  const [threats, setThreats] = useState<ThreatRecord[]>([]);
  const [threatsLoading, setThreatsLoading] = useState(false);
  const [threatSearch, setThreatSearch] = useState('');
  const [threatTypeFilter, setThreatTypeFilter] = useState<string>('all');
  const [threatRiskFilter, setThreatRiskFilter] = useState<string>('all');

  // New manual threat form modal / collapse
  const [showNewThreatForm, setShowNewThreatForm] = useState(false);
  const [newType, setNewType] = useState<'phone' | 'domain' | 'url'>('phone');
  const [newValue, setNewValue] = useState('');
  const [newRisk, setNewRisk] = useState<'high' | 'medium' | 'low'>('high');
  const [newScamTypeId, setNewScamTypeId] = useState<number | undefined>(undefined);
  const [newEvidence, setNewEvidence] = useState('');
  const [scamTypes, setScamTypes] = useState<ScamType[]>([]);
  const [creatingThreat, setCreatingThreat] = useState(false);

  // Load scam types for dropdowns
  useEffect(() => {
    async function loadMeta() {
      try {
        const types = await apiService.getScamTypes();
        setScamTypes(types);
        if (types.length > 0) setNewScamTypeId(types[0].id);
      } catch (e) {
        console.error(e);
      }
    }
    loadMeta();
  }, []);

  // Load citizen reports
  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const data = await apiService.getReports(reportFilter === 'all' ? undefined : reportFilter);
      setReports(data);
    } catch (e) {
      console.error(e);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [reportFilter]);

  // Load all threat records
  const loadThreats = async () => {
    setThreatsLoading(true);
    try {
      const params: any = {};
      if (threatTypeFilter !== 'all') params.type = threatTypeFilter;
      if (threatRiskFilter !== 'all') params.risk_level = threatRiskFilter;
      if (threatSearch.trim()) params.q = threatSearch.trim();

      const data = await apiService.getThreats(params);
      setThreats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setThreatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeAdminTab === 'records') {
      loadThreats();
    }
  }, [activeAdminTab, threatTypeFilter, threatRiskFilter]);

  // Validar reporte ciudadano y subirlo a la base central
  const handleValidate = async (reportId: number, threatVal: string) => {
    setActionLoadingId(reportId);
    try {
      await apiService.updateReportStatus(
        reportId,
        'validated',
        'Validado por equipo moderador. Incorporado a la base central.'
      );
      setLastActionMessage(`¡Caso "${threatVal}" validado e incorporado con éxito! Se incrementó la versión de sync.`);
      await loadReports();
      if (activeAdminTab === 'records') await loadThreats();
      if (onDataChanged) onDataChanged();
      setTimeout(() => setLastActionMessage(null), 5000);
    } catch (err) {
      console.error(err);
      alert('Error al validar reporte.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Descartar reporte
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

  // Crear amenaza manual directamente
  const handleCreateManualThreat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    setCreatingThreat(true);
    try {
      await apiService.createThreat({
        type: newType,
        value: newValue.trim(),
        risk_level: newRisk,
        scam_type_id: newScamTypeId,
        evidence_notes: newEvidence.trim() || undefined
      });

      setLastActionMessage(`¡Nueva amenaza "${newValue}" agregada directamente a la base central!`);
      setNewValue('');
      setNewEvidence('');
      setShowNewThreatForm(false);
      await loadThreats();
      if (onDataChanged) onDataChanged();
      setTimeout(() => setLastActionMessage(null), 5000);
    } catch (e) {
      console.error(e);
      alert('Error al crear la amenaza.');
    } finally {
      setCreatingThreat(false);
    }
  };

  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-8 animate-fadeIn w-full max-w-[1560px] mx-auto">
      {/* Header and status banner */}
      <div className="glass-panel p-6 sm:p-8 border-indigo-500/30 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              Panel Administrativo y Moderación
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Versión Global: <strong className="text-emerald-400 font-bold">v{syncVersion}</strong>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Gestión de Casos y Base Comunitaria de Amenazas
          </h2>
          <p className="text-sm text-slate-300 max-w-3xl">
            Aceptá nuevos casos reportados por ciudadanos o administrá todos los registros de números y dominios fraudulentos que se sincronizan con las apps de los usuarios.
          </p>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => {
              if (activeAdminTab === 'reports') loadReports();
              else loadThreats();
            }}
            disabled={reportsLoading || threatsLoading}
            className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-white/10 flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading || threatsLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {lastActionMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-3 animate-fadeIn shadow-lg">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{lastActionMessage}</span>
        </div>
      )}

      {/* Main Tabs: Casos Ciudadanos vs. Todos los Registros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveAdminTab('reports')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeAdminTab === 'reports'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Nuevos Casos y Reportes</span>
            {pendingReportsCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs font-black rounded-full bg-amber-500 text-slate-950">
                {pendingReportsCount} pendientes
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('records')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeAdminTab === 'records'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Todos los Registros en Base</span>
          </button>
        </div>

        {activeAdminTab === 'records' && (
          <button
            onClick={() => setShowNewThreatForm(!showNewThreatForm)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>{showNewThreatForm ? 'Ocultar Formulario' : 'Agregar Nueva Amenaza'}</span>
          </button>
        )}
      </div>

      {/* TAB 1: REPORTES Y CASOS CIUDADANOS */}
      {activeAdminTab === 'reports' && (
        <div className="space-y-6">
          {/* Sub-filtro de reportes */}
          <div className="flex items-center gap-2">
            {[
              { id: 'pending', label: 'Pendientes de Aprobación' },
              { id: 'validated', label: 'Validados' },
              { id: 'all', label: 'Todos los Casos' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setReportFilter(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  reportFilter === tab.id
                    ? 'bg-slate-800 text-white border border-indigo-500/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {reportsLoading ? (
            <div className="flex justify-center p-16">
              <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : reports.length === 0 ? (
            <div className="glass-panel p-16 text-center text-slate-400 space-y-2">
              <Clock className="w-10 h-10 mx-auto text-slate-500" />
              <p className="text-lg font-bold text-slate-200">No hay casos en este estado.</p>
              <p className="text-sm">Podés enviar uno desde la solapa pública "Reportar Estafa" para probar el flujo de moderación.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="glass-panel p-6 border-white/10 space-y-4 hover:border-white/20 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/5">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          report.status === 'validated'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : report.status === 'rejected'
                            ? 'bg-slate-800 text-slate-400 border border-white/10'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                        }`}>
                          {report.status === 'validated' ? 'Validado' : report.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                        </span>
                        <span className="text-xs font-mono text-slate-400">Canal: {report.channel.toUpperCase()}</span>
                        <span className="text-xs text-slate-500 font-mono">#{report.id}</span>
                      </div>

                      <div className="text-xs text-slate-400">
                        {report.created_at ? new Date(report.created_at).toLocaleDateString() : 'Hoy'}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 font-medium block">Dato reportado ({report.threat_type}):</span>
                      <span className="text-xl font-mono font-bold text-white tracking-wide">
                        {report.threat_value}
                      </span>
                    </div>

                    <div className="bg-slate-950/70 p-4 rounded-xl border border-white/5 space-y-2">
                      <p className="text-xs font-semibold text-slate-400">Descripción del ciudadano:</p>
                      <p className="text-sm text-slate-200 leading-relaxed">{report.description}</p>
                      {report.evidence && (
                        <p className="text-xs text-indigo-300 italic pt-2 border-t border-white/5">
                          Evidencia adjunta: {report.evidence}
                        </p>
                      )}
                      {report.reviewer_notes && (
                        <p className="text-xs text-emerald-400 font-medium pt-2 border-t border-white/5">
                          Nota de moderación: {report.reviewer_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Botones de acción */}
                  {report.status === 'pending' && (
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                      <button
                        onClick={() => handleReject(report.id!)}
                        disabled={actionLoadingId === report.id}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10 transition-all flex items-center gap-1.5"
                      >
                        <ShieldX className="w-4 h-4 text-slate-400" />
                        <span>Descartar</span>
                      </button>

                      <button
                        onClick={() => handleValidate(report.id!, report.threat_value)}
                        disabled={actionLoadingId === report.id}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
                      >
                        {actionLoadingId === report.id ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Aceptar e Incorporar a la Base</span>
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
      )}

      {/* TAB 2: TODOS LOS REGISTROS EN BASE */}
      {activeAdminTab === 'records' && (
        <div className="space-y-6">
          {/* Formulario colapsable para agregar nueva amenaza manual */}
          {showNewThreatForm && (
            <form
              onSubmit={handleCreateManualThreat}
              className="glass-panel p-6 sm:p-8 border-emerald-500/30 bg-slate-900/95 space-y-5 animate-fadeIn shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  Agregar Nueva Amenaza a la Base Central
                </h3>
                <span className="text-xs text-slate-400">Incrementará automáticamente la versión de sync</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tipo de Registro</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="phone">Teléfono (+54...)</option>
                    <option value="domain">Dominio (sitio web)</option>
                    <option value="url">URL Completa</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Valor a Proteger {newType === 'phone' ? '(Ej: +5491138901234)' : '(Ej: phishing-ejemplo.com)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={newType === 'phone' ? '+5491138901234' : 'sitio-falso.com'}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nivel de Riesgo</label>
                  <select
                    value={newRisk}
                    onChange={(e) => setNewRisk(e.target.value as any)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="high">🔴 Riesgo Alto (Confirmado)</option>
                    <option value="medium">🟡 Riesgo Medio (Sospechoso)</option>
                    <option value="low">🟢 Riesgo Bajo (Informativo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Modalidad de Estafa</label>
                  <select
                    value={newScamTypeId}
                    onChange={(e) => setNewScamTypeId(Number(e.target.value))}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
                  >
                    {scamTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Notas de Evidencia / Origen</label>
                <input
                  type="text"
                  value={newEvidence}
                  onChange={(e) => setNewEvidence(e.target.value)}
                  placeholder="Ej: Reportado en campaña activa de WhatsApp con suplantación de identidad"
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewThreatForm(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingThreat || !newValue.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center gap-2"
                >
                  {creatingThreat ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Guardar en Base Central</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Filtros y búsqueda para los registros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-white/10">
            <div className="relative flex-grow max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={threatSearch}
                onChange={(e) => setThreatSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadThreats();
                }}
                placeholder="Buscar por teléfono o dominio..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Tipo:</span>
                <select
                  value={threatTypeFilter}
                  onChange={(e) => setThreatTypeFilter(e.target.value)}
                  className="py-1.5 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="phone">Teléfono</option>
                  <option value="domain">Dominio</option>
                  <option value="url">URL</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Riesgo:</span>
                <select
                  value={threatRiskFilter}
                  onChange={(e) => setThreatRiskFilter(e.target.value)}
                  className="py-1.5 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="high">🔴 Alto</option>
                  <option value="medium">🟡 Medio</option>
                  <option value="low">🟢 Bajo</option>
                </select>
              </div>

              <button
                onClick={loadThreats}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
              >
                Filtrar
              </button>
            </div>
          </div>

          {/* Tabla de registros */}
          {threatsLoading ? (
            <div className="flex justify-center p-16">
              <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : threats.length === 0 ? (
            <div className="glass-panel p-16 text-center text-slate-400 space-y-2">
              <Database className="w-10 h-10 mx-auto text-slate-500" />
              <p className="text-lg font-bold text-slate-200">No se encontraron registros con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-4">ID</th>
                      <th className="py-3.5 px-4">Tipo</th>
                      <th className="py-3.5 px-4">Valor Identificador</th>
                      <th className="py-3.5 px-4">Modalidad</th>
                      <th className="py-3.5 px-4">Riesgo</th>
                      <th className="py-3.5 px-4">Reportes</th>
                      <th className="py-3.5 px-4">Versión Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                    {threats.map((t) => (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500">#{t.id}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-300 capitalize">
                            {t.type === 'phone' && <Phone className="w-3.5 h-3.5 text-cyan-400" />}
                            {t.type === 'domain' && <Globe className="w-3.5 h-3.5 text-indigo-400" />}
                            {t.type === 'url' && <LinkIcon className="w-3.5 h-3.5 text-amber-400" />}
                            {t.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {t.value}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {t.scam_type?.name || 'No clasificada'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            t.risk_level === 'high'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : t.risk_level === 'medium'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {t.risk_level}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-200">
                          {t.report_count}
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-400 font-bold">
                          v{t.version}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
