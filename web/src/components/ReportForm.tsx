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
  AlertCircle,
  HelpCircle,
  Check,
  AlertTriangle,
  Info
} from 'lucide-react';
import { apiService } from '../services/api';
import { ScamType, CitizenReport, CaptchaChallenge } from '../types';

interface ReportFormProps {
  largeText: boolean;
  onReportSubmitted?: () => void;
}

// Función de validación estricta y amigable
function validateThreatInput(type: 'phone' | 'domain' | 'url', value: string): { isValid: boolean; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { isValid: false, error: null };
  }

  if (type === 'phone') {
    // No debe contener letras ni texto alguno
    if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(trimmed)) {
      return {
        isValid: false,
        error: 'Un número de teléfono no puede contener letras ni texto. Ingresá solo números, guiones o código de área (ej: +54 9 351 314-6924).'
      };
    }
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 7) {
      return {
        isValid: false,
        error: 'El teléfono debe tener al menos 7 dígitos para ser un número válido.'
      };
    }
    if (digits.length > 15) {
      return {
        isValid: false,
        error: 'El número supera la longitud máxima permitida para una línea telefónica.'
      };
    }
    return { isValid: true, error: null };
  }

  if (type === 'domain' || type === 'url') {
    // No puede ser solo números
    const onlyDigitsAndPhoneChars = /^[\d\s+\-()]+$/.test(trimmed);
    if (onlyDigitsAndPhoneChars) {
      return {
        isValid: false,
        error: 'Una dirección web o enlace no puede componerse solo de números. Si se trata de un número de teléfono, cambiá el tipo de dato a "Número de Teléfono".'
      };
    }

    // Acepta formatos como:
    // www.webfalsa.com, webfalsa.com, webfalsa.com/algo, webfalsa/otracosa, https://webfalsa.com, etc.
    const withoutProtocol = trimmed.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    const hasDot = withoutProtocol.includes('.');
    const hasSlash = withoutProtocol.includes('/');

    if (!hasDot && !hasSlash) {
      return {
        isValid: false,
        error: 'Ingresá un dominio o enlace web válido (ej: webfalsa.com, www.sitio.com o webfalsa/otracosa).'
      };
    }

    if (/\s/.test(withoutProtocol.split('/')[0])) {
      return {
        isValid: false,
        error: 'El nombre del dominio no debe contener espacios en blanco.'
      };
    }

    return { isValid: true, error: null };
  }

  return { isValid: true, error: null };
}

export const ReportForm: React.FC<ReportFormProps> = ({ largeText, onReportSubmitted }) => {
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'call' | 'web'>('whatsapp');
  const [threatType, setThreatType] = useState<'phone' | 'domain' | 'url'>('phone');
  const [threatValue, setThreatValue] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [scamTypeId, setScamTypeId] = useState<number | undefined>(undefined);
  const [scamTypes, setScamTypes] = useState<ScamType[]>([]);

  // Opción "Otro" para modalidad de estafa
  const [isOtherScamType, setIsOtherScamType] = useState(false);
  const [otherScamDetail, setOtherScamDetail] = useState('');

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

  // Validación en tiempo real del dato sospechoso
  const validationResult = validateThreatInput(threatType, threatValue);

  // Load scam types and initial anti-bot challenge
  const loadCaptcha = async () => {
    setCaptchaLoading(true);
    setFormError(null);
    try {
      const challenge = await apiService.getCaptcha();
      setCaptcha(challenge);
      setCaptchaAnswer('');
    } catch (e) {
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
          // Seleccionar el primer tipo por defecto
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
    if (!threatValue.trim()) {
      setFormError("Por favor ingresá el número o enlace sospechoso.");
      return;
    }

    // 3. Validación estricta del dato según su tipo (teléfono vs dominio/url)
    const valCheck = validateThreatInput(threatType, threatValue);
    if (!valCheck.isValid && valCheck.error) {
      setFormError(valCheck.error);
      return;
    }

    // 4. Si eligió "Otro", verificar que haya detallado qué tipo de engaño fue
    if (isOtherScamType && !otherScamDetail.trim()) {
      setFormError("Por favor detallá brevemente qué tipo de engaño intentaron hacerte en el campo 'Otro'.");
      return;
    }

    if (!description.trim()) {
      setFormError("Por favor contanos brevemente qué te dijeron o pidieron.");
      return;
    }

    // 5. Verificación de desafío anti-bot
    if (!captchaAnswer.trim()) {
      setFormError("Por favor resolvé la pregunta de seguridad anti-robot para continuar.");
      return;
    }

    setSubmitting(true);

    try {
      // Subir imágenes primero si las hay (se convierten a WebP optimizado en el servidor)
      let uploadedImageUrls: string[] = [];
      if (selectedFiles.length > 0) {
        uploadedImageUrls = await apiService.uploadImages(selectedFiles);
      }

      // Preparar payload de descripción y scam type
      let finalScamTypeId = scamTypeId;
      let finalDesc = description.trim();

      if (isOtherScamType) {
        const otroCat = scamTypes.find(st => st.slug === 'otro');
        finalScamTypeId = otroCat ? otroCat.id : undefined;
        finalDesc = `[Modalidad específica: ${otherScamDetail.trim()}]\n\n${finalDesc}`;
      }

      const newReport = await apiService.submitReport({
        channel,
        threat_type: threatType,
        threat_value: threatValue.trim(),
        description: finalDesc,
        evidence: evidence.trim() || undefined,
        images: uploadedImageUrls.length > 0 ? JSON.stringify(uploadedImageUrls) : undefined,
        scam_type_id: finalScamTypeId,
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
      setOtherScamDetail('');
      setIsOtherScamType(false);
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
    <div className="w-full max-w-[1560px] mx-auto space-y-6 animate-fadeIn">
      {/* Header Compacto y Extendido */}
      <div className="glass-panel p-6 sm:p-8 border-indigo-500/20 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
              Denuncia y Prevención Comunitaria
            </span>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              100% Anónimo y Seguro
            </span>
          </div>
          <h2 className={`${largeText ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl'} font-black text-white tracking-tight`}>
            Reportar un Intento de Estafa
          </h2>
          <p className={`${largeText ? 'text-base' : 'text-sm'} text-slate-300 max-w-3xl`}>
            Tu reporte anónimo ayuda a proteger a miles de adultos mayores. Los datos son analizados por el equipo moderador antes de integrarse al motor de alertas y sincronizarse en las aplicaciones móviles.
          </p>
        </div>
      </div>

      {submittedReport ? (
        <div className="glass-panel p-8 sm:p-12 text-center space-y-6 border-emerald-500/30 bg-emerald-950/20 shadow-2xl max-w-3xl mx-auto">
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
            <p>1. El equipo de moderadores verifica la evidencia fotográfica y el relato ingresado.</p>
            <p>2. Al validarse, se agrupa de forma inteligente con otros reportes del mismo número o sitio y se incorpora a la base comunitaria central.</p>
            <p>3. Los teléfonos Android con la app móvil sincronizan automáticamente el registro para bloquear llamadas y mensajes sospechosos.</p>
          </div>

          <button
            onClick={() => {
              setSubmittedReport(null);
              loadCaptcha();
            }}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm transition-all shadow-lg"
          >
            Reportar otro caso
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-6 sm:p-8 lg:p-10 shadow-2xl relative border-white/10">
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
            <div className="p-4 mb-6 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-center gap-3 animate-fadeIn">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              <span className="font-medium">{formError}</span>
            </div>
          )}

          {/* GRID RESPONSIVO DE 2 COLUMNAS (Aprovecha los costados en desktop y evita scroll) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* COLUMNA IZQUIERDA: DATOS PRINCIPALES DE LA ESTAFA (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Paso 1: Canal de contacto */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs">1</span>
                  <span>¿Por qué medio intentaron contactarte?</span>
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
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-bold ${
                          isSelected
                            ? 'bg-indigo-600/35 border-indigo-500 text-white shadow-md shadow-indigo-600/20 scale-[1.02]'
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

              {/* Paso 2: Tipo de dato y Valor con Validación en Vivo */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs">2</span>
                  <span>Dato sospechoso a reportar</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <select
                      value={threatType}
                      onChange={(e) => setThreatType(e.target.value as any)}
                      className="w-full py-3 px-3 rounded-xl bg-slate-950 border border-white/15 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="phone">Número de Teléfono</option>
                      <option value="domain">Dominio Web (Ej: webfalsa.com)</option>
                      <option value="url">Enlace o URL Completa</option>
                    </select>
                  </div>

                  <div className="sm:col-span-7">
                    <div className="relative">
                      <input
                        id="threat-value-input"
                        type="text"
                        required
                        value={threatValue}
                        onChange={(e) => setThreatValue(e.target.value)}
                        placeholder={
                          threatType === 'phone'
                            ? 'Ej: +54 9 351 314-6924 o 3513146924'
                            : 'Ej: webfalsa.com o https://webfalsa.com/algo'
                        }
                        className={`w-full py-3 pl-3.5 pr-10 rounded-xl bg-slate-950 border text-white placeholder-slate-500 text-sm font-mono outline-none transition-colors ${
                          threatValue.trim().length > 0
                            ? validationResult.isValid
                              ? 'border-emerald-500/60 focus:border-emerald-500'
                              : 'border-rose-500/70 focus:border-rose-500 bg-rose-950/10'
                            : 'border-white/15 focus:border-indigo-500'
                        }`}
                      />
                      {threatValue.trim().length > 0 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {validationResult.isValid ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mensaje de validación en tiempo real debajo del campo */}
                {threatValue.trim().length > 0 && !validationResult.isValid && validationResult.error && (
                  <p className="text-xs text-rose-400 flex items-center gap-1.5 pt-0.5 animate-fadeIn">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{validationResult.error}</span>
                  </p>
                )}
                {threatValue.trim().length > 0 && validationResult.isValid && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5 pt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      {threatType === 'phone'
                        ? 'Formato numérico válido (se unificará automáticamente con sus variantes).'
                        : 'Formato web válido (se agrupará con todas las rutas del mismo dominio).'}
                    </span>
                  </p>
                )}
              </div>

              {/* Paso 3: Modalidad de engaño + Opción "Otro" */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs">3</span>
                  <span>¿Qué tipo de engaño intentaron hacerte?</span>
                </label>

                <select
                  value={isOtherScamType ? 'other' : scamTypeId || ''}
                  onChange={(e) => {
                    if (e.target.value === 'other') {
                      setIsOtherScamType(true);
                    } else {
                      setIsOtherScamType(false);
                      setScamTypeId(Number(e.target.value));
                    }
                  }}
                  className="w-full py-3 px-3.5 rounded-xl bg-slate-950 border border-white/15 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
                >
                  {scamTypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                  <option value="other" className="font-bold text-indigo-300">
                    Otro tipo de engaño (describir caso específico)
                  </option>
                </select>

                {/* Campo emergente si selecciona "Otro" */}
                {isOtherScamType && (
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 animate-fadeIn">
                    <label className="text-xs font-semibold text-indigo-200 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-indigo-400" />
                      <span>Especificá qué tipo de engaño fue:</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={otherScamDetail}
                      onChange={(e) => setOtherScamDetail(e.target.value)}
                      placeholder="Ej: Falsa oferta de empleo remoto, estafa de alquiler temporal, criptomonedas..."
                      className="w-full py-2.5 px-3 rounded-lg bg-slate-900 border border-indigo-500/30 text-white placeholder-slate-400 text-xs sm:text-sm outline-none focus:border-indigo-400 transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Paso 4: Descripción del hecho */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs">4</span>
                  <span>¿Qué te dijeron o qué te pidieron?</span>
                </label>
                <textarea
                  id="threat-desc-input"
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Me dijeron que eran del banco y que debía transferir saldo para evitar el bloqueo de la cuenta, o me pidieron un código de 6 dígitos que me llegó por SMS..."
                  className="w-full py-3 px-3.5 rounded-xl bg-slate-950 border border-white/15 text-white placeholder-slate-500 text-sm outline-none focus:border-indigo-500 resize-none transition-colors"
                />
              </div>

            </div>

            {/* COLUMNA DERECHA: EVIDENCIA, VALIDACIÓN ANTI-BOT Y ENVÍO (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Paso 5: Adjuntar Imágenes de Evidencia */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs">5</span>
                    <span>Adjuntar Evidencia (Capturas)</span>
                  </label>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedFiles.length}/5 imágenes
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Dropzone compacto */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-indigo-500/60 rounded-2xl p-5 text-center cursor-pointer transition-all hover:bg-slate-900/60 bg-slate-950/40 group"
                >
                  <Upload className="w-7 h-7 mx-auto text-indigo-400 mb-1.5 group-hover:scale-110 transition-transform opacity-80" />
                  <p className="text-xs sm:text-sm font-semibold text-slate-200">
                    Hacé clic para seleccionar capturas de pantalla
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Chats de WhatsApp, SMS o comprobantes (PNG, JPG, WEBP)
                  </p>
                </div>

                {/* Galería de Previews */}
                {filePreviews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
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
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 transition-colors shadow-sm"
                          title="Eliminar imagen"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/70 text-[9px] text-white font-mono">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Paso 6: Verificación Anti-Robot (Captcha Humano) */}
              <div className="bg-slate-950/90 p-5 rounded-2xl border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Verificación de Seguridad
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
                    <span>Cambiar</span>
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  Protección anti-robot para mantener limpia la base comunitaria:
                </p>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2.5 rounded-xl bg-indigo-950/70 border border-indigo-500/40 text-indigo-200 font-bold text-sm sm:text-base font-mono flex-shrink-0 text-center">
                    {captcha?.question || "¿Cuánto es 3 + 4?"}
                  </div>

                  <input
                    type="number"
                    required
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Resultado"
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-sm outline-none focus:border-indigo-500 text-center font-mono"
                  />
                </div>
              </div>

              {/* Paso 7: Botón de Envío destacado */}
              <div className="pt-2">
                <button
                  id="submit-report-button"
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-base transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 disabled:opacity-50"
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
                <p className="text-[11px] text-slate-500 text-center mt-2">
                  Al enviar, un moderador validará el caso para alertar a otros ciudadanos.
                </p>
              </div>

            </div>

          </div>
        </form>
      )}
    </div>
  );
};
