"use client";

import React, { useState, useEffect } from 'react';
import { Shield, Lock, User, ArrowLeft, LogOut, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { AdminModeration } from '../../components/AdminModeration';
import { apiService } from '../../services/api';

const ADMIN_EMAIL = "guillermo.diarte@gmail.com";
const ADMIN_PASS = "Gad33224122";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [syncVersion, setSyncVersion] = useState(10);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  // Check existing session
  useEffect(() => {
    const savedAuth = sessionStorage.getItem('escudo_admin_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoadingMeta(true);
    try {
      const stats = await apiService.getStats();
      setSyncVersion(stats.current_sync_version);
    } catch (e) {
      console.warn("Could not load stats:", e);
    } finally {
      setIsLoadingMeta(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASS) {
      setIsAuthenticated(true);
      sessionStorage.setItem('escudo_admin_auth', 'true');
    } else {
      setLoginError("Usuario o contraseña incorrectos. Verificá los datos ingresados.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('escudo_admin_auth');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 flex flex-col justify-between">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 right-10 w-[35rem] h-[35rem] bg-indigo-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-[35rem] h-[35rem] bg-cyan-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col flex-grow">
        {/* Top Navbar */}
        <header className="backdrop-blur-xl bg-[#080d1a]/90 border-b border-white/10 px-4 sm:px-8 py-3.5 sticky top-0 z-50">
          <div className="max-w-[1560px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-extrabold text-lg text-white">Escudo Digital</span>
                  <span className="text-xs text-indigo-400 font-semibold block">Panel Moderador</span>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/10 transition-all"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-400" />
                <span>Volver al Portal Público</span>
              </Link>

              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-grow max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-10">
          {!isAuthenticated ? (
            /* Login Screen */
            <div className="max-w-md mx-auto my-12 animate-fadeIn">
              <div className="glass-panel p-8 sm:p-10 border-indigo-500/30 bg-gradient-to-b from-slate-900/95 to-slate-950/95 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-cyan-500 to-indigo-500"></div>

                <div className="text-center space-y-2 mb-8">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                    <Lock className="w-7 h-7" />
                  </div>
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    Acceso de Moderación
                  </h1>
                  <p className="text-xs text-slate-400">
                    Ingresá tus credenciales administrativas para validar casos y gestionar amenazas.
                  </p>
                </div>

                {loginError && (
                  <div className="mb-6 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario@ejemplo.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/30"
                  >
                    Iniciar Sesión
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-white/10 text-center">
                  <Link href="/" className="text-xs text-slate-400 hover:text-indigo-400 transition-colors">
                    ← Volver a la página principal
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* Authenticated Admin Dashboard */
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs text-slate-400 font-mono">
                  Sesión activa: <strong className="text-emerald-400 font-bold">{ADMIN_EMAIL}</strong>
                </span>
              </div>

              <AdminModeration
                syncVersion={syncVersion}
                onDataChanged={fetchStats}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
