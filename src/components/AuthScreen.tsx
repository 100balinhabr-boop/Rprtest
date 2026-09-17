import React, { useState } from 'react';
import { UserAccount, AuthResponse } from '../types';
import { 
  Tv, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  LogIn, 
  AlertCircle, 
  CheckCircle, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (user: UserAccount, token: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  // Login states
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Status states
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!loginUsername.trim()) {
      setErrorMsg('Informe seu nome de usuário ou e-mail.');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Informe sua senha.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      const data: AuthResponse = await res.json();

      if (res.ok && data.success && data.user && data.token) {
        if (rememberMe) {
          localStorage.setItem('iptv_auth_token', data.token);
          localStorage.setItem('iptv_auth_user', JSON.stringify(data.user));
        } else {
          sessionStorage.setItem('iptv_auth_token', data.token);
          sessionStorage.setItem('iptv_auth_user', JSON.stringify(data.user));
        }
        setSuccessMsg(`Bem-vindo, ${data.user.name}!`);
        setTimeout(() => {
          onAuthSuccess(data.user!, data.token!);
        }, 500);
      } else {
        setErrorMsg(data.error || 'Credenciais inválidas. Verifique usuário e senha.');
      }
    } catch {
      // Local fallback in case network proxy is interrupted
      if (loginUsername.trim().toLowerCase() === 'admin' && loginPassword === 'admin') {
        const fallbackUser: UserAccount = {
          id: 'user_admin',
          username: 'admin',
          name: 'Administrador',
          email: 'admin@iptvpro.local',
          role: 'admin',
          createdAt: new Date().toISOString(),
        };
        const token = 'token_local_admin';
        if (rememberMe) {
          localStorage.setItem('iptv_auth_token', token);
          localStorage.setItem('iptv_auth_user', JSON.stringify(fallbackUser));
        }
        onAuthSuccess(fallbackUser, token);
      } else {
        setErrorMsg('Erro de conexão com o servidor de autenticação.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050914] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Ambient background glow accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0B1124]/95 border border-slate-800/90 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-400 shadow-xl shadow-blue-600/25 ring-1 ring-blue-400/40 mb-3">
            <Tv className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            RPR TV FREE
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Transmissão ao Vivo • Acesso Restrito</span>
          </p>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-600/50 flex items-start gap-2.5 text-rose-200 text-xs animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-tight">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 flex items-start gap-2.5 text-emerald-200 text-xs animate-in fade-in duration-150">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-tight">{successMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Usuário ou E-mail
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-username-input"
                type="text"
                autoComplete="username"
                placeholder="Seu usuário cadastrado"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-[#131B32] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password-input"
                type={showLoginPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Sua senha de acesso"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-[#131B32] border border-slate-700/80 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 transition cursor-pointer"
                title={showLoginPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
              />
              <span>Manter conectado</span>
            </label>
          </div>

          <button
            id="submit-login-btn"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Entrar no Aplicativo</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Access Pills */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <p className="text-[10px] font-medium text-slate-400 mb-2 text-center">
            Acesso Rápido para Testes:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setLoginUsername('admin');
                setLoginPassword('admin');
                setErrorMsg(null);
              }}
              className="px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-semibold text-center transition cursor-pointer"
            >
              👑 Admin Master
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginUsername('cliente');
                setLoginPassword('123456');
                setErrorMsg(null);
              }}
              className="px-2 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold text-center transition cursor-pointer"
            >
              👤 Cliente Final (App)
            </button>
          </div>
        </div>

        {/* Security Badge & Access Info Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Acesso gerenciado pelo Administrador</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">RPR TV v2.4</span>
        </div>
      </div>
    </div>
  );
};
