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
  Eye,
  Edit3,
  X,
  Image as ImageIcon,
  ExternalLink,
  Save,
  MessageSquare
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

  // Modals state: 'view' and 'edit'
  const [viewingItem, setViewingItem] = useState<{ type: 'report' | 'threat'; data: any } | null>(null);
  const [editingItem, setEditingItem] = useState<{ type: 'report' | 'threat'; data: any } | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<{
    value: string;
    type: string;
    risk_level: string;
    status: string;
    scam_type_id?: number;
    description?: string;
    evidence?: string;
    reviewer_notes?: string;
  }>({
    value: '',
    type: 'phone',
    risk_level: 'high',
    status: 'pending'
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // New manual threat form
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

  // Helper para parsear imágenes de JSON
  const parseImages = (imgStr?: string | null): string[] => {
    if (!imgStr) return [];
    try {
      if (imgStr.startsWith('[')) {
        return JSON.parse(imgStr);
      }
      return imgStr.split(',').map(s => s.trim()).filter(Boolean);
    } catch {
      return [imgStr];
    }
  };

  // Open Edit Modal
  const openEditModal = (type: 'report' | 'threat', item: any) => {
    setEditingItem({ type, data: item });
    setEditForm({
      value: type === 'report' ? item.threat_value : item.value,
      type: type === 'report' ? item.threat_type : item.type,
      risk_level: item.risk_level || 'high',
      status: item.status || 'pending',
      scam_type_id: item.scam_type_id,
      description: item.description,
      evidence: item.evidence || item.evidence_notes,
      reviewer_notes: item.reviewer_notes
    });
  };

  // Save Edit Modal
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSavingEdit(true);
    try {
      if (editingItem.type === 'report') {
        await apiService.editReport(editingItem.data.id, {
          threat_value: editForm.value,
          threat_type: editForm.type as any,
          scam_type_id: editForm.scam_type_id,
          description: editForm.description,
          evidence: editForm.evidence,
          status: editForm.status as any,
          reviewer_notes: editForm.reviewer_notes
        });
        setLastActionMessage(`Reporte #${editingItem.data.id} actualizado con éxito.`);
        await loadReports();
      } else {
        await apiService.editThreat(editingItem.data.id, {
          value: editForm.value,
          type: editForm.type as any,
          risk_level: editForm.risk_level as any,
          status: editForm.status,
          scam_type_id: editForm.scam_type_id,
          evidence_notes: editForm.evidence
        });
        setLastActionMessage(`Amenaza #${editingItem.data.id} modificada. Versión de sync actualizada.`);
        await loadThreats();
      }

      setEditingItem(null);
      if (onDataChanged) onDataChanged();
      setTimeout(() => setLastActionMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al guardar los cambios.');
    } finally {
      setSavingEdit(false);
    }
  };

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
            Aceptá y editá nuevos casos reportados por ciudadanos, revisá las imágenes de evidencia adjuntas y administrá todos los registros que se sincronizan con las apps de los usuarios.
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
              <p className="text-sm">Podés enviar uno desde la solapa pública "Reportar Estafa" para probar el flujo de moderación e imágenes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {reports.map((report) => {
                const reportImages = parseImages(report.images);

                return (
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

                        <div className="flex items-center gap-1.5">
                          {/* Botón Ver Detalle */}
                          <button
                            onClick={() => setViewingItem({ type: 'report', data: report })}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Ver detalles e imágenes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {/* Botón Editar Caso */}
                          <button
                            onClick={() => openEditModal('report', report)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Editar caso"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
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
                        <p className="text-sm text-slate-200 leading-relaxed line-clamp-3">{report.description}</p>
                        {report.evidence && (
                          <p className="text-xs text-indigo-300 italic pt-2 border-t border-white/5">
                            Evidencia: {report.evidence}
                          </p>
                        )}
                        {report.reviewer_notes && (
                          <p className="text-xs text-emerald-400 font-medium pt-2 border-t border-white/5">
                            Nota de moderación: {report.reviewer_notes}
                          </p>
                        )}
                      </div>

                      {/* Miniaturas de imágenes si las hay */}
                      {reportImages.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                            {reportImages.length} {reportImages.length === 1 ? 'imagen adjunta' : 'imágenes adjuntas'}:
                          </span>
                          <div className="flex items-center gap-2 overflow-x-auto py-1">
                            {reportImages.map((img, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setZoomedImage(apiService.getImageUrl(img))}
                                className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 hover:border-indigo-500 transition-all flex-shrink-0 group relative"
                              >
                                <img
                                  src={apiService.getImageUrl(img)}
                                  alt="Evidencia"
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
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
                );
              })}
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

          {/* Tabla de registros con botones Ver y Editar */}
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
            <div className="glass-panel overflow-hidden border-white/10 shadow-xl">
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
                      <th className="py-3.5 px-4 text-right">Acciones</th>
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
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingItem({ type: 'threat', data: t })}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal('threat', t)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Editar registro"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* MODAL 1: VER DETALLES E IMÁGENES */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel p-6 sm:p-8 border-indigo-500/40 bg-slate-900/95 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Eye className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {viewingItem.type === 'report' ? `Detalle del Caso #${viewingItem.data.id}` : `Detalle de Amenaza #${viewingItem.data.id}`}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Estado: <strong className="capitalize text-indigo-300">{viewingItem.data.status}</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setViewingItem(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
                <span className="text-xs text-slate-400 uppercase font-semibold">Valor Registrado ({viewingItem.data.threat_type || viewingItem.data.type}):</span>
                <p className="text-xl font-mono font-bold text-white">
                  {viewingItem.data.threat_value || viewingItem.data.value}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                  <span className="text-[11px] text-slate-400 block font-semibold">Riesgo</span>
                  <span className="text-sm font-bold text-white uppercase">{viewingItem.data.risk_level || 'HIGH'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                  <span className="text-[11px] text-slate-400 block font-semibold">Modalidad</span>
                  <span className="text-xs font-medium text-slate-200">
                    {viewingItem.data.scam_type?.name || 'No clasificada'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                  <span className="text-[11px] text-slate-400 block font-semibold">Reportes</span>
                  <span className="text-sm font-bold text-emerald-400">{viewingItem.data.report_count || 1}</span>
                </div>
              </div>

              {(viewingItem.data.description || viewingItem.data.evidence_notes) && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
                  <span className="text-xs text-slate-400 font-semibold block">Descripción / Relato del Hecho:</span>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {viewingItem.data.description || viewingItem.data.evidence_notes}
                  </p>
                </div>
              )}

              {viewingItem.data.evidence && (
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200">
                  <strong>Detalles adicionales de evidencia:</strong> {viewingItem.data.evidence}
                </div>
              )}

              {/* Galería de Imágenes de Evidencia */}
              {(() => {
                const images = parseImages(viewingItem.data.images);
                if (images.length === 0) return null;

                return (
                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-indigo-400" />
                      <span>Imágenes Adjuntas de Evidencia ({images.length})</span>
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {images.map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => setZoomedImage(apiService.getImageUrl(img))}
                          className="cursor-pointer group relative rounded-xl overflow-hidden border border-white/10 bg-slate-950 aspect-square shadow-md"
                        >
                          <img
                            src={apiService.getImageUrl(img)}
                            alt={`Evidencia ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-xs font-bold text-white bg-indigo-600/80 px-2 py-1 rounded-md">
                              Ampliar 🔍
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setViewingItem(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR CASO O AMENAZA */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleSaveEdit}
            className="glass-panel p-6 sm:p-8 border-indigo-500/40 bg-slate-900/95 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Edit3 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {editingItem.type === 'report' ? `Editar Caso #${editingItem.data.id}` : `Editar Amenaza #${editingItem.data.id}`}
                  </h3>
                  <span className="text-xs text-slate-400">Modificá los campos necesarios y guardá los cambios</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Amenaza</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="phone">Teléfono</option>
                    <option value="domain">Dominio</option>
                    <option value="url">URL Completa</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Valor Identificador</label>
                  <input
                    type="text"
                    required
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nivel de Riesgo</label>
                  <select
                    value={editForm.risk_level}
                    onChange={(e) => setEditForm({ ...editForm, risk_level: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="high">🔴 Riesgo Alto</option>
                    <option value="medium">🟡 Riesgo Medio</option>
                    <option value="low">🟢 Riesgo Bajo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Estado</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 capitalize"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="validated">Validado</option>
                    <option value="rejected">Rechazado</option>
                    <option value="in_review">En Revisión</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Modalidad de Estafa</label>
                <select
                  value={editForm.scam_type_id || ''}
                  onChange={(e) => setEditForm({ ...editForm, scam_type_id: Number(e.target.value) })}
                  className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                >
                  <option value="">Sin clasificar</option>
                  {scamTypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              {editingItem.type === 'report' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción del Ciudadano</label>
                  <textarea
                    rows={3}
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notas de Evidencia / Comentarios</label>
                <input
                  type="text"
                  value={editForm.evidence || ''}
                  onChange={(e) => setEditForm({ ...editForm, evidence: e.target.value })}
                  placeholder="Detalles técnicos o pruebas observadas"
                  className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              {editingItem.type === 'report' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nota del Moderador</label>
                  <input
                    type="text"
                    value={editForm.reviewer_notes || ''}
                    onChange={(e) => setEditForm({ ...editForm, reviewer_notes: e.target.value })}
                    placeholder="Comentario interno del equipo de seguridad"
                    className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingEdit || !editForm.value.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2"
              >
                {savingEdit ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: ZOOM DE IMAGEN (LIGHTBOX) */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer animate-fadeIn"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={zoomedImage}
              alt="Evidencia ampliada"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
            />
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg hover:bg-rose-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
