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
  images?: string; // JSON string array of URLs
  attached_url?: string; // Enlace o sitio web opcional adjunto en SMS/llamada/WhatsApp
  scam_type_id?: number;
  scam_type_ids?: number[];
  country?: string;
  status?: ThreatStatus;
  created_at?: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  scam_type?: ScamType;
  scam_types?: ScamType[];
  existing_threat_id?: number;
  is_update?: boolean;
  already_in_database?: boolean;
  existing_threat_value?: string;
  existing_threat_modalities?: string[];
}

export interface CaptchaChallenge {
  token: string;
  question: string;
  expires_in: number;
}

export interface ScamTypeStat {
  category: string;
  count: number;
}

export interface ThreatRecord {
  id: number;
  type: ThreatType;
  value: string;
  risk_level: RiskLevel;
  status: string;
  scam_type_id?: number;
  scam_type_ids?: number[];
  report_count: number;
  confidence_score: number;
  evidence_notes?: string;
  images?: string;
  country: string;
  version: number;
  created_at: string;
  updated_at?: string;
  scam_type?: ScamType;
  scam_types?: ScamType[];
  has_images?: boolean;
  images_count?: number;
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

export interface GroupedReport {
  canonical_value: string;
  threat_type: string;
  total_reports: number;
  pending_reports: number;
  validated_reports: number;
  rejected_reports: number;
  channels: string[];
  all_images: string[];
  attached_urls?: string[];
  sample_descriptions: string[];
  scam_type_id?: number | null;
  scam_type_ids?: number[];
  scam_type_name?: string | null;
  scam_types?: ScamType[];
  latest_created_at: string;
  report_ids: number[];
  reports: CitizenReport[];
  is_existing_threat?: boolean;
  existing_threat_id?: number;
  existing_threat_modalities?: string[];
}

export interface CaseUpdateItem {
  report: CitizenReport;
  existing_threat: ThreatRecord;
  is_new_modality: boolean;
  new_modalities: string[];
  new_images: string[];
  new_images_count: number;
  has_new_images: boolean;
}
