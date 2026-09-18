import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';
import { Channel, UserAccount } from '../types';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Search, 
  Star, 
  Tv, 
  Radio, 
  Layers, 
  Info, 
  AlertCircle,
  Smartphone,
  MonitorPlay,
  RotateCw,
  FolderOpen,
  Download,
  Check,
  X,
  Users,
  Crown,
  Briefcase,
  Sun,
  PictureInPicture2,
  Gauge,
  SkipBack,
  RefreshCw
} from 'lucide-react';
import { TvRemoteOverlay } from './TvRemoteOverlay';

interface IptvPlayerViewProps {
  channels: Channel[];
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onOpenImporter: () => void;
  onToggleFavorite: (channelId: string) => void;
  currentUser?: UserAccount | null;
  onOpenAdminPanel?: () => void;
}

interface HlsLevelInfo {
  index: number;
  height: number;
  bitrate: number;
  name: string;
}

export const IptvPlayerView: React.FC<IptvPlayerViewProps> = ({
  channels,
  categories,
  selectedCategory,
  onSelectCategory,
  onOpenImporter,
  onToggleFavorite,
  currentUser,
  onOpenAdminPanel,
}) => {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [lastChannel, setLastChannel] = useState<Channel | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [brightness, setBrightness] = useState<number>(1);
  const [showBrightness, setShowBrightness] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [aspectRatioMode, setAspectRatioMode] = useState<'fit' | 'fill' | 'zoom'>('fit');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isRemoteOpen, setIsRemoteOpen] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [showChannelOsd, setShowChannelOsd] = useState<boolean>(false);
  const [exportNotification, setExportNotification] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const [hlsLevels, setHlsLevels] = useState<HlsLevelInfo[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const [usedFormat, setUsedFormat] = useState<'m3u8' | 'ts'>('m3u8');

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const osdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-select first channel on mount or channel list update
  useEffect(() => {
    if (!activeChannel && channels.length > 0) {
      setActiveChannel(channels[0]);
    }
  }, [channels, activeChannel]);

  // Trigger smooth Smart TV OSD banner on channel switch
  useEffect(() => {
    if (!activeChannel) return;
    setShowChannelOsd(true);
    if (osdTimerRef.current) {
      clearTimeout(osdTimerRef.current);
    }
    osdTimerRef.current = setTimeout(() => {
      setShowChannelOsd(false);
    }, 2800);

    return () => {
      if (osdTimerRef.current) {
        clearTimeout(osdTimerRef.current);
      }
    };
  }, [activeChannel?.id]);

  // Auto-hide controls after 3.5s of inactivity when playing
  const scheduleHideControls = () => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 3500);
  };

  const showControlsTemporarily = () => {
    setControlsVisible(true);
    scheduleHideControls();
  };

  useEffect(() => {
    if (isPlaying) {
      scheduleHideControls();
    } else {
      setControlsVisible(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [isPlaying]);

  // Track fullscreen state changes (user might exit via ESC/back)
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Track PiP state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnter = () => setIsPipActive(true);
    const onLeave = () => setIsPipActive(false);
    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  // Load stream whenever activeChannel changes
  useEffect(() => {
    if (!activeChannel || !videoRef.current) return;

    setPlaybackError(null);
    setIsBuffering(true);
    setIsReconnecting(false);
    setReconnectAttempt(0);
    setUsedFormat('m3u8');

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    let streamUrl = activeChannel.streamUrl;
    // Bypasses browser Mixed Content block (HTTPS -> HTTP) and CORS for web preview playback
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && streamUrl.startsWith('http://')) {
      streamUrl = `/api/proxy-stream?url=${encodeURIComponent(streamUrl)}`;
    }

    if (Hls.isSupported() && (streamUrl.includes('.m3u8') || streamUrl.includes('hls') || streamUrl.startsWith('http') || streamUrl.includes('/api/proxy-stream'))) {
      // Buffer inteligente: mais tolerante a oscilações de rede
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        highBufferWatchdogPeriod: 2,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1500,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 4,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 6,
        startLevel: -1,
        capLevelToPlayerSize: true,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsBuffering(false);
        // Coletar níveis de qualidade disponíveis
        const levels: HlsLevelInfo[] = (data.levels || []).map((lvl: any, idx: number) => ({
          index: idx,
          height: lvl.height || 0,
          bitrate: lvl.bitrate || 0,
          name: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}kbps`,
        }));
        setHlsLevels(levels);
        setCurrentLevel(hls.currentLevel);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.BUFFER_APPENDING, () => {
        setIsBuffering(true);
      });

      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        setIsBuffering(false);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;

        setIsBuffering(false);

        // Reconexão automática: tenta 3x antes de desistir
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          const attempt = reconnectAttempt + 1;
          if (attempt <= 3) {
            setIsReconnecting(true);
            setReconnectAttempt(attempt);
            setPlaybackError(`Conexão caiu. Reconectando... (${attempt}/3)`);
            hls.stopLoad();
            reconnectTimerRef.current = setTimeout(() => {
              try {
                hls.startLoad();
                setIsReconnecting(false);
                setPlaybackError(null);
              } catch {
                // Se não recuperar, tenta fallback de formato
                tryFormatFallback();
              }
            }, 2000);
          } else {
            setPlaybackError('Não foi possível reconectar. Tentando formato alternativo...');
            tryFormatFallback();
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setPlaybackError('Erro nos codecs do stream. Recuperando...');
          hls.recoverMediaError();
        } else {
          setPlaybackError('Stream indisponível ou bloqueado.');
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS nativo
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
      video.addEventListener('error', () => {
        setIsBuffering(false);
        setPlaybackError('Não foi possível carregar o vídeo nativo.');
      });
    } else {
      video.src = streamUrl;
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeChannel]);

  // Aplica brilho via CSS filter
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.style.filter = `brightness(${brightness})`;
    }
  }, [brightness]);

  // Aplica volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Fallback de formato: se o m3u8 falhar 3x, tenta .ts
  const tryFormatFallback = () => {
    if (!activeChannel) return;
    if (usedFormat === 'm3u8' && activeChannel.streamUrl.includes('.m3u8')) {
      setUsedFormat('ts');
      setReconnectAttempt(0);
      setPlaybackError('Tentando formato alternativo (.ts)...');
      // Troca a URL e recarrega
      setTimeout(() => {
        const tsUrl = activeChannel.streamUrl.replace('.m3u8', '.ts');
        if (videoRef.current) {
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          videoRef.current.src = tsUrl;
          videoRef.current.play().then(() => {
            setIsPlaying(true);
            setPlaybackError(null);
            setIsReconnecting(false);
          }).catch(() => {
            setPlaybackError('Formato alternativo também falhou. Canal indisponível.');
          });
        }
      }, 800);
    } else {
      setPlaybackError('Canal indisponível. Tente novamente mais tarde.');
    }
  };

  // Normalização de texto para pesquisa sem acentos (case & diacritic insensitive)
  const normalizeText = (text: string) =>
    text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Filtragem dos canais por nome em tempo real
  const filteredChannels = channels.filter((c) => {
    const matchesCategory =
      selectedCategory === 'TODOS' ||
      (selectedCategory === 'FAVORITOS' && c.isFavorite) ||
      c.groupTitle?.toLowerCase() === selectedCategory.toLowerCase();

    const cleanQuery = normalizeText(searchQuery.trim());
    const matchesSearch =
      cleanQuery === '' ||
      normalizeText(c.name).includes(cleanQuery) ||
      (c.groupTitle ? normalizeText(c.groupTitle).includes(cleanQuery) : false);

    return matchesCategory && matchesSearch;
  });

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const cycleAspectRatio = () => {
    if (aspectRatioMode === 'fit') setAspectRatioMode('fill');
    else if (aspectRatioMode === 'fill') setAspectRatioMode('zoom');
    else setAspectRatioMode('fit');
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen()
        .then(() => {
          // Trava em paisagem no celular
          if (screen.orientation && (screen.orientation as any).lock) {
            (screen.orientation as any).lock('landscape').catch(() => {});
          }
        })
        .catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if ((videoRef.current as any).requestPictureInPicture) {
        await (videoRef.current as any).requestPictureInPicture();
      } else {
        setPlaybackError('Picture-in-Picture não suportado neste navegador.');
        setTimeout(() => setPlaybackError(null), 3000);
      }
    } catch {
      setPlaybackError('Não foi possível ativar o PiP agora.');
      setTimeout(() => setPlaybackError(null), 3000);
    }
  };

  const changeQuality = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentLevel(levelIndex);
      setShowQualityMenu(false);
    }
  };

  // TV Remote handlers
  const handleRemoteNavigate = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (filteredChannels.length === 0) return;
    let nextIdx = focusedIndex;
    if (dir === 'right') nextIdx = Math.min(nextIdx + 1, filteredChannels.length - 1);
    else if (dir === 'left') nextIdx = Math.max(nextIdx - 1, 0);
    else if (dir === 'down') nextIdx = Math.min(nextIdx + 4, filteredChannels.length - 1);
    else if (dir === 'up') nextIdx = Math.max(nextIdx - 4, 0);

    setFocusedIndex(nextIdx);
  };

  const handleRemoteSelect = () => {
    if (filteredChannels[focusedIndex]) {
      switchChannel(filteredChannels[focusedIndex], focusedIndex);
    }
  };

  const switchChannel = (newChannel: Channel, index?: number) => {
    if (activeChannel && activeChannel.id !== newChannel.id) {
      setLastChannel(activeChannel);
    }
    setActiveChannel(newChannel);
    if (typeof index === 'number') setFocusedIndex(index);
  };

  const handleNextChannel = () => {
    if (!activeChannel || filteredChannels.length === 0) return;
    const curIdx = filteredChannels.findIndex((c) => c.id === activeChannel.id);
    const nextIdx = (curIdx + 1) % filteredChannels.length;
    switchChannel(filteredChannels[nextIdx], nextIdx);
  };

  const handlePrevChannel = () => {
    if (!activeChannel || filteredChannels.length === 0) return;
    const curIdx = filteredChannels.findIndex((c) => c.id === activeChannel.id);
    const prevIdx = (curIdx - 1 + filteredChannels.length) % filteredChannels.length;
    switchChannel(filteredChannels[prevIdx], prevIdx);
  };

  const handleZapLast = () => {
    if (lastChannel) {
      const cur = activeChannel;
      setActiveChannel(lastChannel);
      setLastChannel(cur);
    }
  };

  const favoriteChannels = channels.filter((c) => c.isFavorite);

  const handleExportFavorites = () => {
    if (favoriteChannels.length === 0) {
      setExportNotification({
        type: 'info',
        message: 'Você ainda não possui canais favoritados. Clique na estrela (⭐) de qualquer canal para favoritá-lo e exportar!',
      });
      setTimeout(() => setExportNotification(null), 4500);
      return;
    }

    const payload = {
      appName: 'RPR TV FREE',
      version: '1.0',
      exportType: 'iptv_favorites_backup',
      exportedAt: new Date().toISOString(),
      user: currentUser
        ? {
            id: currentUser.id,
            username: currentUser.username,
            name: currentUser.name,
          }
        : { username: 'usuario_local' },
      totalFavorites: favoriteChannels.length,
      channels: favoriteChannels.map((c) => ({
        id: c.id,
        name: c.name,
        streamUrl: c.streamUrl,
        logoUrl: c.logoUrl || '',
        groupTitle: c.groupTitle || 'Favoritos',
        tvgId: c.tvgId || '',
        tvgName: c.tvgName || '',
        userAgent: c.userAgent || '',
        isFavorite: true,
      })),
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeUser = currentUser?.username ? currentUser.username.replace(/[^a-zA-Z0-9_-]/g, '') : 'usuario';
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `favoritos_iptv_${safeUser}_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotification({
      type: 'success',
      message: `${favoriteChannels.length} canal(is) favorito(s) exportado(s) com sucesso em formato JSON!`,
    });
    setTimeout(() => setExportNotification(null), 5000);
  };

  const currentQualityLabel = (() => {
    if (currentLevel === -1) return 'Auto';
    const lvl = hlsLevels.find((l) => l.index === currentLevel);
    return lvl ? lvl.name : 'Auto';
  })();

  return (
    <div id="iptv-player-view" className="flex flex-col h-full bg-[#090E1A] text-slate-100 select-none">
      {/* Top Bar / App Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-[#0F172A] border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">RPR TV FREE</h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Media3 ExoPlayer Ready
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {channels.length} canais carregados • Suporte a HLS / DASH / M3U8
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick Search */}
          <div className="relative w-48 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="iptv-search-input"
              type="text"
              placeholder="Buscar canal por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1A2338] border border-slate-700/80 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                id="clear-search-header-btn"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded transition"
                title="Limpar pesquisa"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Painel Administrativo / Revenda */}
          {onOpenAdminPanel && (currentUser?.role === 'AdminMaster' || currentUser?.role === 'AdminRevenda' || currentUser?.role === 'admin') && (
            <button
              id="player-open-admin-panel-btn"
              onClick={onOpenAdminPanel}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border shadow-sm transition active:scale-95 cursor-pointer ${
                currentUser.role === 'AdminRevenda'
                  ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/40'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
              }`}
              title="Acessar painel de gerenciamento de clientes e revendas"
            >
              {currentUser.role === 'AdminRevenda' ? (
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <Crown className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="hidden sm:inline">
                {currentUser.role === 'AdminRevenda' ? 'Painel Revenda' : 'Painel Master'}
              </span>
              <span className="sm:hidden">Painel</span>
            </button>
          )}

          {/* Exportar Favoritos JSON */}
          <button
            id="export-favorites-btn"
            onClick={handleExportFavorites}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm transition active:scale-95 cursor-pointer"
            title="Exportar canais favoritos em formato JSON para backup ou sincronização futura"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline font-semibold">Exportar Favoritos</span>
            <span className="sm:hidden font-semibold">Favoritos</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/25 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/30">
              {favoriteChannels.length}
            </span>
          </button>

          {/* Importar M3U */}
          <button
            id="open-importer-btn"
            onClick={onOpenImporter}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition active:scale-95"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Importar Lista</span>
          </button>

          {/* Remote Simulator Toggle */}
          <button
            id="toggle-remote-btn"
            onClick={() => setIsRemoteOpen(!isRemoteOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition ${
              isRemoteOpen
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Controle TV</span>
          </button>
        </div>
      </div>

      {/* Categories Horizontal Bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 bg-[#0C1322] border-b border-slate-800/80 overflow-x-auto custom-scrollbar">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-2">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          Grupos:
        </span>
        {categories.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <button
              key={category}
              id={`cat-btn-${category.replace(/[^a-zA-Z0-9]/g, '-')}`}
              onClick={() => onSelectCategory(category)}
              className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors cursor-pointer z-0 ${
                isSelected
                  ? 'text-white font-semibold'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeCategoryPill"
                  className="absolute inset-0 bg-blue-600 rounded-full shadow-md shadow-blue-600/30 -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              {category}
            </button>
          );
        })}
      </div>

      {/* Main Content Area: Left Player, Right Channel Grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Video Player Stage */}
        <div className="w-full lg:w-7/12 xl:w-8/12 flex flex-col bg-black relative border-b lg:border-b-0 lg:border-r border-slate-800">
          <div
            ref={playerContainerRef}
            onMouseMove={showControlsTemporarily}
            onTouchStart={showControlsTemporarily}
            onClick={showControlsTemporarily}
            className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[260px] sm:min-h-[380px] group"
          >
            {/* Native Video Element with Aspect Ratio Class */}
            <video
              ref={videoRef}
              playsInline
              className={`w-full h-full transition-all duration-200 ${
                aspectRatioMode === 'fit'
                  ? 'object-contain'
                  : aspectRatioMode === 'fill'
                  ? 'object-fill'
                  : 'object-cover'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (controlsVisible) {
                  togglePlay();
                } else {
                  showControlsTemporarily();
                }
              }}
            />

            {/* Buffering Spinner */}
            <AnimatePresence>
              {isBuffering && !isReconnecting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none z-20"
                >
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-200 font-medium mt-3 tracking-wide">
                    Conectando ao Stream HLS...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Reconexão automática — banner dedicado */}
            <AnimatePresence>
              {isReconnecting && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-blue-950/95 border border-blue-500/50 px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-blue-200 text-xs shadow-lg pointer-events-none"
                >
                  <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="font-semibold">
                    Reconectando ao canal... tentativa {reconnectAttempt}/3
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message Toast / Alert */}
            <AnimatePresence>
              {playbackError && !isReconnecting && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-4 left-4 right-4 z-20 bg-rose-950/90 border border-rose-600/50 p-3 rounded-xl flex items-start gap-2.5 text-rose-200 text-xs shadow-lg"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Aviso de Reprodução</p>
                    <p className="text-rose-300 mt-0.5">{playbackError}</p>
                    <p className="text-[10px] text-rose-400 mt-1">
                      *Nota: no app nativo Android com ExoPlayer, este fluxo roda sem restrições de CORS.
                    </p>
                  </div>
                  <button
                    onClick={() => setPlaybackError(null)}
                    className="text-rose-400 hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Channel Logo / Watermark Overlay */}
            <AnimatePresence mode="wait">
              {activeChannel && controlsVisible && (
                <motion.div
                  key={activeChannel.id}
                  initial={{ opacity: 0, y: -12, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.94 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="absolute top-4 left-4 z-10 flex items-center gap-2.5 bg-black/65 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 pointer-events-none shadow-xl"
                >
                  {activeChannel.logoUrl ? (
                    <img
                      src={activeChannel.logoUrl}
                      alt={activeChannel.name}
                      className="w-7 h-7 object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Tv className="w-4 h-4 text-blue-400" />
                  )}
                  <div>
                    <h2 className="text-xs font-bold text-white leading-tight">
                      {activeChannel.name}
                    </h2>
                    <span className="text-[10px] text-blue-400 font-medium">
                      {activeChannel.groupTitle || 'Canal Ao Vivo'}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Channel Switch OSD Banner (Estilo Smart TV) */}
            <AnimatePresence>
              {showChannelOsd && activeChannel && (
                <motion.div
                  key={`osd-${activeChannel.id}`}
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.96 }}
                  transition={{ duration: 0.26, ease: 'easeOut' }}
                  className="absolute bottom-24 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-sm z-30 bg-slate-950/90 backdrop-blur-md border border-blue-500/40 rounded-2xl p-3.5 shadow-2xl pointer-events-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-inner">
                      {activeChannel.logoUrl ? (
                        <img
                          src={activeChannel.logoUrl}
                          alt={activeChannel.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Tv className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          Sintonizado
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Ao Vivo
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white truncate mt-0.5 leading-tight">
                        {activeChannel.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate">
                        {activeChannel.groupTitle || 'Geral'} • {activeChannel.streamUrl.endsWith('.m3u8') ? 'HLS / M3U8' : 'Stream Direto'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* In-Player Media Controls Bar (auto-hide) */}
            <AnimatePresence>
              {controlsVisible && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-3 pt-8 pb-3 z-20"
                >
                  {/* Barra de brilho flutuante */}
                  <AnimatePresence>
                    {showBrightness && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-16 left-3 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2 shadow-xl"
                      >
                        <Sun className="w-4 h-4 text-yellow-400" />
                        <input
                          type="range"
                          min="0.3"
                          max="1.5"
                          step="0.05"
                          value={brightness}
                          onChange={(e) => setBrightness(parseFloat(e.target.value))}
                          className="w-32 h-1 accent-yellow-400"
                        />
                        <span className="text-[10px] text-yellow-300 font-mono w-10 text-right">
                          {Math.round(brightness * 100)}%
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Menu de qualidade flutuante */}
                  <AnimatePresence>
                    {showQualityMenu && hlsLevels.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-16 right-3 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-xl py-1.5 shadow-xl min-w-[140px]"
                      >
                        <div className="px-3 py-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wide border-b border-slate-800">
                          Qualidade
                        </div>
                        <button
                          onClick={() => changeQuality(-1)}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 transition flex items-center justify-between ${
                            currentLevel === -1 ? 'text-blue-400 font-bold' : 'text-slate-200'
                          }`}
                        >
                          <span>Auto</span>
                          {currentLevel === -1 && <Check className="w-3 h-3" />}
                        </button>
                        {hlsLevels
                          .slice()
                          .reverse()
                          .map((lvl) => (
                            <button
                              key={lvl.index}
                              onClick={() => changeQuality(lvl.index)}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 transition flex items-center justify-between ${
                                currentLevel === lvl.index ? 'text-blue-400 font-bold' : 'text-slate-200'
                              }`}
                            >
                              <span>{lvl.name}</span>
                              {currentLevel === lvl.index && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between gap-2">
                    {/* Left group */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                      <button
                        id="player-playpause-btn"
                        onClick={togglePlay}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition shadow-lg shadow-blue-600/30 active:scale-95"
                        title={isPlaying ? 'Pausar' : 'Reproduzir'}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
                      </button>

                      <button
                        onClick={toggleMute}
                        className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                        title={isMuted ? 'Desmutar' : 'Mutar'}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                      </button>

                      {!isMuted && (
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={volume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="hidden sm:block w-20 h-1 accent-blue-400"
                          title="Volume"
                        />
                      )}

                      <button
                        onClick={handleZapLast}
                        disabled={!lastChannel}
                        className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Voltar ao canal anterior"
                      >
                        <SkipBack className="w-3.5 h-3.5" />
                        Anterior
                      </button>

                      <button
                        onClick={handlePrevChannel}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition text-xs font-mono"
                        title="Canal Anterior (lista)"
                      >
                        ⏮
                      </button>

                      <button
                        onClick={handleNextChannel}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition text-xs font-mono"
                        title="Próximo Canal"
                      >
                        ⏭
                      </button>
                    </div>

                    {/* Right group */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        onClick={() => setShowBrightness(!showBrightness)}
                        className={`p-1.5 sm:p-2 rounded-lg transition ${
                          showBrightness ? 'bg-yellow-500/30 text-yellow-300' : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                        title="Brilho"
                      >
                        <Sun className="w-4 h-4" />
                      </button>

                      {hlsLevels.length > 0 && (
                        <button
                          onClick={() => setShowQualityMenu(!showQualityMenu)}
                          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-mono transition ${
                            showQualityMenu ? 'bg-blue-600/40 text-blue-200' : 'bg-white/10 hover:bg-white/20 text-blue-300'
                          }`}
                          title="Qualidade"
                        >
                          <Gauge className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{currentQualityLabel}</span>
                        </button>
                      )}

                      <button
                        onClick={togglePiP}
                        className={`p-1.5 sm:p-2 rounded-lg transition hidden sm:block ${
                          isPipActive ? 'bg-blue-600/40 text-blue-300' : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                        title="Picture-in-Picture"
                      >
                        <PictureInPicture2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={cycleAspectRatio}
                        className="px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white/10 hover:bg-white/20 text-blue-300 border border-blue-400/30 transition uppercase"
                        title="Alterar Aspect Ratio"
                      >
                        {aspectRatioMode}
                      </button>

                      <button
                        onClick={toggleFullscreen}
                        className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                        title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Player Metadata & Codec Summary Footer */}
          <AnimatePresence mode="wait">
            {activeChannel && (
              <motion.div
                key={`meta-${activeChannel.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="p-4 bg-[#0D1526] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{activeChannel.name}</span>
                    <span className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 border border-slate-700">
                      ID: {activeChannel.id}
                    </span>
                    {usedFormat === 'ts' && (
                      <span className="px-2 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Modo TS
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] truncate max-w-md">
                    URL: {activeChannel.streamUrl}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-300">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-[11px]">Ao Vivo (HLS / M3U8)</span>
                  </div>
                  <button
                    id="fav-btn-player"
                    onClick={() => onToggleFavorite(activeChannel.id)}
                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                      activeChannel.isFavorite
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Adicionar aos Favoritos"
                  >
                    <Star className={`w-4 h-4 ${activeChannel.isFavorite ? 'fill-amber-400' : ''}`} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Channel List */}
        <div className="w-full lg:w-5/12 xl:w-4/12 flex flex-col bg-[#0B1120] overflow-hidden">
          <div className="p-3 bg-[#111A2E] border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold flex items-center gap-2">
              <span>Grade de Canais</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 font-mono text-[10px] font-bold">
                {filteredChannels.length}
              </span>
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Otimizado para D-Pad / Touch
            </span>
          </div>

          {selectedCategory === 'FAVORITOS' && (
            <div className="px-3 py-2 bg-amber-950/40 border-b border-amber-500/30 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-200">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="font-semibold text-[11px] sm:text-xs">
                  {favoriteChannels.length} canal(is) favorito(s)
                </span>
              </div>
              <button
                id="export-favorites-banner-btn"
                onClick={handleExportFavorites}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm active:scale-95 cursor-pointer"
                title="Baixar arquivo JSON com os canais favoritos"
              >
                <Download className="w-3 h-3 text-slate-950" />
                <span>Exportar JSON</span>
              </button>
            </div>
          )}

          <div className="p-2.5 bg-[#0E1528] border-b border-slate-800/80">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
              <input
                id="channel-list-search-input"
                type="text"
                placeholder="Filtrar canais por nome em tempo real..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#162035] border border-slate-700/80 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {searchQuery && (
                <button
                  id="clear-channel-list-search-btn"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition cursor-pointer"
                  title="Limpar filtro"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>
                  {filteredChannels.length === 0
                    ? 'Nenhum canal corresponde ao filtro'
                    : `${filteredChannels.length} canal(is) encontrado(s)`}
                </span>
                {selectedCategory !== 'TODOS' && (
                  <button
                    onClick={() => onSelectCategory('TODOS')}
                    className="text-blue-400 hover:text-blue-300 underline text-[10px] cursor-pointer"
                  >
                    Buscar em todos
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            <AnimatePresence mode="wait">
              {filteredChannels.length === 0 ? (
                <motion.div
                  key="empty-channels"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="col-span-full py-14 text-center text-slate-400 space-y-2.5 px-4"
                >
                  {selectedCategory === 'FAVORITOS' ? (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                        <Star className="w-6 h-6 fill-amber-400/25" />
                      </div>
                      <p className="text-sm font-bold text-slate-200">Nenhum canal favorito ainda</p>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                        Clique na estrela (⭐) no canal para adicioná-lo aos seus favoritos. Você poderá exportar seu backup em JSON quando quiser!
                      </p>
                      <button
                        onClick={() => onSelectCategory('TODOS')}
                        className="inline-flex items-center gap-1.5 mt-2 px-3.5 py-1.5 text-xs rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition cursor-pointer shadow-md shadow-blue-600/20"
                      >
                        <span>Explorar Canais</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <Radio className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-sm font-medium">Nenhum canal encontrado.</p>
                      <p className="text-xs text-slate-500">
                        {searchQuery
                          ? `Nenhum canal com o nome "${searchQuery}" nesta categoria.`
                          : 'Tente selecionar outra categoria ou importar uma nova lista.'}
                      </p>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30 transition cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>Limpar busca</span>
                        </button>
                      )}
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key={`grid-${selectedCategory}-${searchQuery}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5"
                >
                  {filteredChannels.map((channel, index) => {
                    const isSelected = activeChannel?.id === channel.id;
                    const isFocused = focusedIndex === index;

                    return (
                      <motion.div
                        key={channel.id}
                        id={`channel-card-${channel.id}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.25) }}
                        whileHover={{ scale: 1.015 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => switchChannel(channel, index)}
                        className={`group relative p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500/70 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/40'
                            : isFocused
                            ? 'bg-slate-800/90 border-blue-400 ring-2 ring-blue-500/50'
                            : 'bg-[#131C31] hover:bg-[#18233C] border-slate-800/80'
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="activeChannelGlow"
                            className="absolute -left-0.5 top-2.5 bottom-2.5 w-1 bg-blue-500 rounded-r shadow-sm shadow-blue-400"
                            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                          />
                        )}

                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center justify-center p-1 shrink-0 overflow-hidden relative">
                            {channel.logoUrl ? (
                              <img
                                src={channel.logoUrl}
                                alt={channel.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://placehold.co/100x100/1e293b/94a3b8?text=TV';
                                }}
                              />
                            ) : (
                              <Tv className="w-6 h-6 text-slate-500" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h3
                                className={`text-xs font-bold truncate ${
                                  isSelected ? 'text-blue-300' : 'text-slate-100'
                                }`}
                              >
                                {channel.name}
                              </h3>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFavorite(channel.id);
                                }}
                                className="text-slate-500 hover:text-amber-400 p-0.5 transition cursor-pointer"
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    channel.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                                  }`}
                                />
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {channel.groupTitle || 'Geral'}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="inline-block text-[9px] font-mono text-slate-400 uppercase">
                                {channel.streamUrl.endsWith('.m3u8') ? 'HLS' : 'Stream'}
                              </span>
                              {isSelected && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-blue-400">
                                  <span className="flex items-end gap-0.5 h-2.5">
                                    <span className="w-0.5 h-full bg-blue-400 rounded-full animate-pulse" />
                                    <span className="w-0.5 h-2/3 bg-blue-400 rounded-full animate-pulse delay-75" />
                                    <span className="w-0.5 h-4/5 bg-blue-400 rounded-full animate-pulse delay-150" />
                                  </span>
                                  <span>TOCANDO</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      <AnimatePresence>
        {exportNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed top-16 right-5 z-50 max-w-sm sm:max-w-md p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md flex items-start gap-3 text-xs ${
              exportNotification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-amber-950/90 border-amber-500/50 text-amber-200'
            }`}
          >
            {exportNotification.type === 'success' ? (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-xs">
                {exportNotification.type === 'success' ? 'Backup JSON Criado com Sucesso!' : 'Aviso de Favoritos'}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{exportNotification.message}</p>
            </div>
            <button
              onClick={() => setExportNotification(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <TvRemoteOverlay
        isOpen={isRemoteOpen}
        onClose={() => setIsRemoteOpen(false)}
        onNavigate={handleRemoteNavigate}
        onSelect={handleRemoteSelect}
        onBack={() => {
          setIsRemoteOpen(false);
        }}
        onTogglePlay={togglePlay}
        isPlaying={isPlaying}
        onToggleMute={toggleMute}
        isMuted={isMuted}
        onNextChannel={handleNextChannel}
        onPrevChannel={handlePrevChannel}
        onToggleAspectRatio={cycleAspectRatio}
      />
    </div>
  );
};
