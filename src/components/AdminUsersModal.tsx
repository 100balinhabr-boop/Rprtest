import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole } from '../types';
import { 
  Users, 
  X, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
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
  Key,
  Copy,
  Check,
  Mail,
  Pencil,
  Tv,
  Globe,
  Clock,
  Crown,
  Briefcase,
  CalendarPlus,
  AlertTriangle
} from 'lucide-react';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdmin: UserAccount;
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
    return { status: 'vitalicio' as const, label: 'Vitalício', isExpired: false, daysLeft: Infinity };
  }
  const exp = new Date(`${expirationDate.slice(0, 10)}T23:59:59`);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) {
    return { status: 'expired' as const, label: `Vencido (${formatDateDisplay(expirationDate)})`, isExpired: true, daysLeft };
  }
  if (daysLeft <= 5) {
    return { status: 'warning' as const, label: `Vence em ${daysLeft}d (${formatDateDisplay(expirationDate)})`, isExpired: false, daysLeft };
  }
  return { status: 'active' as const, label: `Válido até ${formatDateDisplay(expirationDate)}`, isExpired: false, daysLeft };
};

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  currentAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [filterRole, setFilterRole] = useState<'all' | 'UsuarioComum' | 'AdminRevenda' | 'AdminMaster' | 'expired'>('all');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [allowRegistration, setAllowRegistration] = useState<boolean>(true);
  const [settingLoading, setSettingLoading] = useState<boolean>(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const currentAdminRole = normalizeUserRole(currentAdmin.role);
  const isMaster = currentAdminRole === 'AdminMaster';
  const isRevenda = currentAdminRole === 'AdminRevenda';

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
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState<boolean>(false);
  const [lastCreatedUser, setLastCreatedUser] = useState<{ username: string; password: string; name: string; role: string; expirationDate: string | null } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState<boolean>(false);

  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editRole, setEditRole] = useState<'UsuarioComum' | 'AdminRevenda' | 'AdminMaster'>('UsuarioComum');
  const [editExpirationDate, setEditExpirationDate] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editPlaylistUrl, setEditPlaylistUrl] = useState<string>('');
  const [editPlaylistName, setEditPlaylistName] = useState<string>('');
  const [editShowPassword, setEditShowPassword] = useState<boolean>(false);
  const [editIsBlocked, setEditIsBlocked] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [renewingUser, setRenewingUser] = useState<UserAccount | null>(null);
  const [renewCustomDate, setRenewCustomDate] = useState<string>('');
  const [isRenewing, setIsRenewing] = useState<boolean>(false);

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
    if (isOpen) {
      fetchUsers();
      setFeedbackMsg(null);
      setPendingDeleteId(null);
    }
  }, [isOpen]);

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
    const textToCopy = `🔐 *Acesso IPTV Player*\n👤 Usuário: ${lastCreatedUser.username}\n🔑 Senha: ${lastCreatedUser.password}\n📅 Vencimento: ${expText}\nCargo: ${lastCreatedUser.role}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2500);
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
      setFeedbackMsg({ 
        type: 'error', 
        text: 'AdminRevenda não tem permissão para remover revendedores ou administradores.' 
      });
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

  const handleQuickRenew = async (targetUser: UserAccount, days: number, customDate?: string) => {
    setActionLoadingId(targetUser.id);
    setIsRenewing(true);
    setFeedbackMsg(null);

    try {
      const token = getAuthToken();
      const payload = customDate !== undefined 
        ? { newExpirationDate: customDate }
        : { days };

      const res = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.id)}/renew`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: data.message });
        setRenewingUser(null);
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao renovar vencimento do cliente.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha ao comunicar com o servidor para renovação.' });
    } finally {
      setActionLoadingId(null);
      setIsRenewing(false);
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

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const role = normalizeUserRole(u.role);
    const expInfo = getExpirationInfo(u.expirationDate);

    if (filterRole === 'UsuarioComum' && role !== 'UsuarioComum') return false;
    if (filterRole === 'AdminRevenda' && role !== 'AdminRevenda') return false;
    if (filterRole === 'AdminMaster' && role !== 'AdminMaster') return false;
    if (filterRole === 'expired' && !expInfo.isExpired) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email ? u.email.toLowerCase().includes(q) : false) ||
      (u.createdBy ? u.createdBy.toLowerCase().includes(q) : false)
    );
  });

  const totalUsers = users.length;
  const clientUsers = users.filter(u => normalizeUserRole(u.role) === 'UsuarioComum').length;
  const revendaUsers = users.filter(u => normalizeUserRole(u.role) === 'AdminRevenda').length;
  const masterUsers = users.filter(u => normalizeUserRole(u.role) === 'AdminMaster').length;
  const expiredUsers = users.filter(u => getExpirationInfo(u.expirationDate).isExpired).length;
  const blockedUsersCount = users.filter((u) => u.isBlocked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="admin-users-modal"
        className="w-full max-w-4xl bg-[#0C1222] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        <div className="px-5 py-3.5 bg-[#111A2E] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
              isMaster 
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-amber-500/10'
                : 'bg-blue-600/20 border border-blue-500/40 text-blue-400 shadow-blue-500/10'
            }`}>
              {isMaster ? <Crown className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Painel de Gestão • IPTV Pro
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  isMaster
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : isRevenda
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {isMaster ? 'Admin Master' : isRevenda ? 'Admin Revenda' : 'Usuário Comum'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isMaster 
                  ? 'Controle total: gerencie revendedores, clientes e datas de vencimento.'
                  : isRevenda
                  ? 'Gestão de revenda: adicione clientes e controle as datas de validade.'
                  : 'Detalhes da conta e vencimento do acesso.'}
              </p>
            </div>
          </div>
          <button
            id="close-admin-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`px-5 py-2 text-xs flex items-center justify-between border-b ${
          isMaster
            ? 'bg-amber-950/30 text-amber-200 border-amber-800/40'
            : isRevenda
            ? 'bg-blue-950/30 text-blue-200 border-blue-800/40'
            : 'bg-slate-900 text-slate-300 border-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isMaster 
                ? 'Você possui autoridade de AdminMaster: pode adicionar ou remover revendedores e clientes livremente.'
                : isRevenda
                ? 'Você está no modo AdminRevenda: permissão concedida exclusivamente para gerenciar Usuários Comuns (Clientes).'
                : 'Sua conta é de Usuário Comum. O painel de gestão requer acesso AdminMaster ou AdminRevenda.'}
            </span>
          </div>

          {isMaster ? (
            <div className="flex items-center gap-2 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-700/60">
              <span className="text-slate-300 font-medium text-[10px]">
                Cadastros Públicos:
              </span>
              <button
                id="toggle-registration-btn"
                onClick={handleToggleRegistration}
                disabled={settingLoading}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-bold text-[9px] uppercase transition cursor-pointer ${
                  allowRegistration
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
                title="Ativar ou desativar tela de cadastro aberta no app"
              >
                {allowRegistration ? (
                  <>
                    <ToggleRight className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Abertos</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-3.5 h-3.5 text-rose-400" />
                    <span>Fechados</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 font-mono">
              Revendedor: @{currentAdmin.username}
            </span>
          )}
        </div>

        <div className="px-5 bg-[#0E1628] border-b border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              id="admin-tab-list"
              type="button"
              onClick={() => {
                setActiveTab('list');
                setFeedbackMsg(null);
                setPendingDeleteId(null);
              }}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === 'list'
                  ? 'border-blue-500 text-white bg-blue-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 text-blue-400" />
              <span>Lista de Usuários</span>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 font-mono">
                {totalUsers}
              </span>
            </button>

            <button
              id="admin-tab-create"
              type="button"
              onClick={() => {
                setActiveTab('create');
                setFeedbackMsg(null);
              }}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === 'create'
                  ? 'border-emerald-500 text-white bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>{isRevenda ? '+ Novo Cliente' : '+ Criar Novo Usuário'}</span>
            </button>
          </div>

          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>

        {feedbackMsg && (
          <div className={`px-5 py-2.5 text-xs flex items-center justify-between border-b transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-200 border-emerald-800/80'
              : 'bg-rose-950/80 text-rose-200 border-rose-800/80'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-[#0B1120] border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="admin-search-users-input"
                  type="text"
                  placeholder="Buscar por nome, @login ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#162035] border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 custom-scrollbar">
                <button
                  onClick={() => setFilterRole('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                    filterRole === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({totalUsers})
                </button>

                <button
                  onClick={() => setFilterRole('UsuarioComum')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                    filterRole === 'UsuarioComum'
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Clientes ({clientUsers})
                </button>

                <button
                  onClick={() => setFilterRole('AdminRevenda')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                    filterRole === 'AdminRevenda'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Revendas ({revendaUsers})
                </button>

                {isMaster && (
                  <button
                    onClick={() => setFilterRole('AdminMaster')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                      filterRole === 'AdminMaster'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Masters ({masterUsers})
                  </button>
                )}

                <button
                  onClick={() => setFilterRole('expired')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                    filterRole === 'expired'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-rose-400 hover:text-rose-300'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  Vencidos ({expiredUsers})
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
              {loading && users.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="text-xs">Carregando usuários do sistema...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs">
                    {searchQuery ? `Nenhum usuário encontrado para "${searchQuery}".` : 'Nenhum usuário cadastrado nesta categoria.'}
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{isRevenda ? 'Cadastrar Novo Cliente' : 'Criar Novo Usuário'}</span>
                  </button>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const role = normalizeUserRole(user.role);
                  const isMe = user.id === currentAdmin.id;
                  const isActionRunning = actionLoadingId === user.id;
                  const isPendingDelete = pendingDeleteId === user.id;
                  const expInfo = getExpirationInfo(user.expirationDate);

                  const canEdit = isMaster || (isRevenda && (role === 'UsuarioComum' || isMe));
                  const canDelete = !isMe && role !== 'AdminMaster' && (isMaster || (isRevenda && role === 'UsuarioComum'));
                  const canBlock = !isMe && role !== 'AdminMaster' && (isMaster || (isRevenda && role === 'UsuarioComum'));
                  const canRenew = role === 'UsuarioComum' || isMaster;

                  return (
                    <div
                      key={user.id}
                      id={`user-row-${user.id}`}
                      className={`p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                        isPendingDelete
                          ? 'bg-rose-950/40 border-rose-500/70 ring-2 ring-rose-500/40'
                          : user.isBlocked
                          ? 'bg-rose-950/20 border-rose-900/50'
                          : expInfo.isExpired
                          ? 'bg-amber-950/15 border-amber-900/40'
                          : role === 'AdminMaster'
                          ? 'bg-[#151D33] border-amber-500/30'
                          : role === 'AdminRevenda'
                          ? 'bg-[#121B32] border-blue-500/30'
                          : 'bg-[#121A30] border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                          user.isBlocked
                            ? 'bg-rose-900/30 border-rose-700/50 text-rose-300'
                            : role === 'AdminMaster'
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : role === 'AdminRevenda'
                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}>
                          {role === 'AdminMaster' ? (
                            <Crown className="w-5 h-5" />
                          ) : role === 'AdminRevenda' ? (
                            <Briefcase className="w-4 h-4" />
                          ) : (
                            user.name ? user.name.charAt(0).toUpperCase() : 'U'
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-xs truncate">
                              {user.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              @{user.username}
                            </span>

                            {role === 'AdminMaster' && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                                <Crown className="w-2.5 h-2.5" />
                                Admin Master
                              </span>
                            )}

                            {role === 'AdminRevenda' && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold flex items-center gap-1">
                                <Briefcase className="w-2.5 h-2.5" />
                                Admin Revenda
                              </span>
                            )}

                            {role === 'UsuarioComum' && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50 text-[10px] font-semibold flex items-center gap-1">
                                <UserIcon className="w-2.5 h-2.5 text-slate-400" />
                                Cliente
                              </span>
                            )}

                            {expInfo.status === 'vitalicio' ? (
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                Vitalício
                              </span>
                            ) : expInfo.isExpired ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                                <Clock className="w-2.5 h-2.5" />
                                {expInfo.label}
                              </span>
                            ) : expInfo.status === 'warning' ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {expInfo.label}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                {expInfo.label}
                              </span>
                            )}

                            {user.isBlocked && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                Bloqueado
                              </span>
                            )}

                            {user.playlistUrl && (
                              <span
                                className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-semibold flex items-center gap-1 max-w-[140px] truncate"
                                title={`Lista vinculada: ${user.playlistName || user.playlistUrl}`}
                              >
                                <Tv className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{user.playlistName || 'Lista IPTV'}</span>
                              </span>
                            )}

                            {isMe && (
                              <span className="text-[10px] text-slate-500 italic">
                                (Você)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                            {user.email && <span>{user.email}</span>}
                            {user.createdBy && (
                              <span className="text-[10px] text-blue-300/80 bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-900/40">
                                Criado por: @{user.createdBy}
                              </span>
                            )}
                            {user.createdAt && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Calendar className="w-3 h-3" />
                                Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {isPendingDelete ? (
                          <>
                            <span className="text-[11px] text-rose-200 font-bold px-1">
                              Excluir @{user.username}?
                            </span>
                            <button
                              id={`confirm-delete-${user.id}`}
                              onClick={() => handleConfirmDelete(user)}
                              disabled={isActionRunning}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                              {isActionRunning ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>Sim, excluir</span>
                            </button>
                            <button
                              id={`cancel-delete-${user.id}`}
                              onClick={() => setPendingDeleteId(null)}
                              disabled={isActionRunning}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            {canRenew && (
                              <button
                                id={`quick-renew-${user.id}`}
                                onClick={() => handleQuickRenew(user, 30)}
                                disabled={isActionRunning}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition cursor-pointer"
                                title="Renovar +30 dias de acesso"
                              >
                                <CalendarPlus className="w-3.5 h-3.5 text-emerald-400" />
                                <span>+30d</span>
                              </button>
                            )}

                            {canEdit ? (
                              <button
                                id={`edit-user-${user.id}`}
                                onClick={() => handleOpenEdit(user)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition cursor-pointer"
                                title="Editar dados, validade e senha"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Editar</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 px-2 py-1 bg-slate-900/50 rounded-lg border border-slate-800">
                                Sem Permissão
                              </span>
                            )}

                            {canBlock && (
                              <button
                                id={`toggle-block-${user.id}`}
                                onClick={() => handleToggleBlock(user)}
                                disabled={isActionRunning}
                                className={`p-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                  user.isBlocked
                                    ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                                    : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/40'
                                }`}
                                title={user.isBlocked ? 'Desbloquear acesso' : 'Bloquear acesso do usuário'}
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
                                id={`delete-user-${user.id}`}
                                onClick={() => handleRequestDelete(user)}
                                disabled={isActionRunning}
                                className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-500/40 transition cursor-pointer"
                                title={role === 'AdminRevenda' ? 'Excluir Revendedor (Apenas Master)' : 'Excluir conta definitivamente'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="p-4 rounded-xl bg-[#0E1628] border border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>
                    {isRevenda ? 'Cadastrar Novo Cliente (Usuário Comum)' : 'Cadastrar Novo Usuário ou Revendedor'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Defina o cargo, credenciais de acesso, data de validade/vencimento e lista M3U.
                </p>
              </div>

              <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nome Completo ou Apelido
                    </label>
                    <input
                      id="admin-create-name"
                      type="text"
                      placeholder="Ex: João Silva"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-[#162035] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nome de Usuário (Login)
                    </label>
                    <div className="relative">
                      <span className="text-slate-400 font-mono text-xs absolute left-3 top-1/2 -translate-y-1/2">@</span>
                      <input
                        id="admin-create-username"
                        type="text"
                        placeholder="joaosilva"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className="w-full bg-[#162035] border border-slate-700/80 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
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
                      id="admin-create-email"
                      type="email"
                      placeholder="cliente@email.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-[#162035] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer hover:underline"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Gerar Senha</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="admin-create-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 4 caracteres"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full bg-[#162035] border border-slate-700/80 rounded-xl px-3 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                        title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-700/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Data de Vencimento do Cliente</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {formExpirationDate ? formatDateDisplay(formExpirationDate) : 'Vitalício'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      id="admin-create-expiration"
                      type="date"
                      value={formExpirationDate}
                      onChange={(e) => setFormExpirationDate(e.target.value)}
                      className="bg-[#162035] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />

                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSetFormExpirationDays(30)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
                      >
                        +30 dias
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFormExpirationDays(60)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
                      >
                        +60 dias
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFormExpirationDays(90)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
                      >
                        +90 dias
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFormExpirationDays(365)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
                      >
                        +1 Ano
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormExpirationDate('')}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-900/30 hover:bg-purple-900/50 text-[11px] font-semibold text-purple-300 border border-purple-700/50 transition cursor-pointer"
                      >
                        Vitalício
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Após essa data, o cliente não conseguirá mais efetuar login ou carregar os canais até que sua conta seja renovada.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nível de Acesso (Cargo no Sistema)
                  </label>

                  {isRevenda ? (
                    <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-start gap-2.5">
                      <Briefcase className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">Usuário Comum (Cliente Final)</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Como <strong>AdminRevenda</strong>, todas as contas cadastradas por você são clientes finais. Apenas o AdminMaster tem permissão para cadastrar ou remover outros revendedores.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${
                        formRole === 'UsuarioComum'
                          ? 'bg-slate-700/40 border-emerald-500/80 ring-1 ring-emerald-500/40 text-white'
                          : 'bg-[#162035] border-slate-700/80 text-slate-300 hover:border-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="user-role"
                          checked={formRole === 'UsuarioComum'}
                          onChange={() => setFormRole('UsuarioComum')}
                          className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Usuário Comum</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Cliente final com player e canais ao vivo.
                          </div>
                        </div>
                      </label>

                      <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${
                        formRole === 'AdminRevenda'
                          ? 'bg-blue-600/15 border-blue-500/80 ring-1 ring-blue-500/40 text-white'
                          : 'bg-[#162035] border-slate-700/80 text-slate-300 hover:border-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="user-role"
                          checked={formRole === 'AdminRevenda'}
                          onChange={() => setFormRole('AdminRevenda')}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                            <span>Admin Revenda</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Pode adicionar e gerenciar clientes comuns.
                          </div>
                        </div>
                      </label>

                      <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${
                        formRole === 'AdminMaster'
                          ? 'bg-amber-600/15 border-amber-500/80 ring-1 ring-amber-500/40 text-white'
                          : 'bg-[#162035] border-slate-700/80 text-slate-300 hover:border-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="user-role"
                          checked={formRole === 'AdminMaster'}
                          onChange={() => setFormRole('AdminMaster')}
                          className="mt-0.5 text-amber-500 focus:ring-amber-500"
                        />
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            <span>Admin Master</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Conta principal com controle irrestrito.
                          </div>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Vincular Lista M3U ao Cliente</span>
                    </label>
                    <span className="text-[10px] text-slate-400">(Opcional)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-1">
                      <input
                        id="admin-create-playlist-name"
                        type="text"
                        placeholder="Nome (ex: Canais VIP)"
                        value={formPlaylistName}
                        onChange={(e) => setFormPlaylistName(e.target.value)}
                        className="w-full bg-[#162035] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        id="admin-create-playlist-url"
                        type="url"
                        placeholder="https://exemplo.com/lista.m3u"
                        value={formPlaylistUrl}
                        onChange={(e) => setFormPlaylistUrl(e.target.value)}
                        className="w-full bg-[#162035] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                <button
                  id="admin-submit-create-user"
                  type="submit"
                  disabled={isSubmittingNewUser}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
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
                <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      Dados do Usuário Cadastrado
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLastCreated}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                      {copiedCredentials ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Acesso para Cliente</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-black/40 rounded-lg text-xs font-mono text-slate-300">
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
                  <div className="text-right">
                    <button
                      onClick={() => setActiveTab('list')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline cursor-pointer"
                    >
                      Ver na lista de usuários →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-5 py-3 bg-[#111A2E] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <p className="text-[11px]">
            {isMaster 
              ? 'Painel Master: Controle hierárquico ativo com bloqueio instantâneo e revogação de tokens.'
              : 'Painel Revenda: Gerencie a validade e acesso dos seus clientes com agilidade.'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition cursor-pointer"
          >
            Fechar
          </button>
        </div>

        {editingUser && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="w-full max-w-lg bg-[#0F172A] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 py-3.5 bg-[#14203A] border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Editar Dados & Validade</h4>
                    <span className="text-[11px] text-slate-400 font-mono">@{editingUser.username}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nome Completo
                    </label>
                    <input
                      id="edit-user-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[#1A2642] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nome de Usuário (Login)
                    </label>
                    <div className="relative">
                      <span className="text-slate-400 font-mono text-xs absolute left-3 top-1/2 -translate-y-1/2">@</span>
                      <input
                        id="edit-user-username"
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className="w-full bg-[#1A2642] border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    E-mail <span className="text-slate-500 font-normal">(opcional)</span>
                  </label>
                  <input
                    id="edit-user-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full bg-[#1A2642] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>Alterar Data de Vencimento do Cliente</span>
                    </label>
                    <span className="text-[11px] font-mono text-emerald-300">
                      {editExpirationDate ? formatDateDisplay(editExpirationDate) : 'Vitalício'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      id="edit-user-expiration"
                      type="date"
                      value={editExpirationDate}
                      onChange={(e) => setEditExpirationDate(e.target.value)}
                      className="bg-[#1A2642] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />

                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSetEditExpirationDays(30)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                        title="Adicionar 30 dias"
                      >
                        +30d
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetEditExpirationDays(60)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                        title="Adicionar 60 dias"
                      >
                        +60d
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetEditExpirationDays(90)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                        title="Adicionar 90 dias"
                      >
                        +90d
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetEditExpirationDays(365)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 cursor-pointer"
                        title="Adicionar 1 ano"
                      >
                        +1a
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditExpirationDate('')}
                        className="px-2 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 text-[11px] font-semibold text-purple-300 border border-purple-700/50 cursor-pointer"
                        title="Remover data e deixar vitalício"
                      >
                        Vitalício
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Cargo / Nível de Acesso
                  </label>

                  {isMaster ? (
                    <div className="grid grid-cols-3 gap-2">
                      <label className={`flex items-center gap-1.5 p-2 rounded-xl border cursor-pointer ${
                        editRole === 'UsuarioComum' ? 'bg-slate-700/40 border-emerald-500 text-white' : 'bg-[#1A2642] border-slate-700/80 text-slate-300'
                      }`}>
                        <input
                          type="radio"
                          name="edit-role"
                          checked={editRole === 'UsuarioComum'}
                          onChange={() => setEditRole('UsuarioComum')}
                          disabled={editingUser.id === currentAdmin.id}
                        />
                        <span className="text-xs">Cliente</span>
                      </label>

                      <label className={`flex items-center gap-1.5 p-2 rounded-xl border cursor-pointer ${
                        editRole === 'AdminRevenda' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-[#1A2642] border-slate-700/80 text-slate-300'
                      }`}>
                        <input
                          type="radio"
                          name="edit-role"
                          checked={editRole === 'AdminRevenda'}
                          onChange={() => setEditRole('AdminRevenda')}
                          disabled={editingUser.id === currentAdmin.id}
                        />
                        <span className="text-xs">Revenda</span>
                      </label>

                      <label className={`flex items-center gap-1.5 p-2 rounded-xl border cursor-pointer ${
                        editRole === 'AdminMaster' ? 'bg-amber-600/20 border-amber-500 text-white' : 'bg-[#1A2642] border-slate-700/80 text-slate-300'
                      }`}>
                        <input
                          type="radio"
                          name="edit-role"
                          checked={editRole === 'AdminMaster'}
                          onChange={() => setEditRole('AdminMaster')}
                          disabled={editingUser.id === currentAdmin.id}
                        />
                        <span className="text-xs">Master</span>
                      </label>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 flex items-center justify-between">
                      <span>Cargo Atual: <strong>{normalizeUserRole(editingUser.role)}</strong></span>
                      <span className="text-[10px] text-slate-500">Alteração exclusiva do AdminMaster</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Redefinir Senha <span className="text-slate-500 font-normal">(deixe vazio para manter a atual)</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateEditPassword}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Gerar Senha</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="edit-user-password"
                      type={editShowPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Digite uma nova senha (mínimo 4 caracteres)"
                      className="w-full bg-[#1A2642] border border-slate-700/80 rounded-xl px-3 pr-10 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setEditShowPassword(!editShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                      title={editShowPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {editShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Lista M3U Vinculada</span>
                    </label>
                    {editPlaylistUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPlaylistUrl('');
                          setEditPlaylistName('');
                        }}
                        className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                      >
                        Desvincular Lista
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-1">
                      <input
                        id="edit-user-playlist-name"
                        type="text"
                        placeholder="Nome da Lista"
                        value={editPlaylistName}
                        onChange={(e) => setEditPlaylistName(e.target.value)}
                        className="w-full bg-[#1A2642] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        id="edit-user-playlist-url"
                        type="url"
                        placeholder="https://exemplo.com/lista.m3u"
                        value={editPlaylistUrl}
                        onChange={(e) => setEditPlaylistUrl(e.target.value)}
                        className="w-full bg-[#1A2642] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                {editingUser.id !== currentAdmin.id && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Status de Acesso
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditIsBlocked(!editIsBlocked)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        editIsBlocked
                          ? 'bg-rose-950/30 border-rose-500/50 text-rose-300'
                          : 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {editIsBlocked ? <Lock className="w-4 h-4 text-rose-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        <span>{editIsBlocked ? 'Conta Bloqueada' : 'Conta Ativa e Liberada'}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10">
                        {editIsBlocked ? 'Clique para desbloquear' : 'Clique para bloquear'}
                      </span>
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    id="save-edit-user-btn"
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEdit ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
