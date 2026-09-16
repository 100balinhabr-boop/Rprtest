import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Channel } from '../types';
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
  X
} from 'lucide-react';
import { TvRemoteOverlay } from './TvRemoteOverlay';

interface IptvPlayerViewProps {
  channels: Channel[];
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onOpenImporter: () => void;
  onToggleFavorite: (channelId: string) => void;
}

export const IptvPlayerView: React.FC<IptvPlayerViewProps> = ({
  channels,
  categories,
  selectedCategory,
  onSelectCategory,
  onOpenImporter,
  onToggleFavorite,
}) => {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [aspectRatioMode, setAspectRatioMode] = useState<'fit' | 'fill' | 'zoom'>('fit');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isRemoteOpen, setIsRemoteOpen] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Auto-select first channel on mount or channel list update
  useEffect(() => {
    if (!activeChannel && channels.length > 0) {
      setActiveChannel(channels[0]);
    }
  }, [channels, activeChannel]);

  // Load stream whenever activeChannel changes
  useEffect(() => {
    if (!activeChannel || !videoRef.current) return;

    setPlaybackError(null);
    setIsBuffering(true);

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
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.BUFFER_APPENDING, () => {
        setIsBuffering(true);
      });

      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        setIsBuffering(false);
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
      playerContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
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
      setActiveChannel(filteredChannels[focusedIndex]);
    }
  };

  const handleNextChannel = () => {
    if (!activeChannel || filteredChannels.length === 0) return;
    const curIdx = filteredChannels.findIndex((c) => c.id === activeChannel.id);
    const nextIdx = (curIdx + 1) % filteredChannels.length;
    setActiveChannel(filteredChannels[nextIdx]);
    setFocusedIndex(nextIdx);
  };

  const handlePrevChannel = () => {
    if (!activeChannel || filteredChannels.length === 0) return;
    const curIdx = filteredChannels.findIndex((c) => c.id === activeChannel.id);
    const prevIdx = (curIdx - 1 + filteredChannels.length) % filteredChannels.length;
    setActiveChannel(filteredChannels[prevIdx]);
    setFocusedIndex(prevIdx);
  };

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
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
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
            className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[260px] sm:min-h-[380px]"
          >
            {/* Native Video Element with Aspect Ratio Class */}
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
              onClick={togglePlay}
            />

            {/* Buffering Spinner */}
            {isBuffering && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none z-20">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-200 font-medium mt-3 tracking-wide">
                  Conectando ao Stream HLS...
                </span>
              </div>
            )}

            {/* Error Message Toast / Alert */}
            {playbackError && (
              <div className="absolute top-4 left-4 right-4 z-20 bg-rose-950/90 border border-rose-600/50 p-3 rounded-xl flex items-start gap-2.5 text-rose-200 text-xs shadow-lg">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Aviso de Reprodução Web:</p>
                  <p className="text-rose-300 mt-0.5">{playbackError}</p>
                  <p className="text-[10px] text-rose-400 mt-1">
                    *Nota: No aplicativo nativo Android com o <strong>ExoPlayer</strong> e permissão de rede <code className="bg-rose-900/60 px-1 rounded">usesCleartextTraffic="true"</code>, este fluxo rodará nativamente sem restrições de CORS do navegador.
                  </p>
                </div>
              </div>
            )}

            {/* Channel Logo / Watermark Overlay */}
            {activeChannel && (
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 pointer-events-none">
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
              </div>
            )}

            {/* In-Player Media Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 flex items-center justify-between z-20">
              <div className="flex items-center gap-3">
                <button
                  id="player-playpause-btn"
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition shadow-lg shadow-blue-600/30 active:scale-95"
                  title={isPlaying ? 'Pausar' : 'Reproduzir'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
                </button>

                <button
                  id="player-mute-btn"
                  onClick={toggleMute}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                  title={isMuted ? 'Desmutar' : 'Mutar'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  id="player-prev-btn"
                  onClick={handlePrevChannel}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition font-mono"
                  title="Canal Anterior"
                >
                  Anterior
                </button>

                <button
                  id="player-next-btn"
                  onClick={handleNextChannel}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition font-mono"
                  title="Próximo Canal"
                >
                  Próximo
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="player-aspect-btn"
                  onClick={cycleAspectRatio}
                  className="px-2.5 py-1 text-xs font-mono rounded-lg bg-white/10 hover:bg-white/20 text-blue-300 border border-blue-400/30 transition uppercase"
                  title="Alterar Aspect Ratio (Fit / Fill / Zoom)"
                >
                  {aspectRatioMode}
                </button>

                <button
                  id="player-fullscreen-btn"
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                  title="Tela Cheia"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Player Metadata & Codec Summary Footer */}
          {activeChannel && (
            <div className="p-4 bg-[#0D1526] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
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
                  className={`p-1.5 rounded-lg border transition ${
                    activeChannel.isFavorite
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Adicionar aos Favoritos"
                >
                  <Star className={`w-4 h-4 ${activeChannel.isFavorite ? 'fill-amber-400' : ''}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Channel List (RecyclerView Simulation) */}
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

          {/* Barra de Pesquisa em Tempo Real dedicada na Lista de Canais */}
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
                  className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
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
                    className="text-blue-400 hover:text-blue-300 underline text-[10px]"
                  >
                    Buscar em todos
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5 custom-scrollbar">
            {filteredChannels.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400 space-y-2">
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
                    className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30 transition"
                  >
                    <X className="w-3 h-3" />
                    <span>Limpar busca</span>
                  </button>
                )}
              </div>
            ) : (
              filteredChannels.map((channel, index) => {
                const isSelected = activeChannel?.id === channel.id;
                const isFocused = focusedIndex === index;

                return (
                  <div
                    key={channel.id}
                    id={`channel-card-${channel.id}`}
                    onClick={() => {
                      setActiveChannel(channel);
                      setFocusedIndex(index);
                    }}
                    className={`group relative p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500/70 shadow-lg shadow-blue-500/10'
                        : isFocused
                        ? 'bg-slate-800/90 border-blue-400 ring-2 ring-blue-500/50'
                        : 'bg-[#131C31] hover:bg-[#18233C] border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center justify-center p-1 shrink-0 overflow-hidden">
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
                            className="text-slate-500 hover:text-amber-400 p-0.5 transition"
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
                        <span className="inline-block text-[9px] font-mono text-slate-400 mt-1 uppercase">
                          {channel.streamUrl.endsWith('.m3u8') ? 'HLS' : 'Stream'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Floating Interactive TV Remote Overlay */}
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
