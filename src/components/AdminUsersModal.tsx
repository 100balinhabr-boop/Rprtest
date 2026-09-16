import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
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
  Pencil
} from 'lucide-react';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdmin: UserAccount;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  currentAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [allowRegistration, setAllowRegistration] = useState<boolean>(true);
  const [settingLoading, setSettingLoading] = useState<boolean>(false);

  // Form states for Create User
  const [formName, setFormName] = useState<string>('');
  const [formUsername, setFormUsername] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('');
  const [formRole, setFormRole] = useState<'user' | 'admin'>('user');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState<boolean>(false);
  const [lastCreatedUser, setLastCreatedUser] = useState<{ username: string; password: string; name: string } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState<boolean>(false);

  // States for Edit User
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editShowPassword, setEditShowPassword] = useState<boolean>(false);
  const [editIsBlocked, setEditIsBlocked] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // State for in-app delete confirmation modal
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);

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
          role: formRole,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.users) {
        setUsers(data.users);
        setLastCreatedUser({
          username: cleanUsername,
          password: formPassword,
          name: formName.trim() || cleanUsername,
        });
        setFeedbackMsg({
          type: 'success',
          text: `Usuário @${cleanUsername} cadastrado com sucesso! As credenciais estão prontas para envio.`,
        });

        // Reset form inputs
        setFormName('');
        setFormUsername('');
        setFormEmail('');
        setFormPassword('');
        setFormRole('user');
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
    const textToCopy = `Acesso IPTV Player:\nUsuário: ${lastCreatedUser.username}\nSenha: ${lastCreatedUser.password}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2500);
  };

  const handleToggleBlock = async (user: UserAccount) => {
    if (user.id === currentAdmin.id) {
      setFeedbackMsg({ type: 'error', text: 'Você não pode bloquear a sua própria conta.' });
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
    setEditingUser(user);
    setEditName(user.name || '');
    setEditUsername(user.username || '');
    setEditEmail(user.email || '');
    setEditRole(user.role);
    setEditIsBlocked(!!user.isBlocked);
    setEditPassword('');
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
          role: editRole,
          password: editPassword.trim() || undefined,
          isBlocked: editIsBlocked,
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

  const handleDeleteUser = (user: UserAccount) => {
    if (user.id === currentAdmin.id) {
      setFeedbackMsg({ type: 'error', text: 'Você não pode excluir sua própria conta de administrador.' });
      return;
    }
    setUserToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    const target = userToDelete;

    setActionLoadingId(target.id);
    setFeedbackMsg(null);

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/users/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success && data.users) {
        setUsers(data.users);
        setFeedbackMsg({ type: 'success', text: data.message || `Usuário @${target.username} excluído com sucesso.` });
        setUserToDelete(null);
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Erro ao excluir usuário.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Falha ao tentar excluir usuário.' });
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

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email ? u.email.toLowerCase().includes(q) : false)
    );
  });

  const totalUsers = users.length;
  const blockedUsersCount = users.filter((u) => u.isBlocked).length;
  const activeUsersCount = totalUsers - blockedUsersCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="admin-users-modal"
        className="w-full max-w-3xl bg-[#0C1222] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#111A2E] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shadow-md shadow-blue-500/10">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Painel do Administrador • Gestão de Usuários
              </h2>
              <p className="text-xs text-slate-400">
                Cadastre novos usuários, bloqueie acessos não autorizados e gerencie credenciais.
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

        {/* Navigation Tabs: List Users vs Create User */}
        <div className="px-6 bg-[#0E1628] border-b border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              id="admin-tab-list"
              type="button"
              onClick={() => {
                setActiveTab('list');
                setFeedbackMsg(null);
              }}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === 'list'
                  ? 'border-blue-500 text-white bg-blue-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 text-blue-400" />
              <span>Usuários Cadastrados</span>
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
                  ? 'border-blue-500 text-white bg-blue-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>+ Criar Novo Usuário</span>
            </button>
          </div>

          {/* Registration Lock Toggle */}
          <div className="hidden sm:flex items-center gap-2 bg-[#141F36] px-3 py-1 rounded-xl border border-slate-700/60 my-1.5">
            <span className="text-slate-300 font-medium text-[11px]">
              Cadastros Públicos:
            </span>
            <button
              id="toggle-registration-btn"
              onClick={handleToggleRegistration}
              disabled={settingLoading}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-[10px] uppercase transition cursor-pointer ${
                allowRegistration
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
              }`}
              title="Clique para ativar ou suspender novos cadastros livres"
            >
              {allowRegistration ? (
                <>
                  <ToggleRight className="w-4 h-4 text-emerald-400" />
                  <span>Liberados</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-rose-400" />
                  <span>Fechados</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Stats bar for List tab */}
        {activeTab === 'list' && (
          <div className="px-6 py-2.5 bg-[#0A101D] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Total:</span>
                <span className="font-bold text-white font-mono">{totalUsers}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-400">Ativos:</span>
                <span className="font-bold text-emerald-400 font-mono">{activeUsersCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-slate-400">Bloqueados:</span>
                <span className="font-bold text-rose-400 font-mono">{blockedUsersCount}</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('create')}
              className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Adicionar novo usuário agora</span>
            </button>
          </div>
        )}

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className={`px-6 py-2.5 flex items-center justify-between text-xs border-b ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-white ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TAB 1: USERS LIST */}
        {activeTab === 'list' && (
          <>
            {/* Search and Filter */}
            <div className="p-4 bg-[#0B1120] border-b border-slate-800/80 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="search-users-input"
                  type="text"
                  placeholder="Buscar por nome, usuário ou e-mail..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#162035] border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('create')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Criar Usuário</span>
                </button>

                <button
                  onClick={fetchUsers}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
                  title="Atualizar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Atualizar</span>
                </button>
              </div>
            </div>

            {/* User List Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
              {loading ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mb-2" />
                  <p className="text-xs">Carregando contas cadastradas...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">Nenhum usuário localizado.</p>
                  <p className="text-xs text-slate-500">
                    {searchQuery ? `Nenhum resultado para "${searchQuery}".` : 'Nenhuma conta cadastrada além do administrador.'}
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Criar Primeiro Usuário</span>
                  </button>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isMe = user.id === currentAdmin.id;
                  const isActionRunning = actionLoadingId === user.id;

                  return (
                    <div
                      key={user.id}
                      id={`user-row-${user.id}`}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                        user.isBlocked
                          ? 'bg-rose-950/20 border-rose-900/50'
                          : user.role === 'admin'
                          ? 'bg-[#111A2E] border-blue-500/40'
                          : 'bg-[#121A30] border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* User Profile Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                          user.isBlocked
                            ? 'bg-rose-900/30 border-rose-700/50 text-rose-300'
                            : user.role === 'admin'
                            ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}>
                          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-xs truncate">
                              {user.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              @{user.username}
                            </span>

                            {/* Status Badges */}
                            {user.role === 'admin' && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold">
                                Admin
                              </span>
                            )}

                            {user.isBlocked ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                Bloqueado
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                                <CheckCircle className="w-2.5 h-2.5" />
                                Ativo
                              </span>
                            )}

                            {isMe && (
                              <span className="text-[10px] text-slate-500 italic">
                                (Você)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 truncate">
                            {user.email && <span>{user.email}</span>}
                            {user.createdAt && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Calendar className="w-3 h-3" />
                                {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions: Edit / Block / Delete */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {/* Edit Button */}
                        <button
                          id={`edit-user-${user.id}`}
                          onClick={() => handleOpenEdit(user)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition cursor-pointer"
                          title="Editar dados e redefinir senha"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        {isMe ? (
                          <span className="text-[11px] text-slate-500 italic px-2 py-1 bg-slate-800/40 rounded-lg border border-slate-700/40">
                            Conta Principal
                          </span>
                        ) : (
                          <>
                            {/* Block / Unblock button */}
                            <button
                              id={`toggle-block-${user.id}`}
                              onClick={() => handleToggleBlock(user)}
                              disabled={isActionRunning}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                user.isBlocked
                                  ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/40'
                              }`}
                              title={user.isBlocked ? 'Desbloquear acesso' : 'Bloquear acesso do usuário'}
                            >
                              {isActionRunning ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : user.isBlocked ? (
                                <>
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Desbloquear</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Bloquear</span>
                                </>
                              )}
                            </button>

                            {/* Delete button */}
                            <button
                              id={`delete-user-${user.id}`}
                              onClick={() => handleDeleteUser(user)}
                              disabled={isActionRunning}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-500/40 transition cursor-pointer"
                              title="Excluir conta permanentemente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* TAB 2: CREATE USER AREA */}
        {activeTab === 'create' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-[#0B1120]">
            <div className="max-w-xl mx-auto space-y-6">
              {/* Header Box */}
              <div className="p-4 rounded-xl bg-[#121A30] border border-slate-700/80 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Criar Novo Acesso</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Preencha os dados abaixo para gerar um usuário. A conta estará ativa imediatamente e pronta para uso.
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nome Completo
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="admin-create-name"
                        type="text"
                        placeholder="Ex: Carlos Eduardo"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full bg-[#162035] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nome de Usuário (Login)
                    </label>
                    <div className="relative">
                      <span className="text-slate-400 font-mono text-xs absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        @
                      </span>
                      <input
                        id="admin-create-username"
                        type="text"
                        placeholder="carloseduardo"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className="w-full bg-[#162035] border border-slate-700/80 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Email (Optional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    E-mail <span className="text-slate-500 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="admin-create-email"
                      type="email"
                      placeholder="usuario@email.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-[#162035] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Password & Password Generator */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Senha de Acesso
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Gerar Senha Automática</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="admin-create-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 4 caracteres"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full bg-[#162035] border border-slate-700/80 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 transition cursor-pointer"
                      title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Role Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nível de Acesso (Cargo)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      formRole === 'user'
                        ? 'bg-blue-600/15 border-blue-500/60 ring-1 ring-blue-500/40 text-white'
                        : 'bg-[#162035] border-slate-700/80 text-slate-300 hover:border-slate-600'
                    }`}>
                      <input
                        type="radio"
                        name="user-role"
                        checked={formRole === 'user'}
                        onChange={() => setFormRole('user')}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold">Usuário Padrão</div>
                        <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          Acesso aos canais ao vivo, player HLS e visualização de código.
                        </div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      formRole === 'admin'
                        ? 'bg-purple-600/15 border-purple-500/60 ring-1 ring-purple-500/40 text-white'
                        : 'bg-[#162035] border-slate-700/80 text-slate-300 hover:border-slate-600'
                    }`}>
                      <input
                        type="radio"
                        name="user-role"
                        checked={formRole === 'admin'}
                        onChange={() => setFormRole('admin')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>Administrador</span>
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                          Acesso irrestrito + painel de gerenciar e bloquear usuários.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Submit button */}
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
                      <span>Cadastrar e Liberar Usuário</span>
                    </>
                  )}
                </button>
              </form>

              {/* Created User Credentials Box */}
              {lastCreatedUser && (
                <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      Último Usuário Criado
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
                          <span>Copiar Acesso</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-black/40 rounded-lg text-xs font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[10px]">USUÁRIO:</span>
                      <span className="text-white font-bold">{lastCreatedUser.username}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">SENHA:</span>
                      <span className="text-emerald-300 font-bold">{lastCreatedUser.password}</span>
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

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#111A2E] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <p>
            {activeTab === 'list'
              ? '*Usuários bloqueados perdem a sessão imediatamente e recebem mensagem de acesso negado.'
              : '*Contas criadas pelo administrador são ativadas imediatamente sem restrições.'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition cursor-pointer"
          >
            Fechar
          </button>
        </div>

        {/* SUB-MODAL: EDITAR USUÁRIO */}
        {editingUser && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#0F172A] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 py-4 bg-[#14203A] border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Editar Usuário</h4>
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

              <form onSubmit={handleSaveEdit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                {/* Nome Completo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome Completo
                  </label>
                  <input
                    id="edit-user-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#1A2642] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Nome de Usuário (Login) */}
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
                      className="w-full bg-[#1A2642] border border-slate-700/80 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      required
                    />
                  </div>
                </div>

                {/* E-mail (Opcional) */}
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
                    className="w-full bg-[#1A2642] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Nova Senha */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Redefinir Senha <span className="text-slate-500 font-normal">(deixe vazio para não alterar)</span>
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
                      className="w-full bg-[#1A2642] border border-slate-700/80 rounded-xl px-3 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
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

                {/* Cargo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nível de Acesso (Cargo)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                      editRole === 'user' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-[#1A2642] border-slate-700/80 text-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="edit-role"
                        checked={editRole === 'user'}
                        onChange={() => setEditRole('user')}
                        disabled={editingUser.id === currentAdmin.id}
                      />
                      <span className="text-xs font-medium">Usuário Comum</span>
                    </label>

                    <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                      editRole === 'admin' ? 'bg-purple-600/20 border-purple-500 text-white' : 'bg-[#1A2642] border-slate-700/80 text-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="edit-role"
                        checked={editRole === 'admin'}
                        onChange={() => setEditRole('admin')}
                      />
                      <span className="text-xs font-medium flex items-center gap-1">
                        <span>Administrador</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                      </span>
                    </label>
                  </div>
                  {editingUser.id === currentAdmin.id && (
                    <span className="text-[10px] text-slate-500 block mt-1">
                      *Você não pode remover seu próprio privilégio de administrador.
                    </span>
                  )}
                </div>

                {/* Status da Conta (Bloqueado / Ativo) */}
                {editingUser.id !== currentAdmin.id && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Status de Acesso
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditIsBlocked(!editIsBlocked)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
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

                {/* Footer Buttons */}
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

        {/* SUB-MODAL: CONFIRMAR EXCLUSÃO DEFINITIVA */}
        {userToDelete && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#0F172A] border border-rose-500/40 rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Excluir Conta Definitivamente?</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Você está prestes a excluir a conta de <span className="text-white font-semibold">@{userToDelete.username}</span> ({userToDelete.name}).
                    Todas as sessões ativas serão canceladas e o acesso será excluído permanentemente.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="confirm-delete-user-btn"
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs text-white font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sim, Excluir Conta</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
