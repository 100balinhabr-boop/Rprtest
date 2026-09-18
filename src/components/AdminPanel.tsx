import React, { useState, useEffect, useMemo } from 'react';
import { UserAccount } from '../types';
import {
  Users,
  X,
  Search,
  Lock,
  Unlock,
  Trash2,
  UserPlus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Shield,
  User as UserIcon,
  Calendar,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
  Pencil,
  Tv,
  Clock,
  Crown,
  Briefcase,
  CalendarPlus,
  AlertTriangle,
  StickyNote,
  UserCheck,
  UserX,
  TrendingUp,
  LayoutDashboard,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  Play,
  Menu,
  Home
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
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export const getExpirationInfo = (expirationDate?: string | null) => {
  if (!expirationDate || expirationDate === 'vitalicio') {
    return { status: 'vitalicio' as const, label: 'Vitalício', isExpired: false, daysLeft: Infinity, isExpiring7: false };
  }
  const exp = new Date(`${expirationDate.slice(0, 10)}T23:59:59`);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) {
    return { status: 'expired' as const, label: `Vencido (${formatDateDisplay(expirationDate)})`, isExpired: true, daysLeft, isExpiring7: false };
  }
  if (daysLeft <= 7) {
    return { status: 'warning' as const, label: `Vence em ${daysLeft}d`, isExpired: false, daysLeft, isExpiring7: true };
  }
  return { status: 'active' as const, label: `Válido até ${formatDateDisplay(expirationDate)}`, isExpired: false, daysLeft, isExpiring7: false };
};

type Section = 'dashboard' | 'clients' | 'revendas' | 'admins' | 'create' | 'settings';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentAdmin,
  onClose,
  onGoToPlayer,
}) => {
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [allowRegistration, setAllowRegistration] = useState<boolean>(true);
  const [settingLoading, setSettingLoading] = useState<boolean>(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  const currentAdminRole = normalizeUserRole(currentAdmin.role);
  const isMaster = currentAdminRole === 'AdminMaster';
  const isRevenda = currentAdminRole === 'AdminRevenda';

  // Form states
  const [formName, setFormName] = useState<string>('');
  const [formUsername, setFormUsername] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('');
  const [formRole, setFormRole] = useState<'UsuarioComum' | 'AdminRevenda' | 'AdminMaster'>('UsuarioComum');
  const [formExpirationDate, setFormExpirationDate] = useState<string>(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [formPlaylistUrl, setFormPlaylistUrl] = useState<string>('');
  const [formPlaylistName, setFormPlaylistName] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState<boolean>(false);
  const [lastCreatedUser, setLastCreatedUser] = useState<{ username: string; password: string; name: string; role: string; expirationDate: string | null } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState<boolean>(false);

  // Edit states
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editRole, setEditRole] = useState<'UsuarioComum' | 'AdminRevenda' | 'AdminMaster'>('UsuarioComum');
  const [editExpirationDate, setEditExpirationDate] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editPlaylistUrl, setEditPlaylistUrl] = useState<string>('');
  const [editPlaylistName, setEditPlaylistName] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editShowPassword, setEditShowPassword] = useState<boolean>(false);
  const [editIsBlocked, setEditIsBlocked] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const getAuthToken = () => {
    return localStorage.getItem('iptv_auth_token') || sessionStorage.getItem('iptv_auth_token') || '';
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        if (data.settings && typeof data.settings.allowPublicRegistration === 'boolean') {
          setAllowRegistration(data.settings.allowPublicRegistration);
        }
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao carregar lista de usuários.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro de comunicação ao carregar usuários.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    setFeedbackMsg(null);
    setPendingDeleteId(null);
  }, []);

  useEffect(() => {
    if (feedbackMsg) {
      const t = setTimeout(() => setFeedbackMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [feedbackMsg]);

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let generated = '';
    for (let i = 0; i < 8; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(generated);
    setShowPassword(true);
  };

  const handleSetFormExpirationDays = (days: number) => {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setFormExpirationDate(d.toISOString().split('T')[0]);
  };

  const handleSetEditExpirationDays = (days: number) => {
    let baseTime = Date.now();
    if (editExpirationDate) {
      const existing = new Date(`${editExpirationDate.slice(0, 10)}T23:59:59`).getTime();
      if (!isNaN(existing) && existing > Date.now()) {
        baseTime = existing;
      }
    }
    const d = new Date(baseTime + days * 24 * 60 * 60 * 1000);
    setEditExpirationDate(d.toISOString().split('T')[0]);
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    const cleanUsername = formUsername.trim().toLowerCase().replace(/\s+/g, '');
    if (cleanUsername.length < 3) {
      setFeedbackMsg({ type: 'error', text: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
      return;
    }
    if (formPassword.length < 4) {
      setFeedbackMsg({ type: 'error', text: 'A senha deve ter no mínimo 4 caracteres.' });
      return;
    }

    const assignedRole = isRevenda ? 'UsuarioComum' : formRole;

    setIsSubmittingNewUser(true);

    try {
      const token = getAuthToken();
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName.trim() || cleanUsername,
          username: cleanUsername,
          email: formEmail.trim() || undefined,
          password: formPassword,
          role: assignedRole,
          expirationDate: formExpirationDate ? formExpirationDate : null,
          playlistUrl: formPlaylistUrl.trim() || undefined,
          playlistName: formPlaylistName.trim() || undefined,
          notes: formNotes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.users) {
        setUsers(data.users);
        setLastCreatedUser({
          username: cleanUsername,
          password: formPassword,
          name: formName.trim() || cleanUsername,
          role: assignedRole,
          expirationDate: formExpirationDate || null,
        });
        setFeedbackMsg({
          type: 'success',
          text: `Usuário @${cleanUsername} (${assignedRole}) cadastrado com sucesso!`,
        });

        setFormName('');
        setFormUsername('');
        setFormEmail('');
        setFormPassword('');
        setFormRole('UsuarioComum');
        const defaultNextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setFormExpirationDate(defaultNextMonth);
        setFormPlaylistUrl('');
        setFormPlaylistName('');
        setFormNotes('');
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao cadastrar novo usuário.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha de comunicação ao cadastrar usuário.' });
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  const handleCopyLastCreated = () => {
    if (!lastCreatedUser) return;
    const expText = lastCreatedUser.expirationDate 
      ? formatDateDisplay(lastCreatedUser.expirationDate)
      : 'Vitalício / Sem Vencimento';
    const textToCopy = `🔐 *Acesso RPR TV*\n👤 Usuário: ${lastCreatedUser.username}\n🔑 Senha: ${lastCreatedUser.password}\n📅 Vencimento: ${expText}\n\nBaixe o app e faça login com esses dados.`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2500);
  };

  const handleCopyUserCredentials = (user: UserAccount) => {
    const expText = user.expirationDate 
      ? formatDateDisplay(user.expirationDate)
      : 'Vitalício';
    const textToCopy = `🔐 *Acesso RPR TV*\n👤 Usuário: ${user.username}\n🔑 Senha: (a que você definiu no cadastro)\n📅 Vencimento: ${expText}\n\nBaixe o app e faça login com esses dados.`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedUserId(user.id);
    setTimeout(() => setCopiedUserId(null), 2000);
  };

  const handleToggleBlock = async (user: UserAccount) => {
    const targetRole = normalizeUserRole(user.role);

    if (user.id === currentAdmin.id) {
      setFeedbackMsg({ type: 'error', text: 'Você não pode bloquear a sua própria conta.' });
      return;
    }
    if (targetRole === 'AdminMaster') {
      setFeedbackMsg({ type: 'error', text: 'Não é permitido bloquear a conta do AdminMaster.' });
      return;
    }
    if (isRevenda && targetRole !== 'UsuarioComum') {
      setFeedbackMsg({ type: 'error', text: 'AdminRevenda só tem permissão para gerenciar Usuários Comuns.' });
      return;
    }

    const actionName = user.isBlocked ? 'desbloquear' : 'bloquear';
    setActionLoadingId(user.id);
    setFeedbackMsg(null);

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/toggle-block`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
      });
      const data = await res.json();

      if (data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: data.message });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || `Erro ao ${actionName} usuário.` });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: `Falha ao tentar ${actionName} usuário.` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenEdit = (user: UserAccount) => {
    const targetRole = normalizeUserRole(user.role);
    if (isRevenda && targetRole !== 'UsuarioComum' && user.id !== currentAdmin.id) {
      setFeedbackMsg({ type: 'error', text: 'AdminRevenda não pode alterar contas de outros revendedores ou administradores.' });
      return;
    }
    setEditingUser(user);
    setEditName(user.name || '');
    setEditUsername(user.username || '');
    setEditEmail(user.email || '');
    setEditRole(targetRole);
    setEditExpirationDate(user.expirationDate ? user.expirationDate.slice(0, 10) : '');
    setEditIsBlocked(!!user.isBlocked);
    setEditPassword('');
    setEditPlaylistUrl(user.playlistUrl || '');
    setEditPlaylistName(user.playlistName || '');
    setEditNotes((user as any).notes || '');
    setEditShowPassword(false);
    setFeedbackMsg(null);
  };

  const handleGenerateEditPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let generated = '';
    for (let i = 0; i < 8; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEditPassword(generated);
    setEditShowPassword(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const cleanUsername = editUsername.trim().toLowerCase().replace(/\s+/g, '');
    if (cleanUsername.length < 3) {
      setFeedbackMsg({ type: 'error', text: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
      return;
    }
    if (editPassword && editPassword.trim().length > 0 && editPassword.trim().length < 4) {
      setFeedbackMsg({ type: 'error', text: 'A nova senha deve ter no mínimo 4 caracteres.' });
      return;
    }

    setIsSavingEdit(true);
    setFeedbackMsg(null);

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/users/${encodeURIComponent(editingUser.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          username: cleanUsername,
          email: editEmail.trim() || undefined,
          role: isMaster ? editRole : undefined,
          expirationDate: editExpirationDate ? editExpirationDate : 'vitalicio',
          password: editPassword.trim() || undefined,
          isBlocked: editIsBlocked,
          playlistUrl: editPlaylistUrl.trim() || undefined,
          playlistName: editPlaylistName.trim() || undefined,
          notes: editNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: data.message || 'Dados atualizados com sucesso!' });
        setEditingUser(null);
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao atualizar dados do usuário.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha de comunicação ao tentar salvar alterações.' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRequestDelete = (user: UserAccount) => {
    const targetRole = normalizeUserRole(user.role);
    if (user.id === currentAdmin.id) {
      setFeedbackMsg({ type: 'error', text: 'Você não pode excluir sua própria conta.' });
      return;
    }
    if (targetRole === 'AdminMaster') {
      setFeedbackMsg({ type: 'error', text: 'Não é permitido excluir o AdminMaster principal.' });
      return;
    }
    if (isRevenda && targetRole !== 'UsuarioComum') {
      setFeedbackMsg({ type: 'error', text: 'AdminRevenda não tem permissão para remover revendedores ou administradores.' });
      return;
    }
    setPendingDeleteId(user.id);
    setFeedbackMsg(null);
  };

  const handleConfirmDelete = async (user: UserAccount) => {
    setActionLoadingId(user.id);
    setFeedbackMsg(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: data.message || `Usuário @${user.username} excluído com sucesso.` });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao excluir usuário.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha ao tentar excluir usuário.' });
    } finally {
      setActionLoadingId(null);
      setPendingDeleteId(null);
    }
  };

  const handleQuickRenew = async (targetUser: UserAccount, days: number) => {
    setActionLoadingId(targetUser.id);
    setFeedbackMsg(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.id)}/renew`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: data.message });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao renovar vencimento do cliente.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha ao comunicar com o servidor para renovação.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleRegistration = async () => {
    const nextState = !allowRegistration;
    setSettingLoading(true);
    setFeedbackMsg(null);
    try {
      const token = getAuthToken();
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ allowPublicRegistration: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        setAllowRegistration(nextState);
        setFeedbackMsg({ type: 'success', text: data.message });
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao atualizar configurações.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha de comunicação ao atualizar configuração.' });
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
  const blockedUsersCount = users.filter((u) => u.isBlocked).length;
  const expiring7Users = users.filter(u => getExpirationInfo(u.expirationDate).isExpiring7).length;
  const activeClients = users.filter(u => {
    const role = normalizeUserRole(u.role);
    if (role !== 'UsuarioComum') return false;
    if (u.isBlocked) return false;
    if (getExpirationInfo(u.expirationDate).isExpired) return false;
    return true;
  }).length;

  // Recent users (5 últimos cadastrados)
  const recentUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [users]);

  // Lista filtrada pela seção + busca
  const filteredUsers = useMemo(() => {
    let list = users;

    if (section === 'clients') {
      list = list.filter(u => normalizeUserRole(u.role) === 'UsuarioComum');
    } else if (section === 'revendas') {
      list = list.filter(u => normalizeUserRole(u.role) === 'AdminRevenda');
    } else if (section === 'admins') {
      list = list.filter(u => normalizeUserRole(u.role) === 'AdminMaster');
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email ? u.email.toLowerCase().includes(q) : false) ||
      (u.createdBy ? u.createdBy.toLowerCase().includes(q) : false)
    );
  }, [users, section, searchQuery]);

  // Sidebar items
  const sidebarItems: Array<{ id: Section; label: string; icon: any; badge?: number; masterOnly?: boolean }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes', icon: Users, badge: clientUsers },
    { id: 'revendas', label: 'Revendas', icon: Briefcase, badge: revendaUsers },
    { id: 'admins', label: 'Admins Master', icon: Crown, badge: masterUsers, masterOnly: true },
    { id: 'create', label: 'Criar Usuário', icon: UserPlus },
    { id: 'settings', label: 'Configurações', icon: SettingsIcon, masterOnly: true },
  ];

  const visibleItems = sidebarItems.filter((item) => !item.masterOnly || isMaster);

  const sectionTitle = (() => {
    switch (section) {
      case 'dashboard': return 'Dashboard';
      case 'clients': return 'Clientes';
      case 'revendas': return 'Revendas';
      case 'admins': return 'Admins Master';
      case 'create': return 'Criar Usuário';
      case 'settings': return 'Configurações';
    }
  })();

  const sectionSubtitle = (() => {
    switch (section) {
      case 'dashboard': return 'Visão geral da sua operação em tempo real';
      case 'clients': return 'Todos os clientes finais cadastrados';
      case 'revendas': return 'Revendedores que gerenciam clientes';
      case 'admins': return 'Contas com acesso total ao sistema';
      case 'create': return 'Cadastre um novo usuário, revenda ou cliente';
      case 'settings': return 'Configurações gerais do aplicativo';
    }
  })();

  return (
    <div className="min-h-screen bg-[#08080c] text-slate-100 flex relative overflow-hidden">
      {/* Glow ambiente */}
      <div className="fixed -top-40 -left-40 w-[500px] h-[500px] bg-red-800/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed -bottom-40 -right-40 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[160px] pointer-events-none z-0" />

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-[#0b0b12] border-r border-red-900/30 flex flex-col z-50 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-red-900/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-700 to-red-500 flex items-center justify-center shadow-lg shadow-red-600/30 ring-1 ring-red-400/40 shrink-0">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-white text-base tracking-tight">RPR TV</h1>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-600/20 text-red-300 border border-red-500/40">
                  Painel
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                v2.4 • Master
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User card */}
        <div className="px-4 py-4 border-b border-red-900/20">
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${
            isMaster
              ? 'bg-gradient-to-br from-amber-950/40 to-[#0b0b12] border-amber-700/40'
              : 'bg-gradient-to-br from-blue-950/40 to-[#0b0b12] border-blue-700/40'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border-2 shadow-md ${
              isMaster
                ? 'bg-gradient-to-tr from-amber-600 to-amber-400 border-amber-400/60 text-white'
                : 'bg-gradient-to-tr from-blue-700 to-blue-500 border-blue-400/60 text-white'
            }`}>
              {currentAdmin.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">
                {currentAdmin.name}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                @{currentAdmin.username}
              </p>
            </div>
            {isMaster ? (
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Briefcase className="w-4 h-4 text-blue-400 shrink-0" />
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSection(item.id);
                  setSidebarOpen(false);
                  setSearchQuery('');
                  setPendingDeleteId(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-red-700/40 to-red-900/20 text-white border border-red-600/40 shadow-lg shadow-red-900/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-red-400' : ''}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-red-400" />}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-red-900/20 space-y-1">
          <button
            onClick={onGoToPlayer}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/50 transition cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Ir para o Player</span>
          </button>
          <button
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <main className="flex-1 min-w-0 relative z-10 flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#0b0b12]/95 backdrop-blur-md border-b border-red-900/20 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:text-white transition shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                  {sectionTitle}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  {sectionSubtitle}
                </p>
              </div>
            </div>

            <button
              onClick={fetchUsers}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/60 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-400' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

        {/* Feedback */}
        {feedbackMsg && (
          <div className={`mx-4 sm:mx-6 mt-4 p-3 rounded-xl text-xs flex items-center justify-between gap-3 border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-200 border-emerald-700/60'
              : 'bg-rose-950/80 text-rose-200 border-rose-700/60'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="opacity-70 hover:opacity-100 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scroll container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">

          {/* ============== DASHBOARD ============== */}
          {section === 'dashboard' && (
            <div className="space-y-6">
              {/* Cards grandes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <button
                  onClick={() => setSection('clients')}
                  className="group text-left p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-[#0f0f17] to-[#0b0b12] border border-emerald-800/40 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-900/20 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-emerald-400" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition" />
                  </div>
                  <p className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                    Clientes Ativos
                  </p>
                  <p className="text-4xl font-black text-white mt-1 tracking-tight">
                    {activeClients}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    De {clientUsers} clientes cadastrados
                  </p>
                </button>

                <button
                  onClick={() => setSection('clients')}
                  className="group text-left p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-[#0f0f17] to-[#0b0b12] border border-amber-800/40 hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-900/20 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-amber-400" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition" />
                  </div>
                  <p className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                    Vencendo em 7 dias
                  </p>
                  <p className={`text-4xl font-black mt-1 tracking-tight ${expiring7Users > 0 ? 'text-white' : 'text-slate-500'}`}>
                    {expiring7Users}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Renovar antes que expirem
                  </p>
                </button>

                <button
                  onClick={() => setSection('clients')}
                  className="group text-left p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-[#0f0f17] to-[#0b0b12] border border-rose-800/40 hover:border-rose-500/60 hover:shadow-lg hover:shadow-rose-900/20 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-rose-400" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-rose-400 group-hover:translate-x-1 transition" />
                  </div>
                  <p className="text-xs uppercase font-bold text-rose-400 tracking-wider">
                    Clientes Vencidos
                  </p>
                  <p className={`text-4xl font-black mt-1 tracking-tight ${expiredUsers > 0 ? 'text-white' : 'text-slate-500'}`}>
                    {expiredUsers}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Recuperar ou liberar
                  </p>
                </button>

                <button
                  onClick={() => setSection('revendas')}
                  className="group text-left p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-[#0f0f17] to-[#0b0b12] border border-blue-800/40 hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-900/20 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-blue-400" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition" />
                  </div>
                  <p className="text-xs uppercase font-bold text-blue-400 tracking-wider">
                    Revendedores
                  </p>
                  <p className="text-4xl font-black text-white mt-1 tracking-tight">
                    {revendaUsers}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Gerenciam clientes
                  </p>
                </button>

                {isMaster && (
                  <button
                    onClick={() => setSection('admins')}
                    className="group text-left p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-[#0f0f17] to-[#0b0b12] border border-amber-800/40 hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-900/20 transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                        <Crown className="w-6 h-6 text-amber-400" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition" />
                    </div>
                    <p className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                      Admins Master
                    </p>
                    <p className="text-4xl font-black text-white mt-1 tracking-tight">
                      {masterUsers}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Controle total
                    </p>
                  </button>
                )}

                <div className="text-left p-5 rounded-2xl bg-gradient-to-br from-slate-900/60 via-[#0f0f17] to-[#0b0b12] border border-slate-800/60">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-500/15 border border-slate-500/30 flex items-center justify-center">
                      <UserX className="w-6 h-6 text-slate-400" />
                    </div>
                  </div>
                  <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                    Bloqueados
                  </p>
                  <p className={`text-4xl font-black mt-1 tracking-tight ${blockedUsersCount > 0 ? 'text-white' : 'text-slate-500'}`}>
                    {blockedUsersCount}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Acesso revogado
                  </p>
                </div>
              </div>

              {/* Últimos cadastros */}
              <div className="bg-[#0f0f17] border border-slate-800/60 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-bold text-white">Últimos Cadastros</h3>
                  </div>
                  <button
                    onClick={() => setSection('clients')}
                    className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    Ver todos
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {recentUsers.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Nenhum cadastro ainda</p>
                    </div>
                  ) : (
                    recentUsers.map((user) => {
                      const role = normalizeUserRole(user.role);
                      const expInfo = getExpirationInfo(user.expirationDate);
                      return (
                        <div key={user.id} className="px-5 py-3 flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 border ${
                            role === 'AdminMaster'
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : role === 'AdminRevenda'
                              ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}>
                            {role === 'AdminMaster' ? <Crown className="w-4 h-4" /> : role === 'AdminRevenda' ? <Briefcase className="w-4 h-4" /> : (user.name?.charAt(0).toUpperCase() || 'U')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{user.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">@{user.username}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${
                            expInfo.isExpired
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                              : expInfo.isExpiring7
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          }`}>
                            {expInfo.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============== CREATE ============== */}
          {section === 'create' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-[#0f0f17] border border-emerald-800/40">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                  <span>
                    {isRevenda ? 'Cadastrar Novo Cliente' : 'Cadastrar Novo Usuário'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Defina o cargo, credenciais de acesso, data de vencimento e lista M3U.
                </p>
              </div>

              <form onSubmit={handleCreateUserSubmit} className="space-y-4 bg-[#0f0f17] border border-slate-800/60 rounded-2xl p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nome Completo ou Apelido
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: João Silva"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nome de Usuário (Login)
                    </label>
                    <div className="relative">
                      <span className="text-slate-400 font-mono text-sm absolute left-3 top-1/2 -translate-y-1/2">@</span>
                      <input
                        type="text"
                        placeholder="joaosilva"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      E-mail <span className="text-slate-500 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="cliente@email.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        Senha de Acesso
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer hover:underline"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Gerar Senha</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 4 caracteres"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Data de Vencimento</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formExpirationDate ? formatDateDisplay(formExpirationDate) : 'Vitalício'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="date"
                      value={formExpirationDate}
                      onChange={(e) => setFormExpirationDate(e.target.value)}
                      className="bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-1 flex-wrap">
                      {[30, 60, 90, 365].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleSetFormExpirationDays(d)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 transition"
                        >
                          +{d === 365 ? '1a' : `${d}d`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFormExpirationDate('')}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 text-[11px] font-semibold text-purple-300 border border-purple-700/50 transition"
                      >
                        Vitalício
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nível de Acesso
                  </label>
                  {isRevenda ? (
                    <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-start gap-2.5">
                      <Briefcase className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Usuário Comum (Cliente Final)</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Como <strong>AdminRevenda</strong>, todas as contas criadas por você são clientes finais.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {(['UsuarioComum', 'AdminRevenda', 'AdminMaster'] as const).map((r) => {
                        const conf = {
                          UsuarioComum: { icon: UserIcon, color: 'emerald', label: 'Cliente' },
                          AdminRevenda: { icon: Briefcase, color: 'blue', label: 'Revenda' },
                          AdminMaster: { icon: Crown, color: 'amber', label: 'Master' },
                        }[r];
                        const Icon = conf.icon;
                        const isSel = formRole === r;
                        return (
                          <label
                            key={r}
                            className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${
                              isSel
                                ? `bg-${conf.color}-600/15 border-${conf.color}-500/80 ring-1 ring-${conf.color}-500/40 text-white`
                                : 'bg-[#15151f] border-slate-700/80 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <input
                              type="radio"
                              name="form-role"
                              checked={isSel}
                              onChange={() => setFormRole(r)}
                              className="mt-0.5"
                            />
                            <div>
                              <div className="text-xs font-bold flex items-center gap-1">
                                <Icon className="w-3.5 h-3.5" />
                                <span>{conf.label}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2">
                  <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5" />
                    <span>Vincular Lista M3U</span>
                    <span className="text-[10px] text-slate-400 font-normal ml-auto">(Opcional)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Nome da lista"
                      value={formPlaylistName}
                      onChange={(e) => setFormPlaylistName(e.target.value)}
                      className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <input
                      type="url"
                      placeholder="https://exemplo.com/lista.m3u"
                      value={formPlaylistUrl}
                      onChange={(e) => setFormPlaylistUrl(e.target.value)}
                      className="w-full sm:col-span-2 bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-yellow-950/20 border border-yellow-800/40 space-y-2">
                  <label className="text-xs font-semibold text-yellow-300 flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5" />
                    <span>Anotações Internas</span>
                    <span className="text-[10px] text-yellow-500/70 font-normal">(só você vê)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Cliente pagou via PIX dia 15..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-[#15151f] border border-yellow-800/40 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingNewUser}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingNewUser ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Cadastrar e Liberar Acesso</span>
                    </>
                  )}
                </button>
              </form>

              {lastCreatedUser && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-[#0f0f17] border border-emerald-700/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      Dados do Usuário Cadastrado
                    </span>
                    <button
                      onClick={handleCopyLastCreated}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
                    >
                      {copiedCredentials ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-black/40 rounded-xl text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block text-[10px]">USUÁRIO:</span>
                      <span className="text-white font-bold">{lastCreatedUser.username}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">SENHA:</span>
                      <span className="text-emerald-300 font-bold">{lastCreatedUser.password}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">CARGO:</span>
                      <span className="text-blue-300 font-bold">{lastCreatedUser.role}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">VENCIMENTO:</span>
                      <span className="text-amber-300 font-bold">
                        {lastCreatedUser.expirationDate ? formatDateDisplay(lastCreatedUser.expirationDate) : 'Vitalício'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============== SETTINGS ============== */}
          {section === 'settings' && isMaster && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="p-5 rounded-2xl bg-[#0f0f17] border border-slate-800/60">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      Cadastros Públicos
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Permite que novos usuários criem conta sozinhos pela tela de login.
                    </p>
                  </div>
                  <button
                    onClick={handleToggleRegistration}
                    disabled={settingLoading}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase transition cursor-pointer border ${
                      allowRegistration
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {allowRegistration ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                        <span>Abertos</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-rose-400" />
                        <span>Fechados</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#0f0f17] border border-slate-800/60">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Segurança
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Sessões de usuários bloqueados são revogadas imediatamente. Todas as ações são registradas no backend.
                </p>
              </div>
            </div>
          )}

          {/* ============== LISTAS (clients / revendas / admins) ============== */}
          {(section === 'clients' || section === 'revendas' || section === 'admins') && (
            <div className="space-y-4">
              {/* Busca */}
              <div className="bg-[#0f0f17] border border-slate-800/60 rounded-2xl p-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, @login ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-mono">
                  {filteredUsers.length} de {users.length} usuários
                </p>
              </div>

              {/* Lista */}
              {loading && users.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-slate-400 gap-3">
                  <RefreshCw className="w-7 h-7 animate-spin text-red-500" />
                  <span className="text-xs">Carregando...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-20 text-center bg-[#0f0f17] border border-slate-800/60 rounded-2xl">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-center mb-3">
                    <Users className="w-7 h-7 text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">
                    {searchQuery ? `Nenhum usuário encontrado para "${searchQuery}"` : 'Nenhum usuário nesta seção'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredUsers.map((user) => {
                    const role = normalizeUserRole(user.role);
                    const isMe = user.id === currentAdmin.id;
                    const isActionRunning = actionLoadingId === user.id;
                    const isPendingDelete = pendingDeleteId === user.id;
                    const isCopied = copiedUserId === user.id;
                    const expInfo = getExpirationInfo(user.expirationDate);
                    const userNotes = (user as any).notes;

                    const canEdit = isMaster || (isRevenda && (role === 'UsuarioComum' || isMe));
                    const canDelete = !isMe && role !== 'AdminMaster' && (isMaster || (isRevenda && role === 'UsuarioComum'));
                    const canBlock = !isMe && role !== 'AdminMaster' && (isMaster || (isRevenda && role === 'UsuarioComum'));
                    const canRenew = role === 'UsuarioComum' || isMaster;

                    return (
                      <div
                        key={user.id}
                        className={`p-4 rounded-2xl border-l-4 border transition ${
                          isPendingDelete
                            ? 'bg-rose-950/40 border-rose-500/70 border-l-rose-500 ring-2 ring-rose-500/40'
                            : user.isBlocked
                            ? 'bg-rose-950/20 border-rose-900/50 border-l-rose-600'
                            : expInfo.isExpired
                            ? 'bg-amber-950/15 border-amber-900/40 border-l-amber-500'
                            : role === 'AdminMaster'
                            ? 'bg-[#151515]/70 border-amber-500/30 border-l-amber-500'
                            : role === 'AdminRevenda'
                            ? 'bg-[#151520]/70 border-blue-500/30 border-l-blue-500'
                            : 'bg-[#0f0f17] border-slate-800/80 border-l-emerald-500/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shrink-0 border-2 shadow-md ${
                              user.isBlocked
                                ? 'bg-rose-900/30 border-rose-700/50 text-rose-300'
                                : role === 'AdminMaster'
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : role === 'AdminRevenda'
                                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}>
                              {role === 'AdminMaster' ? <Crown className="w-5 h-5" /> :
                               role === 'AdminRevenda' ? <Briefcase className="w-5 h-5" /> :
                               (user.name?.charAt(0).toUpperCase() || 'U')}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-sm truncate">{user.name}</span>
                                <span className="text-[11px] text-slate-400 font-mono">@{user.username}</span>

                                {expInfo.status === 'vitalicio' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" /> Vitalício
                                  </span>
                                ) : expInfo.isExpired ? (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                                    <Clock className="w-2.5 h-2.5" /> {expInfo.label}
                                  </span>
                                ) : expInfo.isExpiring7 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" /> {expInfo.label}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5" /> {expInfo.label}
                                  </span>
                                )}

                                {user.isBlocked && (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5" /> Bloqueado
                                  </span>
                                )}

                                {user.playlistUrl && (
                                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-semibold flex items-center gap-1 max-w-[140px] truncate">
                                    <Tv className="w-2.5 h-2.5 shrink-0" />
                                    <span className="truncate">{user.playlistName || 'Lista'}</span>
                                  </span>
                                )}

                                {isMe && <span className="text-[10px] text-slate-500 italic">(Você)</span>}
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                                {user.email && <span className="truncate">{user.email}</span>}
                                {user.createdBy && (
                                  <span className="text-[10px] text-blue-300/80 bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-900/40">
                                    Criado por: @{user.createdBy}
                                  </span>
                                )}
                                {user.createdAt && (
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>

                              {userNotes && (
                                <div className="mt-1.5 text-[11px] text-yellow-200/90 bg-yellow-950/20 border border-yellow-900/40 rounded-lg px-2 py-1 flex items-start gap-1.5">
                                  <StickyNote className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />
                                  <span className="italic">{userNotes}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {isPendingDelete ? (
                              <>
                                <span className="text-[11px] text-rose-200 font-bold px-1">
                                  Excluir @{user.username}?
                                </span>
                                <button
                                  onClick={() => handleConfirmDelete(user)}
                                  disabled={isActionRunning}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition active:scale-95 disabled:opacity-50"
                                >
                                  {isActionRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  <span>Sim</span>
                                </button>
                                <button
                                  onClick={() => setPendingDeleteId(null)}
                                  disabled={isActionRunning}
                                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition"
                                >
                                  Não
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleCopyUserCredentials(user)}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                                    isCopied
                                      ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/60'
                                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                                  }`}
                                  title="Copiar credenciais"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span className="hidden sm:inline">{isCopied ? 'Copiado' : 'Credenciais'}</span>
                                </button>

                                {canRenew && (
                                  <button
                                    onClick={() => handleQuickRenew(user, 30)}
                                    disabled={isActionRunning}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition"
                                    title="Renovar +30 dias"
                                  >
                                    <CalendarPlus className="w-3.5 h-3.5" />
                                    <span>+30d</span>
                                  </button>
                                )}

                                {canEdit && (
                                  <button
                                    onClick={() => handleOpenEdit(user)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Editar</span>
                                  </button>
                                )}

                                {canBlock && (
                                  <button
                                    onClick={() => handleToggleBlock(user)}
                                    disabled={isActionRunning}
                                    className={`p-2 rounded-xl border transition ${
                                      user.isBlocked
                                        ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                                        : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/40'
                                    }`}
                                    title={user.isBlocked ? 'Desbloquear' : 'Bloquear'}
                                  >
                                    {isActionRunning ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : user.isBlocked ? (
                                      <Unlock className="w-3.5 h-3.5" />
                                    ) : (
                                      <Lock className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}

                                {canDelete && (
                                  <button
                                    onClick={() => handleRequestDelete(user)}
                                    disabled={isActionRunning}
                                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-500/40 transition"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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

      {/* ============== MODAL EDIT ============== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-[#0f0f17] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-950/40 to-[#0f0f17] border-b border-blue-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 border border-blue-400/60 text-white flex items-center justify-center shadow-md">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Editar Dados</h4>
                  <span className="text-[11px] text-slate-400 font-mono">@{editingUser.username}</span>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nome</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Login</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Vencimento</span>
                  </label>
                  <span className="text-[11px] font-mono text-emerald-300">
                    {editExpirationDate ? formatDateDisplay(editExpirationDate) : 'Vitalício'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="date"
                    value={editExpirationDate}
                    onChange={(e) => setEditExpirationDate(e.target.value)}
                    className="bg-[#15151f] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    {[30, 60, 90, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleSetEditExpirationDays(d)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700"
                      >
                        +{d === 365 ? '1a' : `${d}d`}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditExpirationDate('')}
                      className="px-2 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 text-[11px] font-semibold text-purple-300 border border-purple-700/50"
                    >
                      Vitalício
                    </button>
                  </div>
                </div>
              </div>

              {isMaster && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Cargo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['UsuarioComum', 'AdminRevenda', 'AdminMaster'] as const).map((r) => {
                      const label = { UsuarioComum: 'Cliente', AdminRevenda: 'Revenda', AdminMaster: 'Master' }[r];
                      const isSel = editRole === r;
                      return (
                        <label key={r} className={`flex items-center gap-1.5 p-2 rounded-xl border cursor-pointer text-xs ${isSel ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-[#15151f] border-slate-700/80 text-slate-300'}`}>
                          <input
                            type="radio"
                            name="edit-role"
                            checked={isSel}
                            onChange={() => setEditRole(r)}
                            disabled={editingUser.id === currentAdmin.id}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">Nova Senha</label>
                  <button
                    type="button"
                    onClick={handleGenerateEditPassword}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Gerar
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={editShowPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Deixe vazio para manter"
                    className="w-full bg-[#15151f] border border-slate-700/80 rounded-xl px-3 pr-10 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setEditShowPassword(!editShowPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {editShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-yellow-950/20 border border-yellow-800/40 space-y-2">
                <label className="text-xs font-semibold text-yellow-300 flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" />
                  <span>Anotações</span>
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-[#15151f] border border-yellow-800/40 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Salvar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
