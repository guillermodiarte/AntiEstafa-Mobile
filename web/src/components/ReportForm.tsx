"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  CheckCircle2,
  MessageSquare,
  PhoneCall,
  Globe,
  Upload,
  X,
  Image as ImageIcon,
  ShieldCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import { ScamType, CitizenReport, CaptchaChallenge } from '../types';

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

  // Images state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Anti-bot validation state
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<CitizenReport | null>(null);

  // Load scam types and initial anti-bot challenge
  const loadCaptcha = async () => {
    setCaptchaLoading(true);
    setFormError(null);
    try {
      const challenge = await apiService.getCaptcha();
      setCaptcha(challenge);
      setCaptchaAnswer('');
    } catch (e) {
      // Fallback local challenge si el backend está en proceso de reload
      const n1 = Math.floor(Math.random() * 6) + 2;
      const n2 = Math.floor(Math.random() * 5) + 1;
      setCaptcha({
        token: `local:${n1 + n2}`,
        question: `¿Cuánto es ${n1} + ${n2}?`,
        expires_in: 900
      });
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    async function loadInitialData() {
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
    loadInitialData();
    loadCaptcha();
  }, []);

  // Handle image files selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    addFiles(newFiles);
  };

  const addFiles = (files: File[]) => {
    const validImageFiles = files.filter(f => f.type.startsWith('image/'));
    if (validImageFiles.length === 0) {
      setFormError('Por favor seleccioná únicamente archivos de imagen (PNG, JPG, WEBP).');
      return;
    }

    const updatedFiles = [...selectedFiles, ...validImageFiles].slice(0, 5); // máx 5 imágenes
    setSelectedFiles(updatedFiles);

    // Generar previews
    const previews = updatedFiles.map(file => URL.createObjectURL(file));
    setFilePreviews(previews);
    setFormError(null);
  };

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    const updatedPreviews = filePreviews.filter((_, i) => i !== index);
    setFilePreviews(updatedPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Verificación Honeypot (Anti-bot silencioso)
    if (honeypot && honeypot.trim() !== '') {
      console.warn("Bot detectado por trampa honeypot.");
      setFormError("La petición fue rechazada por el sistema de seguridad.");
      return;
    }

    // 2. Verificación de campos obligatorios
    if (!threatValue.trim() || !description.trim()) {
      setFormError("Por favor completá el dato sospechoso y la descripción.");
      return;
    }

    // 3. Verificación de desafío anti-bot
    if (!captchaAnswer.trim()) {
      setFormError("Por favor resolvé la pregunta de seguridad anti-robot para continuar.");
      return;
    }

    setSubmitting(true);

    try {
      // Subir imágenes primero si las hay
      let uploadedImageUrls: string[] = [];
      if (selectedFiles.length > 0) {
        uploadedImageUrls = await apiService.uploadImages(selectedFiles);
      }

      const newReport = await apiService.submitReport({
        channel,
        threat_type: threatType,
        threat_value: threatValue.trim(),
        description: description.trim(),
        evidence: evidence.trim() || undefined,
        images: uploadedImageUrls.length > 0 ? JSON.stringify(uploadedImageUrls) : undefined,
        scam_type_id: scamTypeId,
        country: 'AR',
        // Anti-bot payload
        captcha_token: captcha?.token,
        captcha_answer: captchaAnswer.trim(),
        hp_token: honeypot
      } as any);

      setSubmittedReport(newReport);
      setThreatValue('');
      setDescription('');
      setEvidence('');
      setSelectedFiles([]);
      setFilePreviews([]);
      setCaptchaAnswer('');
      if (onReportSubmitted) {
        onReportSubmitted();
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Hubo un error al enviar el reporte. Por favor verificá la respuesta de seguridad.');
      loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn w-full">
      <div className="text-center space-y-2">
        <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
          Denuncia y Prevención Comunitaria
        </span>
        <h2 className={`${largeText ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl'} font-black text-white tracking-tight`}>
          Reportar un Intento de Estafa
        </h2>
        <p className={`${largeText ? 'text-lg' : 'text-sm'} text-slate-400 max-w-2xl mx-auto`}>
          Tu reporte anónimo ayuda a proteger a miles de adultos mayores. Los datos son revisados por el equipo moderador antes de integrarse al motor de alertas.
        </p>
      </div>

      {submittedReport ? (
        <div className="glass-panel p-8 sm:p-10 text-center space-y-6 border-emerald-500/30 bg-emerald-950/20 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-black text-white">¡Gracias por tu reporte!</h3>
            <p className="text-slate-300 text-sm sm:text-base max-w-md mx-auto">
              El reporte para <strong className="text-white font-mono">{submittedReport.threat_value}</strong> quedó registrado con el código <span className="font-mono text-emerald-400 font-bold">#{submittedReport.id}</span> en estado <strong className="text-amber-400">Pendiente de Moderación</strong>.
            </p>
          </div>

          <div className="p-5 bg-slate-900/90 rounded-2xl text-xs text-slate-300 text-left space-y-2 border border-white/5 max-w-xl mx-auto">
            <span className="font-bold text-slate-100 flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ¿Qué ocurre ahora con tu reporte?
            </span>
            <p>1. El equipo de moderadores verifica la evidencia y descripción ingresada.</p>
            <p>2. Al validarse, la amenaza sube automáticamente a la base comunitaria central.</p>
            <p>3. Los teléfonos Android con la app móvil sincronizan el nuevo registro en segundo plano.</p>
          </div>

          <button
            onClick={() => {
              setSubmittedReport(null);
              loadCaptcha();
            }}
            className="px-8 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all shadow-md"
          >
            Reportar otro caso
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-6 sm:p-10 space-y-6 shadow-2xl relative">
          {/* Honeypot trampa anti-bots invisible para humanos */}
          <input
            type="text"
            name="hp_company_field"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ display: 'none' }}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          {/* Alerta de error si aplica */}
          {formError && (
            <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Canal de contacto */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
              1. ¿Por qué medio te contactaron?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                { id: 'call', label: 'Llamada Telefónica', icon: PhoneCall },
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
                    className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-bold ${
                      isSelected
                        ? 'bg-indigo-600/35 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-900/90 border-white/10 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
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
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Tipo de dato
              </label>
              <select
                value={threatType}
                onChange={(e) => setThreatType(e.target.value as any)}
                className="w-full py-3 px-3 rounded-xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="phone">Número de Teléfono</option>
                <option value="domain">Dominio Web</option>
                <option value="url">Enlace / URL Completa</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Número, Dominio o Enlace sospechoso
              </label>
              <input
                id="threat-value-input"
                type="text"
                required
                value={threatValue}
                onChange={(e) => setThreatValue(e.target.value)}
                placeholder={threatType === 'phone' ? 'Ej: +54 9 11 1234-5678' : 'Ej: pagina-falsa-anses.com'}
                className="w-full py-3 px-3.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-sm font-mono outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Modalidad de estafa */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              ¿Qué tipo de engaño intentaron hacerte?
            </label>
            <select
              value={scamTypeId || ''}
              onChange={(e) => setScamTypeId(Number(e.target.value))}
              className="w-full py-3 px-3.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
            >
              {scamTypes.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Descripción del hecho */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              ¿Qué te dijeron o pidieron?
            </label>
            <textarea
              id="threat-desc-input"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Dijeron que eran de Mercado Pago y que tenía que transferir dinero para desbloquear la cuenta, o que me hablaban de ANSES..."
              className="w-full py-3 px-3.5 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 text-sm outline-none focus:border-indigo-500 resize-none transition-colors"
            />
          </div>

          {/* Adjuntar Imágenes de Evidencia */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <span>Adjuntar Imágenes de Evidencia (Capturas de pantalla)</span>
              </label>
              <span className="text-xs text-slate-400">Hasta 5 imágenes (PNG, JPG)</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Drag & Drop / Click zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-slate-900/60 bg-slate-950/40"
            >
              <Upload className="w-8 h-8 mx-auto text-indigo-400 mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-200">
                Hacé clic aquí para seleccionar imágenes o capturas de tu celular
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Capturas de chats de WhatsApp, SMS sospechosos o comprobantes falsos
              </p>
            </div>

            {/* Previews de imágenes seleccionadas */}
            {filePreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
                {filePreviews.map((preview, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-white/15 bg-slate-950 aspect-square shadow-md">
                    <img
                      src={preview}
                      alt={`Evidencia ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center hover:bg-rose-500 transition-colors shadow-sm"
                      title="Eliminar imagen"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-mono">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Validador Anti-Bots (Desafío Humano) */}
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Verificación de Seguridad Anti-Robot
                </span>
              </div>
              <button
                type="button"
                onClick={loadCaptcha}
                disabled={captchaLoading}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                title="Cambiar desafío"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${captchaLoading ? 'animate-spin' : ''}`} />
                <span>Cambiar pregunta</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Para proteger a la comunidad y evitar que robots automáticos saturen el servidor con reportes falsos, resolvé este cálculo sencillo:
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="px-4 py-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 font-bold text-sm sm:text-base font-mono flex-shrink-0 text-center">
                {captcha?.question || "¿Cuánto es 3 + 4?"}
              </div>

              <input
                type="number"
                required
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                placeholder="Escribí el número aquí"
                className="w-full sm:w-48 py-2.5 px-3.5 rounded-xl bg-slate-900 border border-white/10 text-white font-bold text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            id="submit-report-button"
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-base transition-all shadow-lg shadow-indigo-600/35 flex items-center justify-center gap-2.5 disabled:opacity-50"
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
