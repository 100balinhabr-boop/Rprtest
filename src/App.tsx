import React, { useState, useEffect } from 'react';
import { Channel, ViewMode, UserAccount } from './types';
import { SAMPLE_PLAYLISTS } from './data/samplePlaylists';
import { parseM3U } from './utils/m3uParserWeb';
import { IptvPlayerView } from './components/IptvPlayerView';
import { AndroidCodeViewer } from './components/AndroidCodeViewer';
import { ArchitectureDoc } from './components/ArchitectureDoc';
import { PlaylistImporterModal } from './components/PlaylistImporterModal';
import { AuthScreen } from './components/AuthScreen';
import { AdminUsersModal } from './components/AdminUsersModal';
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
  ShieldCheck
} from 'lucide-react';
import { ANDROID_FILES } from './data/androidProjectFiles';

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

  const [viewMode, setViewMode] = useState<ViewMode>('player');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [isImporterOpen, setIsImporterOpen] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Verifica a sessão atual com o backend na inicialização
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
        // Mantém a sessão salva offline caso haja interrupção temporária
      })
      .finally(() => {
        setIsVerifyingAuth(false);
      });
  }, []);

  // Inicializa com a lista demonstrativa legal de canais HLS
  useEffect(() => {
    const { channels: parsedChannels, groups } = parseM3U(SAMPLE_PLAYLISTS[0].rawM3u);
    setChannels(parsedChannels);
    setCategories(['TODOS', 'FAVORITOS', ...groups]);
  }, []);

  const handlePlaylistLoaded = (newChannels: Channel[], newGroups: string[]) => {
    setChannels(newChannels);
    setCategories(['TODOS', 'FAVORITOS', ...newGroups]);
    setSelectedCategory('TODOS');
  };

  const handleToggleFavorite = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, isFavorite: !c.isFavorite } : c))
    );
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

  // Se ainda estiver validando a sessão salva, exibe tela de carregamento suave
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

  // Se não estiver autenticado, exibe a tela de Login / Criação de Conta
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-[#070C18] text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-[#0B1224] border-b border-slate-800/90 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between min-h-[3.75rem] py-2 gap-2">
          {/* Logo & Project Title */}
          <div className="flex items-center gap-2.5 min-w-0">
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

          {/* View Modes Tabs */}
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

          {/* Actions & User Profile */}
          <div className="flex items-center gap-2">
            {/* Admin Management Button (visible only to admin role) */}
            {currentUser.role === 'admin' && (
              <button
                id="header-admin-users-btn"
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold transition shadow-sm"
                title="Gerenciar usuários cadastrados, bloquear contas e controlar registro"
              >
                <UsersIcon className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Gerenciar Usuários</span>
                <span className="sm:hidden">Usuários</span>
              </button>
            )}

            <button
              id="download-all-code-btn"
              onClick={handleDownloadAllCode}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              title="Baixar todas as classes Java e XML compiladas"
            >
              <FolderDown className="w-3.5 h-3.5 text-blue-400" />
              <span>Exportar Java</span>
            </button>

            {/* Authenticated User Badge & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-blue-400 font-mono">
                  @{currentUser.username} {currentUser.role === 'admin' && '• Admin'}
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-xs">
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

      {/* Main Workspace Body */}
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

      {/* Playlist Importer Modal */}
      <PlaylistImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onPlaylistLoaded={handlePlaylistLoaded}
      />

      {/* Admin Users Management Modal */}
      {currentUser.role === 'admin' && (
        <AdminUsersModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          currentAdmin={currentUser}
        />
      )}
    </div>
  );
}
