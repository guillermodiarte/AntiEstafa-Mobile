export type ThreatType = 'phone' | 'domain' | 'url';
export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type ThreatStatus = 'pending' | 'in_review' | 'validated' | 'rejected' | 'duplicate';

export interface ThreatPublicView {
  tipo: ThreatType;
  valor: string;
  nivel: RiskLevel;
  estado: ThreatStatus;
  categoria?: string;
  recomendacion?: string;
  cantidad_reportes: number;
  ultima_actualizacion: string;
}

export interface ThreatCheckResult {
  is_threat: boolean;
  risk_level: RiskLevel;
  message: string;
  details?: ThreatPublicView | null;
}

export interface ScamType {
  id: number;
  name: string;
  slug: string;
  description: string;
  advice?: string;
  icon?: string;
  is_active: boolean;
  created_at?: string;
}

export interface CitizenReport {
  id?: number;
  channel: 'whatsapp' | 'sms' | 'call' | 'web';
  threat_type: ThreatType;
  threat_value: string;
  description: string;
  evidence?: string;
  scam_type_id?: number;
  country?: string;
  status?: ThreatStatus;
  created_at?: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  scam_type?: ScamType;
}

export interface ScamTypeStat {
  category: string;
  count: number;
}

export interface SystemStats {
  total_threats: number;
  total_phone_threats: number;
  total_domain_threats: number;
  total_url_threats: number;
  total_reports: number;
  total_validated_reports: number;
  current_sync_version: number;
  top_scam_types: ScamTypeStat[];
  status: string;
}
