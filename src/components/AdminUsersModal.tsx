import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';
import { Channel, UserAccount } from '../types';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Volume1,
  Maximize2, 
  Minimize2,
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
  PictureInPicture2,
  Activity,
  SkipForward,
  SkipBack,
  SignalHigh,
  ChevronRight
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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [aspectRatioMode, setAspectRatioMode] = useState<'fit' | 'fill' | 'zoom'>('fit');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isRemoteOpen, setIsRemoteOpen] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [showChannelOsd, setShowChannelOsd] = useState<boolean>(false);
  const [exportNotification, setExportNotification] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  // ==== Estados novos para player profissional ====
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPiPActive, setIsPiPActive] = useState<boolean>(false);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [stats, setStats] = useState<{ resolution: string; bitrate: number; bufferHealth: number; droppedFrames: number; level: string }>({
    resolution: '—',
    bitrate: 0,
    bufferHealth: 0,
    droppedFrames: 0,
    level: '—'
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const osdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const volumeSliderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ==== Auto-hide dos controles ====
  const revealControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      // Esconde só se estiver tocando e não estiver com volume ou stats abertos
      setShowControls(prev => {
        return true; // placeholder — decisão real abaixo
      });
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setShowVolumeSlider(false);
      }
    }, 3000);
  }, []);

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

  // Load stream whenever activeChannel changes
  useEffect(() => {
    if (!activeChannel || !videoRef.current) return;

    setPlaybackError(null);
    setIsBuffering(true);
    revealControls();

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    let streamUrl = activeChannel.streamUrl;
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && streamUrl.startsWith('http://')) {
      streamUrl = `/api/proxy-stream?url=${encodeURIComponent(streamUrl)}`;
    }

    if (Hls.isSupported() && (streamUrl.includes('.m3u8') || streamUrl.includes('hls') || streamUrl.startsWith('http') || streamUrl.includes('/api/proxy-stream'))) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        video.play().then(() => {
          setIsPlaying(true);
          revealControls();
        }).catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.BUFFER_APPENDING, () => {
        setIsBuffering(true);
      });

      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        setIsBuffering(false);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        if (hls.levels[data.level]) {
          const lvl = hls.levels[data.level];
          setStats(prev => ({
            ...prev,
            resolution: `${lvl.width}x${lvl.height}`,
            bitrate: Math.round((lvl.bitrate || 0) / 1000),
            level: `Nível ${data.level}`
          }));
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setIsBuffering(false);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setPlaybackError('Erro de rede ao conectar no stream HLS.');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setPlaybackError('Erro nos codecs de áudio/vídeo do stream.');
              hls.recoverMediaError();
              break;
            default:
              setPlaybackError('Fluxo indisponível no momento ou bloqueado por CORS no navegador.');
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        video.play().then(() => {
          setIsPlaying(true);
          revealControls();
        }).catch(() => setIsPlaying(false));
      });
      video.addEventListener('error', () => {
        setIsBuffering(false);
        setPlaybackError('Não foi possível carregar o vídeo nativo.');
      });
    } else {
      video.src = streamUrl;
      video.play().then(() => {
        setIsPlaying(true);
        revealControls();
      }).catch(() => setIsPlaying(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeChannel, revealControls]);

  // Atualiza volume quando slider muda
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    videoRef.current.muted = volume === 0 || isMuted;
  }, [volume, isMuted]);

  // Detecta entrada/saída de fullscreen
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      revealControls();
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [revealControls]);

  // Detecta PiP
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnter = () => setIsPiPActive(true);
    const onLeave = () => setIsPiPActive(false);
    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  // Coleta estatísticas quando painel aberto
  useEffect(() => {
    if (!showStats) {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
      return;
    }
    const collect = () => {
      const video = videoRef.current;
      if (!video) return;
      let bufferHealth = 0;
      try {
        if (video.buffered.length > 0) {
          bufferHealth = video.buffered.end(video.buffered.length - 1) - video.currentTime;
        }
      } catch {}
      const quality = (video as any).getVideoPlaybackQuality?.();
      setStats(prev => ({
        ...prev,
        bufferHealth: Math.max(0, bufferHealth),
        droppedFrames: quality?.droppedVideoFrames ?? 0,
        resolution: video.videoWidth && video.videoHeight ? `${video.videoWidth}x${video.videoHeight}` : prev.resolution,
      }));
    };
    collect();
    statsIntervalRef.current = setInterval(collect, 1000);
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, [showStats]);

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          revealControls();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          revealControls();
          break;
        case 'arrowright':
          e.preventDefault();
          handleNextChannel();
          revealControls();
          break;
        case 'arrowleft':
          e.preventDefault();
          handlePrevChannel();
          revealControls();
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume(v => Math.min(1, +(v + 0.1).toFixed(2)));
          setShowVolumeSlider(true);
          revealControls();
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume(v => Math.max(0, +(v - 0.1).toFixed(2)));
          setShowVolumeSlider(true);
          revealControls();
          break;
        case 'p':
          e.preventDefault();
          togglePiP();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealControls]);

  // Cleanup de timers
  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      if (volumeSliderTimeoutRef.current) clearTimeout(volumeSliderTimeoutRef.current);
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, []);

  const normalizeText = (text: string) =>
    text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

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
      setShowControls(true);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      revealControls();
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    setShowVolumeSlider(true);
    if (volumeSliderTimeoutRef.current) clearTimeout(volumeSliderTimeoutRef.current);
    volumeSliderTimeoutRef.current = setTimeout(() => setShowVolumeSlider(false), 2500);
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    if (v > 0) setIsMuted(false);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
    setShowVolumeSlider(true);
    if (volumeSliderTimeoutRef.current) clearTimeout(volumeSliderTimeoutRef.current);
    volumeSliderTimeoutRef.current = setTimeout(() => setShowVolumeSlider(false), 2500);
  };

  const cycleAspectRatio = () => {
    if (aspectRatioMode === 'fit') setAspectRatioMode('fill');
    else if (aspectRatioMode === 'fill') setAspectRatioMode('zoom');
    else setAspectRatioMode('fit');
    revealControls();
  };

  const toggleFullscreen = async () => {
    if (!playerContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await playerContainerRef.current.requestFullscreen();
        // Tenta travar em paisagem no celular (funciona em alguns Androids)
        try {
          await (screen.orientation as any)?.lock?.('landscape');
        } catch {}
      } else {
        try {
          await (screen.orientation as any)?.unlock?.();
        } catch {}
        await document.exitFullscreen();
      }
    } catch {}
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await (video as any).requestPictureInPicture?.();
      }
    } catch {}
  };

  // Duplo toque / clique no vídeo
  const handleVideoClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Duplo toque → fullscreen
      toggleFullscreen();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    setTimeout(() => {
      if (lastTapRef.current !== 0) {
        // Clique simples → play/pause (só se não virou duplo toque)
        togglePlay();
        lastTapRef.current = 0;
      }
    }, 300);
  };

  const handleMouseMove = () => {
    revealControls();
  };

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
      setActiveChannel(filteredChannels[focusedIndex]);
    }
  };

  const handleNextChannel = () => {
    if (!activeChannel || filteredChannels.length === 0) return;
    const curIdx = filteredChannels.findIndex((c) => c.id === activeChannel.id);
    const nextIdx = (curIdx + 1) % filteredChannels.length;
    setActiveChannel(filteredChannels[nextIdx]);
    setFocusedIndex(nextIdx);
    revealControls();
  };

  const handlePrevChannel = () => {
    if (!activeChannel || filteredChannels.length === 0) return;
    const curIdx = filteredChannels.findIndex((c) => c.id === activeChannel.id);
    const prevIdx = (curIdx - 1 + filteredChannels.length) % filteredChannels.length;
    setActiveChannel(filteredChannels[prevIdx]);
    setFocusedIndex(prevIdx);
    revealControls();
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
        ? { id: currentUser.id, username: currentUser.username, name: currentUser.name }
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

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

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

          <button
            id="open-importer-btn"
            onClick={onOpenImporter}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition active:scale-95"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Importar Lista</span>
          </button>

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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Video Player Stage */}
        <div className="w-full lg:w-7/12 xl:w-8/12 flex flex-col bg-black relative border-b lg:border-b-0 lg:border-r border-slate-800">
          <div
            ref={playerContainerRef}
            className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[260px] sm:min-h-[380px] group/player"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              if (isPlaying && !showVolumeSlider && !showStats) {
                setShowControls(false);
              }
            }}
            onTouchStart={revealControls}
            onClick={handleVideoClick}
          >
            <video
              ref={videoRef}
              playsInline
              className={`w-full h-full ${
                aspectRatioMode === 'fit'
                  ? 'object-contain'
                  : aspectRatioMode === 'fill'
                  ? 'object-fill'
                  : 'object-cover'
              }`}
            />

            {/* Buffering Spinner */}
            <AnimatePresence>
              {isBuffering && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none z-20"
                >
                  <div className="relative">
                    <div className="w-14 h-14 border-4 border-white/10 rounded-full" />
                    <div className="absolute inset-0 w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <span className="text-xs text-slate-200 font-medium mt-3 tracking-wide">
                    Carregando stream...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botão central de play quando pausado (só aparece quando não está tocando) */}
            <AnimatePresence>
              {!isPlaying && !isBuffering && !playbackError && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                  className="absolute inset-0 z-30 flex items-center justify-center group/btn cursor-pointer"
                  aria-label="Reproduzir"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/55 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl transition-transform group-hover/btn:scale-110 group-active/btn:scale-95">
                    <Play className="w-9 h-9 sm:w-10 sm:h-10 text-white fill-white translate-x-1" />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Error Alert */}
            <AnimatePresence>
              {playbackError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-4 left-4 right-4 z-40 bg-rose-950/95 border border-rose-600/50 p-3 rounded-xl flex items-start gap-2.5 text-rose-200 text-xs shadow-lg"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Aviso de Reprodução Web:</p>
                    <p className="text-rose-300 mt-0.5">{playbackError}</p>
                    <p className="text-[10px] text-rose-400 mt-1">
                      *Nota: No aplicativo nativo Android com <strong>ExoPlayer</strong> e <code className="bg-rose-900/60 px-1 rounded">usesCleartextTraffic="true"</code>, este fluxo rodará sem restrições de CORS.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ==== CONTROLES AUTO-HIDE ==== */}
            <AnimatePresence>
              {showControls && (
                <>
                  {/* Top gradient + título do canal */}
                  <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-0 inset-x-0 z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-3 sm:p-4 flex items-center justify-between gap-3 pointer-events-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {activeChannel?.logoUrl ? (
                        <img
                          src={activeChannel.logoUrl}
                          alt={activeChannel.name}
                          className="w-8 h-8 object-contain rounded bg-white/10 p-0.5 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center shrink-0">
                          <Tv className="w-4 h-4 text-white/80" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-white truncate">{activeChannel?.name || 'Sem canal'}</h2>
                          <span className="flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Ao Vivo</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-white/60 truncate">{activeChannel?.groupTitle || 'Geral'}</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Bottom bar de controles */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-3 px-3 sm:px-4"
                  >
                    {/* Barra "ao vivo" fake (progresso não se aplica a live) */}
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-white/15 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-red-500 rounded-full" />
                      </div>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        AO VIVO
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {/* Esquerda: play + prev + next + volume */}
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <button
                          onClick={togglePlay}
                          className="w-10 h-10 rounded-full bg-white text-slate-900 hover:bg-white/90 flex items-center justify-center transition shadow-lg active:scale-95 shrink-0"
                          title={isPlaying ? 'Pausar (espaço)' : 'Reproduzir (espaço)'}
                        >
                          {isPlaying ? <Pause className="w-4 h-4 fill-slate-900" /> : <Play className="w-4 h-4 fill-slate-900 translate-x-0.5" />}
                        </button>

                        <button
                          onClick={handlePrevChannel}
                          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white flex items-center justify-center transition active:scale-95"
                          title="Canal anterior (←)"
                        >
                          <SkipBack className="w-4 h-4" />
                        </button>

                        <button
                          onClick={handleNextChannel}
                          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white flex items-center justify-center transition active:scale-95"
                          title="Próximo canal (→)"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>

                        {/* Volume */}
                        <div
                          className="relative flex items-center"
                          onMouseEnter={() => setShowVolumeSlider(true)}
                          onMouseLeave={() => {
                            if (volumeSliderTimeoutRef.current) clearTimeout(volumeSliderTimeoutRef.current);
                            volumeSliderTimeoutRef.current = setTimeout(() => setShowVolumeSlider(false), 400);
                          }}
                        >
                          <button
                            onClick={toggleMute}
                            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white flex items-center justify-center transition active:scale-95"
                            title={isMuted ? 'Ativar som (M)' : 'Mutar (M)'}
                          >
                            <VolumeIcon className="w-4 h-4" />
                          </button>

                          <AnimatePresence>
                            {showVolumeSlider && (
                              <motion.div
                                initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                                animate={{ opacity: 1, width: 96, marginLeft: 8 }}
                                exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                                transition={{ duration: 0.18 }}
                                className="overflow-hidden"
                              >
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={isMuted ? 0 : volume}
                                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                  className="w-24 h-1 accent-blue-500 cursor-pointer"
                                  aria-label="Volume"
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Direita: aspect, stats, pip, fullscreen */}
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                          onClick={cycleAspectRatio}
                          className="hidden sm:flex px-2.5 h-9 text-[11px] font-mono rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-blue-200 items-center justify-center uppercase transition active:scale-95"
                          title="Alternar proporção (Fit / Fill / Zoom)"
                        >
                          {aspectRatioMode}
                        </button>

                        <button
                          onClick={() => { setShowStats(s => !s); revealControls(); }}
                          className={`w-9 h-9 rounded-full backdrop-blur-md border flex items-center justify-center transition active:scale-95 ${
                            showStats
                              ? 'bg-blue-600/30 border-blue-400/50 text-blue-200'
                              : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
                          }`}
                          title="Estatísticas de reprodução"
                        >
                          <Activity className="w-4 h-4" />
                        </button>

                        <button
                          onClick={togglePiP}
                          className={`w-9 h-9 rounded-full backdrop-blur-md border flex items-center justify-center transition active:scale-95 ${
                            isPiPActive
                              ? 'bg-blue-600/30 border-blue-400/50 text-blue-200'
                              : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
                          }`}
                          title="Picture-in-Picture (P)"
                        >
                          <PictureInPicture2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={toggleFullscreen}
                          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white flex items-center justify-center transition active:scale-95"
                          title="Tela cheia (F)"
                        >
                          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Painel de estatísticas (overlay) */}
            <AnimatePresence>
              {showStats && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-16 right-3 z-30 bg-black/85 backdrop-blur-md border border-white/15 rounded-xl p-3 w-56 text-[11px] text-white shadow-2xl font-mono"
                >
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <SignalHigh className="w-3.5 h-3.5 text-emerald-400" />
                      Estatísticas
                    </span>
                    <button
                      onClick={() => setShowStats(false)}
                      className="text-white/60 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-white/60">Resolução</span>
                      <span className="text-white">{stats.resolution}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Bitrate</span>
                      <span className="text-white">{stats.bitrate ? `${stats.bitrate} kbps` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Buffer</span>
                      <span className={stats.bufferHealth > 5 ? 'text-emerald-400' : stats.bufferHealth > 2 ? 'text-amber-400' : 'text-rose-400'}>
                        {stats.bufferHealth.toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Frames perdidos</span>
                      <span className={stats.droppedFrames > 0 ? 'text-amber-400' : 'text-white'}>
                        {stats.droppedFrames}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Modo</span>
                      <span className="text-white uppercase">{aspectRatioMode}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Channel Logo / Watermark Overlay (só quando controles ocultos) */}
            <AnimatePresence>
              {!showControls && activeChannel && (
                <motion.div
                  key={`wm-${activeChannel.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/50 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10 pointer-events-none"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-white/90 truncate max-w-[180px]">
                    {activeChannel.name}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Channel Switch OSD Banner */}
            <AnimatePresence>
              {showChannelOsd && activeChannel && (
                <motion.div
                  key={`osd-${activeChannel.id}`}
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.96 }}
                  transition={{ duration: 0.26, ease: 'easeOut' }}
                  className="absolute bottom-24 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-sm z-40 bg-slate-950/90 backdrop-blur-md border border-blue-500/40 rounded-2xl p-3.5 shadow-2xl pointer-events-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-inner">
                      {activeChannel.logoUrl ? (
                        <img
                          src={activeChannel.logoUrl}
                          alt={activeChannel.name}
                          className="w-full h-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
          </div>

          {/* Player Metadata Footer */}
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
                        Clique na estrela (⭐) no canal para adicioná-lo aos seus favoritos.
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
                        onClick={() => {
                          setActiveChannel(channel);
                          setFocusedIndex(index);
                        }}
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
        onBack={() => { setIsRemoteOpen(false); }}
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
