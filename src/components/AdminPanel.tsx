import React, { useState, useEffect, useMemo } from 'react';
import { UserAccount } from '../types';
import {
  Users, X, Search, Lock, Unlock, Trash2, UserPlus, RefreshCw,
  AlertCircle, CheckCircle, Calendar, Eye, EyeOff, Pencil, Tv,
  Clock, Crown, Briefcase, CalendarPlus, AlertTriangle,
  UserCheck, UserX, TrendingUp, LayoutDashboard, Settings as SettingsIcon,
  LogOut, ChevronRight, Play, Menu, Shield, Sparkles, Copy, Check
} from 'lucide-react';

interface AdminPanelProps {
  currentAdmin: UserAccount;
  onClose: () => void;
  onGoToPlayer: () => void;
}

export const normalizeUserRole = (r?: string): 'AdminMaster' | 'AdminRevenda' | 'UsuarioComum' => {
  if (!r) return 'UsuarioComum';
  const lower = r.toLowerCase();
  if (lower === 'adminmaster' || lower === 'master' || lower === 'admin') return 'AdminMaster';
  if (lower === 'adminrevenda' || lower === 'revenda') return 'AdminRevenda';
  return 'UsuarioComum';
};

export const formatDateDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return 'Vitalício';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export const getExpirationInfo = (expirationDate?: string | null) => {
  if (!expirationDate || expirationDate === 'vitalicio') {
    return { status: 'vitalicio' as const, label: 'Vitalício', isExpired: false, isExpiring7: false };
  }
  const exp = new Date(`${expirationDate.slice(0, 10)}T23:59:59`);
  const diffMs = exp.getTime() - Date.now();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { status: 'expired' as const, label: `Vencido (${formatDateDisplay(expirationDate)})`, isExpired: true, isExpiring7: false };
  if (daysLeft <= 7) return { status: 'warning' as const, label: `Vence em ${daysLeft}d`, isExpired: false, isExpiring7: true };
  return { status: 'active' as const, label: `Até ${formatDateDisplay(expirationDate)}`, isExpired: false, isExpiring7: false };
};

type Section = 'dashboard' | 'clients' | 'revendas' | 'admins' | 'create' | 'settings';

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentAdmin, onClose, onGoToPlayer }) => {
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [settingLoading, setSettingLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const currentAdminRole = normalizeUserRole(currentAdmin.role);
  const isMaster = currentAdminRole === 'AdminMaster';
  const isRevenda = currentAdminRole === 'AdminRevenda';

  // FORM CRIAR
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'UsuarioComum' | 'AdminRevenda' | 'AdminMaster'>('UsuarioComum');
  const [formExpirationDate, setFormExpirationDate] = useState(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [formPlaylistUrl, setFormPlaylistUrl] = useState('');
  const [formPlaylistName, setFormPlaylistName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);

  // FORM EDITAR
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'UsuarioComum' | 'AdminRevenda' | 'AdminMaster'>('UsuarioComum');
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editIsBlocked, setEditIsBlocked] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const getAuthToken = () => localStorage.getItem('iptv_auth_token') || sessionStorage.getItem('iptv_auth_token') || '';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${getAuthToken()}` } });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        if (data.settings && typeof data.settings.allowPublicRegistration === 'boolean') {
          setAllowRegistration(data.settings.allowPublicRegistration);
        }
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao carregar usuários.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro de comunicação com o servidor.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (feedbackMsg) {
      const t = setTimeout(() => setFeedbackMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [feedbackMsg]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let g = '';
    for (let i = 0; i < 8; i++) g += chars.charAt(Math.floor(Math.random() * chars.length));
    return g;
  };

  const setExpirationDays = (days: number, target: 'form' | 'edit') => {
    let base = Date.now();
    if (target === 'edit' && editExpirationDate) {
      const existing = new Date(`${editExpirationDate.slice(0, 10)}T23:59:59`).getTime();
      if (!isNaN(existing) && existing > Date.now()) base = existing;
    }
    const d = new Date(base + days * 24 * 60 * 60 * 1000);
    const str = d.toISOString().split('T')[0];
    if (target === 'form') setFormExpirationDate(str);
    else setEditExpirationDate(str);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    const cleanUsername = formUsername.trim().toLowerCase().replace(/\s+/g, '');
    if (cleanUsername.length < 3) {
      setFeedbackMsg({ type: 'error', text: 'Usuário precisa ter ao menos 3 caracteres.' });
      return;
    }
    if (formPassword.length < 4) {
      setFeedbackMsg({ type: 'error', text: 'Senha precisa ter ao menos 4 caracteres.' });
      return;
    }

    const assignedRole = isRevenda ? 'UsuarioComum' : formRole;
    setIsSubmittingNewUser(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({
          name: formName.trim() || cleanUsername,
          username: cleanUsername,
          email: formEmail.trim() || undefined,
          password: formPassword,
          role: assignedRole,
          expirationDate: formExpirationDate || null,
          playlistUrl: formPlaylistUrl.trim() || undefined,
          playlistName: formPlaylistName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: `@${cleanUsername} cadastrado com sucesso como ${assignedRole}!` });
        setFormName(''); setFormUsername(''); setFormEmail(''); setFormPassword('');
        setFormRole('UsuarioComum');
        setFormExpirationDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        setFormPlaylistUrl(''); setFormPlaylistName('');
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao cadastrar.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha de comunicação ao cadastrar.' });
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  const handleToggleBlock = async (user: UserAccount) => {
    const role = normalizeUserRole(user.role);
    if (user.id === currentAdmin.id) return setFeedbackMsg({ type: 'error', text: 'Você não pode bloquear a si mesmo.' });
    if (role === 'AdminMaster') return setFeedbackMsg({ type: 'error', text: 'Não pode bloquear AdminMaster.' });
    if (isRevenda && role !== 'UsuarioComum') return setFeedbackMsg({ type: 'error', text: 'Revenda só gerencia clientes.' });

    setActionLoadingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/toggle-block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: data.message });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao bloquear.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha ao bloquear.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDelete = async (user: UserAccount) => {
    setActionLoadingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: data.message || 'Excluído.' });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao excluir.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha ao excluir.' });
    } finally {
      setActionLoadingId(null);
      setPendingDeleteId(null);
    }
  };

  const handleQuickRenew = async (user: UserAccount, days: number) => {
    setActionLoadingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: data.message });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao renovar.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha ao renovar.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenEdit = (user: UserAccount) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditUsername(user.username || '');
    setEditEmail(user.email || '');
    setEditRole(normalizeUserRole(user.role));
    setEditExpirationDate(user.expirationDate ? user.expirationDate.slice(0, 10) : '');
    setEditIsBlocked(!!user.isBlocked);
    setEditPassword('');
    setEditShowPassword(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const cleanUsername = editUsername.trim().toLowerCase().replace(/\s+/g, '');
    if (cleanUsername.length < 3) return setFeedbackMsg({ type: 'error', text: 'Usuário muito curto.' });
    if (editPassword && editPassword.trim().length < 4) return setFeedbackMsg({ type: 'error', text: 'Senha muito curta.' });

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(editingUser.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({
          name: editName.trim(),
          username: cleanUsername,
          email: editEmail.trim() || undefined,
          role: isMaster ? editRole : undefined,
          expirationDate: editExpirationDate || 'vitalicio',
          password: editPassword.trim() || undefined,
          isBlocked: editIsBlocked,
        }),
      });
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: data.message || 'Atualizado.' });
        setEditingUser(null);
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao salvar.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha ao salvar.' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleRegistration = async () => {
    setSettingLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ allowPublicRegistration: !allowRegistration }),
      });
      const data = await res.json();
      if (data.success) {
        setAllowRegistration(!allowRegistration);
        setFeedbackMsg({ type: 'success', text: data.message });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro.' });
    } finally {
      setSettingLoading(false);
    }
  };

  // Stats
  const totalUsers = users.length;
  const clientUsers = users.filter(u => normalizeUserRole(u.role) === 'UsuarioComum').length;
  const revendaUsers = users.filter(u => normalizeUserRole(u.role) === 'AdminRevenda').length;
  const masterUsers = users.filter(u => normalizeUserRole(u.role) === 'AdminMaster').length;
  const expiredUsers = users.filter(u => getExpirationInfo(u.expirationDate).isExpired).length;
  const blockedUsersCount = users.filter(u => u.isBlocked).length;
  const expiring7Users = users.filter(u => getExpirationInfo(u.expirationDate).isExpiring7).length;
  const activeClients = users.filter(u => normalizeUserRole(u.role) === 'UsuarioComum' && !u.isBlocked && !getExpirationInfo(u.expirationDate).isExpired).length;

  const filteredUsers = useMemo(() => {
    let list = users;
    if (section === 'clients') list = list.filter(u => normalizeUserRole(u.role) === 'UsuarioComum');
    else if (section === 'revendas') list = list.filter(u => normalizeUserRole(u.role) === 'AdminRevenda');
    else if (section === 'admins') list = list.filter(u => normalizeUserRole(u.role) === 'AdminMaster');
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.email ? u.email.toLowerCase().includes(q) : false));
  }, [users, section, searchQuery]);

  const menuItems = [
    { id: 'dashboard' as Section, label: 'Dashboard', icon: LayoutDashboard, masterOnly: false },
    { id: 'clients' as Section, label: 'Clientes', icon: Users, badge: clientUsers, masterOnly: false },
    { id: 'revendas' as Section, label: 'Revendas', icon: Briefcase, badge: revendaUsers, masterOnly: false },
    { id: 'admins' as Section, label: 'Admins', icon: Crown, badge: masterUsers, masterOnly: true },
    { id: 'create' as Section, label: 'Criar Usuário', icon: UserPlus, masterOnly: false },
    { id: 'settings' as Section, label: 'Configurações', icon: SettingsIcon, masterOnly: true },
  ];

  const sectionTitle = {
    dashboard: 'Dashboard', clients: 'Clientes', revendas: 'Revendas',
    admins: 'Admins Master', create: 'Criar Usuário', settings: 'Configurações',
  }[section];

  return (
    <div className="min-h-screen bg-[#08080c] text-slate-100 flex">
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-40 lg:hidden" />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-[#0b0b12] border-r border-red-900/30 flex flex-col z-50 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 border-b border-red-900/20 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-700 to-red-500 flex items-center justify-center shadow-lg shadow-red-600/30 shrink-0">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-white text-base">RPR TV</h1>
            <p className="text-[10px] text-slate-400 font-mono">Painel Master</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden p-1.5 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-red-900/20">
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${isMaster ? 'bg-amber-950/40 border-amber-700/40' : 'bg-blue-950/40 border-blue-700/40'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border-2 ${isMaster ? 'bg-gradient-to-tr from-amber-600 to-amber-400 border-amber-400/60 text-white' : 'bg-gradient-to-tr from-blue-700 to-blue-500 border-blue-400/60 text-white'}`}>
              {currentAdmin.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{currentAdmin.name}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate">@{currentAdmin.username}</p>
            </div>
            {isMaster ? <Crown className="w-4 h-4 text-amber-400" /> : <Briefcase className="w-4 h-4 text-blue-400" />}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.filter(i => !i.masterOnly || isMaster).map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setSidebarOpen(false); setSearchQuery(''); setPendingDeleteId(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${active ? 'bg-red-700/30 text-white border border-red-600/40' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'}`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-red-400' : ''}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-red-900/20 space-y-1">
          <button onClick={onGoToPlayer} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/50">
            <Play className="w-4 h-4" /><span>Ir para o Player</span>
          </button>
          <button onClick={onClose} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-950/30">
            <LogOut className="w-4 h-4" /><span>Sair</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-30 bg-[#0b0b12]/95 backdrop-blur border-b border-red-900/20 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg bg-slate-800/60">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-black text-white truncate">{sectionTitle}</h2>
          </div>
          <button onClick={fetchUsers} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/60 hover:bg-slate-700 text-slate-200 border border-slate-700/60">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </header>

        {feedbackMsg && (
          <div className={`mx-4 sm:mx-6 mt-4 p-3 rounded-xl text-xs flex items-center justify-between gap-3 border ${feedbackMsg.type === 'success' ? 'bg-emerald-950/80 text-emerald-200 border-emerald-700/60' : 'bg-rose-950/80 text-rose-200 border-rose-700/60'}`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* DASHBOARD */}
          {section === 'dashboard' && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Clientes Ativos', value: activeClients, color: 'emerald', icon: UserCheck, target: 'clients' as Section },
                { label: 'Vencendo 7d', value: expiring7Users, color: 'amber', icon: TrendingUp, target: 'clients' as Section },
                { label: 'Vencidos', value: expiredUsers, color: 'rose', icon: Clock, target: 'clients' as Section },
                { label: 'Revendas', value: revendaUsers, color: 'blue', icon: Briefcase, target: 'revendas' as Section },
                { label: 'Admins', value: masterUsers, color: 'amber', icon: Crown, target: 'admins' as Section, masterOnly: true },
                { label: 'Bloqueados', value: blockedUsersCount, color: 'slate', icon: UserX, target: null },
              ].filter(c => !c.masterOnly || isMaster).map((card, i) => {
                const Icon = card.icon;
                const colorMap: any = {
                  emerald: 'from-emerald-950/40 border-emerald-800/40 text-emerald-400',
                  amber: 'from-amber-950/40 border-amber-800/40 text-amber-400',
                  rose: 'from-rose-950/40 border-rose-800/40 text-rose-400',
                  blue: 'from-blue-950/40 border-blue-800/40 text-blue-400',
                  slate: 'from-slate-900/60 border-slate-800/60 text-slate-400',
                };
                return (
                  <button
                    key={i}
                    onClick={() => card.target && setSection(card.target)}
                    disabled={!card.target}
                    className={`text-left p-5 rounded-2xl bg-gradient-to-br ${colorMap[card.color]} to-[#0b0b12] border transition ${card.target ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-12 h-12 rounded-xl bg-${card.color}-500/15 border border-${card.color}-500/30 flex items-center justify-center`}>
                        <Icon className={`w-6 h-6`} />
                      </div>
                      {card.target && <ChevronRight className="w-5 h-5 text-slate-600" />}
                    </div>
                    <p className="text-xs uppercase font-bold tracking-wider">{card.label}</p>
                    <p className="text-4xl font-black text-white mt-1">{card.value}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* CREATE */}
          {section === 'create' && (
            <form onSubmit={handleCreate} className="max-w-2xl mx-auto space-y-4 bg-[#0f0f17] border border-slate-800/60 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Novo {isRevenda ? 'Cliente' : 'Usuário'}</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo</label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="João Silva" required className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Login (@)</label>
                  <input type="text" value={formUsername} onChange={e => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))} placeholder="joaosilva" required className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail (opcional)</label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="cliente@email.com" className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">Senha</label>
                    <button type="button" onClick={() => { setFormPassword(generatePassword()); setShowPassword(true); }} className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Gerar
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Mínimo 4 caracteres" required className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Data de Vencimento
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">{formExpirationDate ? formatDateDisplay(formExpirationDate) : 'Vitalício'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input type="date" value={formExpirationDate} onChange={e => setFormExpirationDate(e.target.value)} className="bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  {[30, 60, 90, 365].map(d => (
                    <button key={d} type="button" onClick={() => setExpirationDays(d, 'form')} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold border border-slate-700">+{d === 365 ? '1a' : `${d}d`}</button>
                  ))}
                  <button type="button" onClick={() => setFormExpirationDate('')} className="px-2.5 py-1.5 rounded-lg bg-purple-900/30 text-[11px] font-semibold text-purple-300 border border-purple-700/50">Vitalício</button>
                </div>
              </div>

              {!isRevenda && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Cargo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['UsuarioComum', 'AdminRevenda', 'AdminMaster'] as const).map(r => {
                      const labels = { UsuarioComum: 'Cliente', AdminRevenda: 'Revenda', AdminMaster: 'Master' };
                      const sel = formRole === r;
                      return (
                        <label key={r} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-sm ${sel ? 'bg-emerald-600/15 border-emerald-500/80 text-white' : 'bg-[#15151f] border-slate-700/80 text-slate-300'}`}>
                          <input type="radio" checked={sel} onChange={() => setFormRole(r)} />
                          <span>{labels[r]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2">
                <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5"><Tv className="w-3.5 h-3.5" /> Vincular Lista M3U (opcional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input type="text" value={formPlaylistName} onChange={e => setFormPlaylistName(e.target.value)} placeholder="Nome" className="bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500" />
                  <input type="url" value={formPlaylistUrl} onChange={e => setFormPlaylistUrl(e.target.value)} placeholder="https://..." className="sm:col-span-2 bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 font-mono" />
                </div>
              </div>

              <button type="submit" disabled={isSubmittingNewUser} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50">
                {isSubmittingNewUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> Cadastrar e Liberar</>}
              </button>
            </form>
          )}

          {/* SETTINGS */}
          {section === 'settings' && isMaster && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="p-5 rounded-2xl bg-[#0f0f17] border border-slate-800/60 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2"><Shield className="w-4 h-4 text-amber-400" /> Cadastros Públicos</h3>
                  <p className="text-xs text-slate-400 mt-1">Permite que novos usuários criem conta sozinhos pela tela de login.</p>
                </div>
                <button onClick={handleToggleRegistration} disabled={settingLoading} className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs uppercase border ${allowRegistration ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'}`}>
                  {allowRegistration ? 'Abertos' : 'Fechados'}
                </button>
              </div>
            </div>
          )}

          {/* LISTAS */}
          {(section === 'clients' || section === 'revendas' || section === 'admins') && (
            <div className="space-y-4">
              <div className="bg-[#0f0f17] border border-slate-800/60 rounded-2xl p-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar por nome, @login ou email..." className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-4 h-4" /></button>}
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-mono">{filteredUsers.length} de {users.length}</p>
              </div>

              {loading && users.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-slate-400 gap-3"><RefreshCw className="w-7 h-7 animate-spin text-red-500" /><span className="text-xs">Carregando...</span></div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-20 text-center bg-[#0f0f17] border border-slate-800/60 rounded-2xl">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                  <p className="text-sm text-slate-400">{searchQuery ? 'Nada encontrado' : 'Nenhum usuário nesta seção'}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredUsers.map(user => {
                    const role = normalizeUserRole(user.role);
                    const isMe = user.id === currentAdmin.id;
                    const isRunning = actionLoadingId === user.id;
                    const isPending = pendingDeleteId === user.id;
                    const expInfo = getExpirationInfo(user.expirationDate);
                    const canEdit = isMaster || (isRevenda && (role === 'UsuarioComum' || isMe));
                    const canDelete = !isMe && role !== 'AdminMaster' && (isMaster || (isRevenda && role === 'UsuarioComum'));
                    const canBlock = !isMe && role !== 'AdminMaster' && (isMaster || (isRevenda && role === 'UsuarioComum'));
                    const canRenew = role === 'UsuarioComum' || isMaster;

                    return (
                      <div key={user.id} className={`p-4 rounded-2xl border-l-4 border ${isPending ? 'bg-rose-950/40 border-rose-500/70 border-l-rose-500' : user.isBlocked ? 'bg-rose-950/20 border-rose-900/50 border-l-rose-600' : expInfo.isExpired ? 'bg-amber-950/15 border-amber-900/40 border-l-amber-500' : role === 'AdminMaster' ? 'bg-[#151515]/70 border-amber-500/30 border-l-amber-500' : role === 'AdminRevenda' ? 'bg-[#151520]/70 border-blue-500/30 border-l-blue-500' : 'bg-[#0f0f17] border-slate-800/80 border-l-emerald-500/60'}`}>
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shrink-0 border-2 ${user.isBlocked ? 'bg-rose-900/30 border-rose-700/50 text-rose-300' : role === 'AdminMaster' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : role === 'AdminRevenda' ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                              {role === 'AdminMaster' ? <Crown className="w-5 h-5" /> : role === 'AdminRevenda' ? <Briefcase className="w-5 h-5" /> : (user.name?.charAt(0).toUpperCase() || 'U')}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-sm truncate">{user.name}</span>
                                <span className="text-[11px] text-slate-400 font-mono">@{user.username}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${expInfo.isExpired ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : expInfo.isExpiring7 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : expInfo.status === 'vitalicio' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
                                  {expInfo.label}
                                </span>
                                {user.isBlocked && <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">Bloqueado</span>}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                                {user.email && <span className="truncate">{user.email}</span>}
                                {user.createdAt && <span className="text-[10px]">Cadastrado {new Date(user.createdAt).toLocaleDateString('pt-BR')}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {isPending ? (
                              <>
                                <button onClick={() => handleConfirmDelete(user)} disabled={isRunning} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white">
                                  {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  Sim
                                </button>
                                <button onClick={() => setPendingDeleteId(null)} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-700 text-slate-200">Não</button>
                              </>
                            ) : (
                              <>
                                {canRenew && <button onClick={() => handleQuickRenew(user, 30)} disabled={isRunning} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"><CalendarPlus className="w-3.5 h-3.5" /><span>+30d</span></button>}
                                {canEdit && <button onClick={() => handleOpenEdit(user)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40"><Pencil className="w-3.5 h-3.5" /><span>Editar</span></button>}
                                {canBlock && <button onClick={() => handleToggleBlock(user)} disabled={isRunning} className={`p-2 rounded-xl border ${user.isBlocked ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-600/20 text-rose-300 border-rose-500/40'}`}>{isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : user.isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}</button>}
                                {canDelete && <button onClick={() => setPendingDeleteId(user.id)} disabled={isRunning} className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 border border-slate-700/80"><Trash2 className="w-3.5 h-3.5" /></button>}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* EDIT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3">
          <form onSubmit={handleSaveEdit} className="w-full max-w-lg bg-[#0f0f17] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-950/40 to-[#0f0f17] border-b border-blue-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Pencil className="w-4 h-4 text-blue-400" />
                <div>
                  <h4 className="text-sm font-bold text-white">Editar</h4>
                  <span className="text-[11px] text-slate-400 font-mono">@{editingUser.username}</span>
                </div>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} className="p-1.5 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nome</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Login</label>
                  <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))} required className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white" />
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Vencimento</label>
                  <span className="text-[11px] font-mono text-emerald-300">{editExpirationDate ? formatDateDisplay(editExpirationDate) : 'Vitalício'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input type="date" value={editExpirationDate} onChange={e => setEditExpirationDate(e.target.value)} className="bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white" />
                  {[30, 60, 90, 365].map(d => <button key={d} type="button" onClick={() => setExpirationDays(d, 'edit')} className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] font-semibold border border-slate-700">+{d === 365 ? '1a' : `${d}d`}</button>)}
                  <button type="button" onClick={() => setEditExpirationDate('')} className="px-2 py-1 rounded-lg bg-purple-900/40 text-[11px] font-semibold text-purple-300">Vitalício</button>
                </div>
              </div>

              {isMaster && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Cargo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['UsuarioComum', 'AdminRevenda', 'AdminMaster'] as const).map(r => {
                      const labels = { UsuarioComum: 'Cliente', AdminRevenda: 'Revenda', AdminMaster: 'Master' };
                      const sel = editRole === r;
                      return (
                        <label key={r} className={`flex items-center gap-1.5 p-2 rounded-xl border cursor-pointer text-xs ${sel ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-[#15151f] border-slate-700/80 text-slate-300'}`}>
                          <input type="radio" checked={sel} onChange={() => setEditRole(r)} disabled={editingUser.id === currentAdmin.id} />
                          <span>{labels[r]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">Nova Senha</label>
                  <button type="button" onClick={() => { setEditPassword(generatePassword()); setEditShowPassword(true); }} className="text-[11px] text-blue-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Gerar</button>
                </div>
                <div className="relative">
                  <input type={editShowPassword ? 'text' : 'password'} value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Deixe vazio para manter" className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 pr-10 py-2 text-sm text-white font-mono" />
                  <button type="button" onClick={() => setEditShowPassword(!editShowPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{editShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>

              {editingUser.id !== currentAdmin.id && (
                <button type="button" onClick={() => setEditIsBlocked(!editIsBlocked)} className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-semibold ${editIsBlocked ? 'bg-rose-950/30 border-rose-500/50 text-rose-300' : 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'}`}>
                  <span>{editIsBlocked ? 'Bloqueada' : 'Ativa'}</span>
                  <span className="text-[10px] opacity-70">Clique para alternar</span>
                </button>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300">Cancelar</button>
                <button type="submit" disabled={isSavingEdit} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {isSavingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Salvar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
