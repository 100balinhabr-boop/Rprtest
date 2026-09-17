import React, { useState, useEffect, useRef } from 'react';
import { Channel, ViewMode, UserAccount } from './types';
import { SAMPLE_PLAYLISTS } from './data/samplePlaylists';
import { parseM3U } from './utils/m3uParserWeb';
import { IptvPlayerView } from './components/IptvPlayerView';
import { AndroidCodeViewer } from './components/AndroidCodeViewer';
import { ArchitectureDoc } from './components/ArchitectureDoc';
import { PlaylistImporterModal } from './components/PlaylistImporterModal';
import { AuthScreen } from './components/AuthScreen';
import { AdminUsersModal } from './components/AdminUsersModal';
import { ClientPortalView } from './components/ClientPortalView';
import { 
  Play, 
  Code2, 
  Layers, 
  FolderDown, 
  Tv, 
  Check, 
  ExternalLink,
  Smartphone,
  LogOut,
  User as UserIcon,
  Users as UsersIcon,
  ShieldCheck,
  AlertCircle,
  X,
  Crown,
  Briefcase
} from 'lucide-react';
import { ANDROID_FILES } from './data/androidProjectFiles';
import { normalizeUserRole } from './components/AdminUsersModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem('iptv_auth_user') || sessionStorage.getItem('iptv_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isVerifyingAuth, setIsVerifyingAuth] = useState<boolean>(true);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [appViewMode, setAppViewMode] = useState<'studio' | 'client'>(() => {
    const saved = localStorage.getItem('iptv_app_view_mode');
    if (saved === 'client' || saved === 'studio') return saved;
    return 'studio';
  });

  const isMasterOrRevenda = (role?: string) => {
    const norm = normalizeUserRole(role);
    return norm === 'AdminMaster' || norm === 'AdminRevenda';
  };

  const isClienteComum = (role?: string) => {
    return normalizeUserRole(role) === 'UsuarioComum';
  };

  const [viewMode, setViewMode] = useState<ViewMode>('player');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [isImporterOpen, setIsImporterOpen] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [autoLoadNotice, setAutoLoadNotice] = useState<{ type: 'loading' | 'success' | 'error'; message: string } | null>(null);
  const loadedUserPlaylistRef = useRef<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('iptv_auth_token') || sessionStorage.getItem('iptv_auth_token');
    if (!token) {
      setIsVerifyingAuth(false);
      return;
    }

    fetch(`/api/auth/me?token=${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('iptv_auth_user', JSON.stringify(data.user));
        } else {
          localStorage.removeItem('iptv_auth_token');
          localStorage.removeItem('iptv_auth_user');
          sessionStorage.removeItem('iptv_auth_token');
          sessionStorage.removeItem('iptv_auth_user');
          setCurrentUser(null);
        }
      })
      .catch(() => {
      })
      .finally(() => {
        setIsVerifyingAuth(false);
      });
  }, []);

  useEffect(() => {
    if (currentUser && isClienteComum(currentUser.role)) {
      setAppViewMode('client');
      localStorage.setItem('iptv_app_view_mode', 'client');
    }
  }, [currentUser?.id, currentUser?.role]);

  const getSavedFavoriteIds = (userId?: string): string[] => {
    try {
      const userKey = userId || currentUser?.id || 'guest';
      const raw = localStorage.getItem(`iptv_fav_ids_${userKey}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const applyFavorites = (chList: Channel[], userId?: string): Channel[] => {
    const favIds = new Set(getSavedFavoriteIds(userId));
    return chList.map((c) => ({
      ...c,
      isFavorite: c.isFavorite || favIds.has(c.id) || favIds.has(c.streamUrl),
    }));
  };

  useEffect(() => {
    if (channels.length === 0) {
      const { channels: parsedChannels, groups } = parseM3U(SAMPLE_PLAYLISTS[0].rawM3u);
      setChannels(applyFavorites(parsedChannels));
      setCategories(['TODOS', 'FAVORITOS', ...groups]);
    }
  }, []);

  useEffect(() => {
    if (channels.length > 0 && currentUser) {
      setChannels((prev) => applyFavorites(prev, currentUser.id));
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || !currentUser.playlistUrl) return;

    const playlistKey = `${currentUser.id}:${currentUser.playlistUrl}`;
    if (loadedUserPlaylistRef.current === playlistKey) {
      return;
    }

    const loadUserSavedPlaylist = async () => {
      loadedUserPlaylistRef.current = playlistKey;
      setAutoLoadNotice({
        type: 'loading',
        message: `Restaurando lista salva "${currentUser.playlistName || 'Minha Lista IPTV'}" de @${currentUser.username}...`,
      });

      try {
        const res = await fetch('/api/load-playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: currentUser.playlistUrl,
            maxChannels: 2000,
            mode: 'live',
            preferFormat: 'm3u8',
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success || !data.channels || data.channels.length === 0) {
          throw new Error(data.error || 'Nenhum canal foi retornado do link salvo.');
        }

        const groupNames = Array.isArray(data.groups)
          ? data.groups.map((g: any) => (typeof g === 'string' ? g : g.name))
          : Array.from(new Set(data.channels.map((c: any) => c.groupTitle || 'Geral')));

        setChannels(applyFavorites(data.channels, currentUser.id));
        setCategories(['TODOS', 'FAVORITOS', ...groupNames]);
        setSelectedCategory('TODOS');
        setAutoLoadNotice({
          type: 'success',
          message: data.message || `Sua lista "${currentUser.playlistName || 'Minha Lista IPTV'}" foi carregada com sucesso (${data.channels.length} canais e mídias)!`,
        });

        setTimeout(() => {
          setAutoLoadNotice(null);
        }, 5000);
      } catch (err: any) {
        console.warn('Falha no auto-load da lista salva:', err);
        setAutoLoadNotice({
          type: 'error',
          message: `Não foi possível carregar a lista salva automaticamente: ${err.message}`,
        });
        setTimeout(() => {
          setAutoLoadNotice(null);
        }, 6000);
      }
    };

    loadUserSavedPlaylist();
  }, [currentUser]);

  const handlePlaylistLoaded = (newChannels: Channel[], newGroups: string[]) => {
    setChannels(applyFavorites(newChannels));
    setCategories(['TODOS', 'FAVORITOS', ...newGroups]);
    setSelectedCategory('TODOS');
  };

  const handleToggleFavorite = (channelId: string) => {
    setChannels((prev) => {
      const updated = prev.map((c) => (c.id === channelId ? { ...c, isFavorite: !c.isFavorite } : c));
      const userKey = currentUser?.id || 'guest';
      const favIds = updated.filter((c) => c.isFavorite).map((c) => c.id);
      try {
        localStorage.setItem(`iptv_fav_ids_${userKey}`, JSON.stringify(favIds));
      } catch {}
      return updated;
    });
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('iptv_auth_token') || sessionStorage.getItem('iptv_auth_token');
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch {}

    localStorage.removeItem('iptv_auth_token');
    localStorage.removeItem('iptv_auth_user');
    sessionStorage.removeItem('iptv_auth_token');
    sessionStorage.removeItem('iptv_auth_user');
    loadedUserPlaylistRef.current = null;
    setCurrentUser(null);
  };

  const handleDownloadAllCode = () => {
    let bundle = `/**\n * IPTV PLAYER PRO - ANDROID JAVA CLEAN ARCHITECTURE\n * Pacotes e Códigos Prontos para Android Studio\n * Dependências: AndroidX Media3 ExoPlayer, OkHttp3, Glide, ViewModel, Material\n */\n\n`;

    ANDROID_FILES.forEach((file) => {
      bundle += `\n// ========================================================\n`;
      bundle += `// ARQUIVO: ${file.path}\n`;
      bundle += `// DESCRIÇÃO: ${file.description}\n`;
      bundle += `// ========================================================\n\n`;
      bundle += file.content;
      bundle += `\n\n`;
    });

    const element = document.createElement('a');
    const file = new Blob([bundle], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = 'IPTV_Player_Android_Java_CleanArchitecture.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (isVerifyingAuth) {
    return (
      <div className="min-h-screen bg-[#050914] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20 ring-1 ring-blue-400/30 mb-4 animate-pulse">
          <Tv className="w-6 h-6 text-white" />
        </div>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium">Verificando credenciais de acesso...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={(user) => setCurrentUser(user)} />;
  }

  const userIsCliente = isClienteComum(currentUser.role);
  const userIsAdmin = isMasterOrRevenda(currentUser.role);

  if (appViewMode === 'client' || userIsCliente) {
    return (
      <ClientPortalView
        channels={channels}
        categories={categories}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenImporter={() => setIsImporterOpen(true)}
        onToggleFavorite={handleToggleFavorite}
        isAdminPreview={userIsAdmin}
        onSwitchToAdmin={userIsAdmin ? () => {
          setAppViewMode('studio');
          localStorage.setItem('iptv_app_view_mode', 'studio');
        } : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#070C18] text-slate-100 flex flex-col font-sans">
      <header className="bg-[#0B1224] border-b border-slate-800/90 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30 shrink-0">
              <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white truncate">
                  RPR TV FREE
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  AO VIVO
                </span>
              </div>
              <p className="hidden md:block text-xs text-slate-400 truncate">
                Transmissão HD • Canais ao Vivo • Player Rápido
              </p>
            </div>
          </div>

          {userIsAdmin && (
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs shrink-0">
              <button
                id="tab-player-btn"
                onClick={() => setViewMode('player')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition ${
                  viewMode === 'player'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Player</span>
              </button>

              <button
                id="tab-code-btn"
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition ${
                  viewMode === 'code'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Códigos</span>
              </button>

              <button
                id="tab-architecture-btn"
                onClick={() => setViewMode('architecture')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition ${
                  viewMode === 'architecture'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Arquitetura</span>
                <span className="sm:hidden">Guia</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
            <button
              id="header-user-playlist-btn"
              onClick={() => setIsImporterOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                currentUser.playlistUrl
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={currentUser.playlistUrl ? `Lista vinculada: ${currentUser.playlistName || currentUser.playlistUrl}` : 'Vincular lista M3U à sua conta'}
            >
              <Tv className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline font-semibold">
                {currentUser.playlistUrl ? (currentUser.playlistName || 'Lista Salva') : 'Adicionar Lista M3U'}
              </span>
              <span className="md:hidden">
                {currentUser.playlistUrl ? 'Lista' : '+ M3U'}
              </span>
            </button>

            {userIsAdmin && (
              <button
                id="header-admin-users-btn"
                onClick={() => setIsAdminModalOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm border cursor-pointer active:scale-95 ${
                  normalizeUserRole(currentUser.role) === 'AdminMaster'
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                    : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/40'
                }`}
                title="Painel de controle de usuários, revendas e datas de vencimento"
              >
                {normalizeUserRole(currentUser.role) === 'AdminMaster' ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span className="hidden sm:inline">
                  {normalizeUserRole(currentUser.role) === 'AdminRevenda' ? 'Painel Revenda' : 'Painel Master'}
                </span>
                <span className="sm:hidden">Painel</span>
              </button>
            )}

            {userIsAdmin && (
              <button
                id="header-client-preview-btn"
                onClick={() => {
                  setAppViewMode('client');
                  localStorage.setItem('iptv_app_view_mode', 'client');
                }}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm border bg-red-600/20 hover:bg-red-600/30 text-red-300 border-red-500/40 cursor-pointer active:scale-95"
                title="Visualizar o template exatamente como o cliente final vê após o login"
              >
                <Smartphone className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">Ver App do Cliente</span>
                <span className="sm:hidden">App Cliente</span>
              </button>
            )}

            {userIsAdmin && (
              <button
                id="download-all-code-btn"
                onClick={handleDownloadAllCode}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                title="Baixar todas as classes Java e XML compiladas"
              >
                <FolderDown className="w-3.5 h-3.5 text-blue-400" />
                <span>Exportar Java</span>
              </button>
            )}

            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 leading-tight">
                  {currentUser.name}
                </span>
                <div className="flex items-center justify-end gap-1 text-[10px] font-mono">
                  <span className="text-slate-400">@{currentUser.username}</span>
                  {currentUser.role === 'AdminMaster' || currentUser.role === 'admin' ? (
                    <span className="text-amber-400 font-bold">• Master</span>
                  ) : currentUser.role === 'AdminRevenda' ? (
                    <span className="text-cyan-400 font-bold">• Revenda</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">
                      • {currentUser.expirationDate ? `Vence: ${currentUser.expirationDate.slice(0, 10).split('-').reverse().join('/')}` : 'Vitalício'}
                    </span>
                  )}
                </div>
              </div>
              <div
                onClick={() => {
                  if (userIsAdmin) {
                    setIsAdminModalOpen(true);
                  }
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border ${
                  userIsAdmin ? 'cursor-pointer hover:ring-2 hover:ring-blue-400/50' : ''
                } ${
                  normalizeUserRole(currentUser.role) === 'AdminMaster'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : normalizeUserRole(currentUser.role) === 'AdminRevenda'
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200'
                }`}
                title={userIsAdmin ? 'Clique para abrir o painel' : undefined}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <button
                id="header-logout-btn"
                onClick={handleLogout}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/40 transition"
                title="Sair da conta"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {autoLoadNotice && (
        <div className={`px-4 py-2 text-xs flex items-center justify-between border-b transition-all ${
          autoLoadNotice.type === 'loading'
            ? 'bg-blue-950/90 text-blue-200 border-blue-800/80'
            : autoLoadNotice.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/80'
            : 'bg-rose-950/90 text-rose-200 border-rose-800/80'
        }`}>
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            {autoLoadNotice.type === 'loading' && (
              <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
            {autoLoadNotice.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
            {autoLoadNotice.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span className="font-medium">{autoLoadNotice.message}</span>
          </div>
          <button
            onClick={() => setAutoLoadNotice(null)}
            className="text-slate-400 hover:text-white p-0.5 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <main className="flex-1 flex flex-col">
        {viewMode === 'player' && (
          <div className="flex-1 h-[calc(100vh-4rem)]">
            <IptvPlayerView
              channels={channels}
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onOpenImporter={() => setIsImporterOpen(true)}
              onToggleFavorite={handleToggleFavorite}
              currentUser={currentUser}
              onOpenAdminPanel={() => setIsAdminModalOpen(true)}
            />
          </div>
        )}

        {viewMode === 'code' && (
          <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Código-Fonte Completo para Android Studio (100% Java)
                </h2>
                <p className="text-xs text-slate-400">
                  Navegue entre as classes de dados, parser de streaming, adapters do RecyclerView e a Activity do ExoPlayer.
                </p>
              </div>
              <button
                onClick={handleDownloadAllCode}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-600/20"
              >
                <FolderDown className="w-4 h-4" />
                <span>Baixar Todas as Classes</span>
              </button>
            </div>
            <AndroidCodeViewer />
          </div>
        )}

        {viewMode === 'architecture' && (
          <div className="flex-1 py-4">
            <ArchitectureDoc />
          </div>
        )}
      </main>

      <PlaylistImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onPlaylistLoaded={handlePlaylistLoaded}
        currentUser={currentUser}
        onUserUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          localStorage.setItem('iptv_auth_user', JSON.stringify(updatedUser));
        }}
      />

      {isAdminModalOpen && currentUser && (
        <AdminUsersModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          currentAdmin={currentUser}
        />
      )}
    </div>
  );
          }
