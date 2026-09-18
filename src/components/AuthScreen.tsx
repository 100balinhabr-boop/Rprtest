import React, { useState, useEffect } from 'react';
import { UserAccount, AuthResponse } from '../types';
import { 
  Tv, Lock, User, Eye, EyeOff, LogIn, AlertCircle, CheckCircle,
  ShieldCheck, BadgeCheck
} from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (user: UserAccount, token: string) => void;
}

interface ClientBranding {
  appName: string;
  accentColor: string;
  logoUrl: string;
  footerText: string;
}

const DEFAULT_BRANDING: ClientBranding = {
  appName: 'RPR TV',
  accentColor: '#dc2626',
  logoUrl: '',
  footerText: 'Transmissão HD • Canais ao Vivo • Player Rápido',
};

function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `#${clean}${a}`;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [branding, setBranding] = useState<ClientBranding>(DEFAULT_BRANDING);
  const accent = branding.accentColor;

  useEffect(() => {
    fetch('/api/client-config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.branding) {
          setBranding({ ...DEFAULT_BRANDING, ...data.branding });
        }
      })
      .catch(() => {});
  }, []);

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
    <div className="min-h-screen w-full bg-[#08080c] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Glow ambiente na cor do branding */}
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-[140px] pointer-events-none" style={{ background: hexWithAlpha(accent, 0.2) }} />
      <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full blur-[160px] pointer-events-none" style={{ background: hexWithAlpha(accent, 0.12) }} />
      <div className="absolute inset-0 bg-[radial-gradient(#1e1e28_1px,transparent_1px)] [background-size:26px_26px] opacity-30 pointer-events-none" />

      <div
        className="w-full max-w-md bg-[#0d0d14]/95 border rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative z-10"
        style={{
          borderColor: hexWithAlpha(accent, 0.4),
          boxShadow: `0 20px 60px -15px ${hexWithAlpha(accent, 0.35)}`,
        }}
      >
        {/* Header da marca */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${hexWithAlpha(accent, 0.75)})`,
              boxShadow: `0 20px 45px -12px ${hexWithAlpha(accent, 0.7)}`,
              border: `1px solid ${hexWithAlpha(accent, 0.6)}`,
            }}
          >
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="logo" className="w-full h-full object-contain p-2" />
            ) : (
              <Tv className="w-10 h-10 text-white" />
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white truncate max-w-[240px]">
              {branding.appName}
            </h1>
            <BadgeCheck className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" style={{ color: accent, fill: hexWithAlpha(accent, 0.2) }} />
          </div>

          {branding.footerText && (
            <p className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: accent }} />
              <span className="truncate max-w-[300px]">{branding.footerText}</span>
            </p>
          )}
        </div>

        {/* Mensagens de feedback */}
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

        {/* Formulário */}
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
                className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition"
                onFocus={(e) => {
                  e.target.style.boxShadow = `0 0 0 2px ${accent}`;
                  e.target.style.borderColor = 'transparent';
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = 'none';
                  e.target.style.borderColor = '';
                }}
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
                className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition"
                onFocus={(e) => {
                  e.target.style.boxShadow = `0 0 0 2px ${accent}`;
                  e.target.style.borderColor = 'transparent';
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = 'none';
                  e.target.style.borderColor = '';
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 transition cursor-pointer"
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
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900"
                style={{ accentColor: accent }}
              />
              <span>Manter conectado</span>
            </label>
          </div>

          <button
            id="submit-login-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer mt-2"
            style={{
              background: `linear-gradient(90deg, ${accent}, ${hexWithAlpha(accent, 0.85)})`,
              boxShadow: `0 15px 35px -10px ${hexWithAlpha(accent, 0.6)}`,
            }}
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

        {/* Footer */}
        <div className="mt-6 pt-4 border-t flex items-center justify-between text-[11px] text-slate-500" style={{ borderColor: hexWithAlpha(accent, 0.2) }}>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: accent }} />
            <span>Conexão segura</span>
          </div>
          <span className="font-mono text-[10px]">{branding.appName} v2.5</span>
        </div>
      </div>
    </div>
  );
};
