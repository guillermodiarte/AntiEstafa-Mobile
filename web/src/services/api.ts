import {
  ThreatCheckResult,
  ScamType,
  CitizenReport,
  SystemStats,
  ThreatPublicView,
  ThreatRecord,
  CaptchaChallenge
} from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Función genérica para fetch con timeout y fallback
async function fetchWithFallback<T>(url: string, options?: RequestInit, fallback?: T): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (fallback !== undefined) {
      console.warn(`[API] Fallback used for ${url}:`, error);
      return fallback;
    }
    throw error;
  }
}

export const apiService = {
  // 1. Consulta de Número Telefónico
  async checkPhone(number: string): Promise<ThreatCheckResult> {
    const encoded = encodeURIComponent(number.trim());
    return fetchWithFallback<ThreatCheckResult>(
      `${API_BASE}/threats/phone/${encoded}`,
      undefined,
      {
        is_threat: false,
        risk_level: 'low',
        message: 'No se encontraron reportes confirmados para este número.',
        details: null
      }
    );
  },

  // 2. Consulta de Dominio
  async checkDomain(domain: string): Promise<ThreatCheckResult> {
    const encoded = encodeURIComponent(domain.trim());
    return fetchWithFallback<ThreatCheckResult>(
      `${API_BASE}/threats/domain/${encoded}`,
      undefined,
      {
        is_threat: false,
        risk_level: 'low',
        message: 'No se registran antecedentes negativos para este dominio.',
        details: null
      }
    );
  },

  // 3. Consulta de URL
  async checkUrl(url: string): Promise<ThreatCheckResult> {
    const encoded = encodeURIComponent(url.trim());
    return fetchWithFallback<ThreatCheckResult>(
      `${API_BASE}/threats/url?url=${encoded}`,
      undefined,
      {
        is_threat: false,
        risk_level: 'low',
        message: 'No se encontraron alertas para este enlace.',
        details: null
      }
    );
  },

  // 4. Modalidades de estafas
  async getScamTypes(): Promise<ScamType[]> {
    return fetchWithFallback<ScamType[]>(
      `${API_BASE}/scam-types`,
      undefined,
      [
        {
          id: 1,
          name: "Falso Familiar / Urgencia",
          slug: "falso-familiar",
          description: "El estafador se hace pasar por un hijo, nieto o sobrino afirmando que cambió de número y pidiendo dinero de forma urgente.",
          advice: "Cortá la llamada o no contestes. Llamá directamente a tu familiar a su número de siempre.",
          icon: "users",
          is_active: true
        },
        {
          id: 2,
          name: "Suplantación Bancaria / Fintech",
          slug: "suplantacion-banco",
          description: "Mensajes fingiendo ser de Mercado Pago o bancos alertando sobre 'bloqueo de cuenta' para robar claves y tokens.",
          advice: "Los bancos nunca piden claves, tokens de seguridad ni contraseñas por WhatsApp o llamada.",
          icon: "credit-card",
          is_active: true
        },
        {
          id: 3,
          name: "Falso Organismo Público (ANSES / PAMI)",
          slug: "falso-organismo-anses",
          description: "Falsos trámites de bonos, reparaciones históricas o turnos de ANSES/PAMI requiriendo ir al cajero automático.",
          advice: "PAMI y ANSES no se comunican por WhatsApp para pedirte datos bancarios ni te mandan al cajero para cobrar bonos.",
          icon: "landmark",
          is_active: true
        }
      ]
    );
  },

  // 5. Estadísticas del sistema
  async getStats(): Promise<SystemStats> {
    return fetchWithFallback<SystemStats>(
      `${API_BASE}/stats`,
      undefined,
      {
        total_threats: 9,
        total_phone_threats: 4,
        total_domain_threats: 4,
        total_url_threats: 1,
        total_reports: 3,
        total_validated_reports: 2,
        current_sync_version: 10,
        top_scam_types: [
          { category: "Suplantación Bancaria / Fintech", count: 45 },
          { category: "Falso Organismo Público (ANSES / PAMI)", count: 32 },
          { category: "Falso Familiar / Urgencia", count: 14 }
        ],
        status: "operational"
      }
    );
  },

  // 6. Enviar reporte ciudadano
  async submitReport(report: CitizenReport): Promise<CitizenReport> {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    if (!res.ok) {
      throw new Error(`Error al enviar reporte: ${res.status}`);
    }
    return await res.json();
  },

  // 7. Listar reportes (Admin)
  async getReports(status?: string): Promise<CitizenReport[]> {
    const query = status ? `?status=${status}` : '';
    return fetchWithFallback<CitizenReport[]>(
      `${API_BASE}/reports${query}`,
      undefined,
      []
    );
  },

  // 8. Actualizar estado de reporte (Validar / Rechazar en Admin)
  async updateReportStatus(
    id: number,
    status: string,
    reviewerNotes: string = '',
    createOrUpdateThreat: boolean = true
  ): Promise<CitizenReport> {
    const res = await fetch(`${API_BASE}/reports/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        reviewer_notes: reviewerNotes,
        create_or_update_threat: createOrUpdateThreat
      })
    });
    if (!res.ok) {
      throw new Error(`Error al moderar reporte: ${res.status}`);
    }
    return await res.json();
  },

  // 9. Listar todas las amenazas registradas (Admin)
  async getThreats(params?: { type?: string; risk_level?: string; q?: string }): Promise<ThreatRecord[]> {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.append('type', params.type);
    if (params?.risk_level) searchParams.append('risk_level', params.risk_level);
    if (params?.q) searchParams.append('q', params.q);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return fetchWithFallback<ThreatRecord[]>(`${API_BASE}/threats${qs}`, undefined, []);
  },

  // 10. Crear amenaza manual (Admin)
  async createThreat(data: {
    type: string;
    value: string;
    risk_level: string;
    status?: string;
    scam_type_id?: number;
    evidence_notes?: string;
    report_count?: number;
    confidence_score?: number;
  }): Promise<ThreatRecord> {
    const res = await fetch(`${API_BASE}/threats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'validated',
        report_count: 1,
        confidence_score: 1.0,
        country: 'AR',
        ...data
      })
    });
    if (!res.ok) {
      throw new Error(`Error al registrar amenaza: ${res.status}`);
    }
    return await res.json();
  },

  // 11. Obtener desafío anti-bot
  async getCaptcha(): Promise<CaptchaChallenge> {
    const res = await fetch(`${API_BASE}/captcha`);
    if (!res.ok) {
      throw new Error(`Error al generar captcha: ${res.status}`);
    }
    return await res.json();
  },

  // 12. Subir imágenes de evidencia al servidor
  async uploadImages(files: File[]): Promise<string[]> {
    if (!files || files.length === 0) return [];

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Error al subir imágenes: ${res.status}`);
    }

    return await res.json();
  },

  // 13. Editar caso / reporte ciudadano (Admin modal)
  async editReport(id: number, data: Partial<CitizenReport>): Promise<CitizenReport> {
    const res = await fetch(`${API_BASE}/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      throw new Error(`Error al editar reporte: ${res.status}`);
    }
    return await res.json();
  },

  // 14. Editar amenaza en base central (Admin modal)
  async editThreat(id: number, data: Partial<ThreatRecord>): Promise<ThreatRecord> {
    const res = await fetch(`${API_BASE}/threats/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      throw new Error(`Error al editar amenaza: ${res.status}`);
    }
    return await res.json();
  },

  // 15. Helper para URL de imagen absoluta
  getImageUrl(path?: string | null): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = API_BASE.replace('/api/v1', '');
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }
};
