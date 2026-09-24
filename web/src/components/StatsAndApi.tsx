"use client";

import React, { useState, useEffect } from 'react';
import { BarChart3, Code2, ShieldAlert, Phone, Globe, Database, Copy, Check, ExternalLink } from 'lucide-react';
import { apiService } from '../services/api';
import { SystemStats } from '../types';

export const StatsAndApi: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await apiService.getStats();
        setStats(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2500);
  };

  const apiEndpoints = [
    {
      id: 'phone-check',
      method: 'GET',
      path: '/api/v1/threats/phone/{number}',
      desc: 'Consulta reputación de un número de teléfono',
      example: 'curl -X GET "http://localhost:8000/api/v1/threats/phone/+5491138901234"',
      sampleResponse: `{
  "is_threat": true,
  "risk_level": "high",
  "message": "El número está registrado en la base de sospechas de estafas.",
  "details": {
    "tipo": "phone",
    "valor": "+5491138901234",
    "nivel": "high",
    "categoria": "Falso Familiar / Urgencia",
    "cantidad_reportes": 14,
    "ultima_actualizacion": "2026-09-24"
  }
}`
    },
    {
      id: 'domain-check',
      method: 'GET',
      path: '/api/v1/threats/domain/{domain}',
      desc: 'Verifica si un dominio web está asociado a phishing o sitios falsos',
      example: 'curl -X GET "http://localhost:8000/api/v1/threats/domain/anses-beneficios-gob-ar.site"',
      sampleResponse: `{
  "is_threat": true,
  "risk_level": "high",
  "message": "Este sitio web fue reportado como potencialmente peligroso.",
  "details": {
    "tipo": "domain",
    "valor": "anses-beneficios-gob-ar.site",
    "nivel": "high",
    "categoria": "Falso Organismo Público (ANSES / PAMI)",
    "cantidad_reportes": 32,
    "ultima_actualizacion": "2026-09-24"
  }
}`
    },
    {
      id: 'mobile-sync',
      method: 'GET',
      path: '/api/v1/mobile/sync?since_version={v}',
      desc: 'Sincronización incremental para la app móvil Android (Room offline)',
      example: 'curl -X GET "http://localhost:8000/api/v1/mobile/sync?since_version=0"',
      sampleResponse: `{
  "current_version": 10,
  "since_version": 0,
  "has_more": false,
  "total_changes": 9,
  "items": [
    {
      "id": 1,
      "type": "phone",
      "value": "+5491138901234",
      "risk_level": "high",
      "category": "Falso Familiar / Urgencia",
      "version": 2,
      "is_deleted": false
    }
  ]
}`
    }
  ];

  return (
    <div className="space-y-10 animate-fadeIn w-full max-w-[1500px] mx-auto">
      {/* Title */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold text-white">
          Ecosistema Abierto: Métricas y API Pública
        </h2>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto">
          Escudo Digital no es solo una app, es una plataforma abierta. Cualquier aplicación, bot o entidad puede consultar y enriquecer la base comunitaria.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-5 border-indigo-500/20 text-center space-y-1">
          <ShieldAlert className="w-6 h-6 text-indigo-400 mx-auto" />
          <span className="text-3xl font-black text-white block">
            {stats ? stats.total_threats : '—'}
          </span>
          <span className="text-xs text-slate-400 uppercase font-semibold">Amenazas Validadas</span>
        </div>

        <div className="glass-panel p-5 border-cyan-500/20 text-center space-y-1">
          <Phone className="w-6 h-6 text-cyan-400 mx-auto" />
          <span className="text-3xl font-black text-white block">
            {stats ? stats.total_phone_threats : '—'}
          </span>
          <span className="text-xs text-slate-400 uppercase font-semibold">Teléfonos Peligrosos</span>
        </div>

        <div className="glass-panel p-5 border-emerald-500/20 text-center space-y-1">
          <Globe className="w-6 h-6 text-emerald-400 mx-auto" />
          <span className="text-3xl font-black text-white block">
            {stats ? stats.total_domain_threats + stats.total_url_threats : '—'}
          </span>
          <span className="text-xs text-slate-400 uppercase font-semibold">Sitios y Phishing</span>
        </div>

        <div className="glass-panel p-5 border-amber-500/20 text-center space-y-1">
          <Database className="w-6 h-6 text-amber-400 mx-auto" />
          <span className="text-3xl font-black text-white block">
            {stats ? `v${stats.current_sync_version}` : '—'}
          </span>
          <span className="text-xs text-slate-400 uppercase font-semibold">Versión Sync Global</span>
        </div>
      </div>

      {/* API Explorer */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-xl font-bold text-white">Documentación de la API Pública v1</h3>
          </div>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
          >
            <span>Ver Swagger OpenAPI</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="space-y-4">
          {apiEndpoints.map((ep) => (
            <div key={ep.id} className="glass-panel p-5 sm:p-6 border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-md text-xs font-black bg-indigo-500/20 text-indigo-400 font-mono">
                    {ep.method}
                  </span>
                  <span className="font-mono text-sm font-bold text-white">{ep.path}</span>
                </div>
                <span className="text-xs text-slate-400">{ep.desc}</span>
              </div>

              {/* cURL box */}
              <div className="relative bg-slate-950 p-3.5 rounded-xl border border-white/5 font-mono text-xs text-indigo-300 overflow-x-auto flex items-center justify-between gap-2">
                <code>{ep.example}</code>
                <button
                  onClick={() => handleCopy(ep.example, ep.id)}
                  className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all flex-shrink-0"
                  title="Copiar comando cURL"
                >
                  {copiedEndpoint === ep.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Sample Response */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Respuesta JSON:</span>
                <pre className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 font-mono text-xs text-emerald-400 overflow-x-auto max-h-48">
                  {ep.sampleResponse}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
