import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';
import { Channel, UserAccount } from '../types';
import { VodItem, FEATURED_MOVIES, SAMPLE_MOVIES, SAMPLE_SERIES } from '../data/vodData';
import {
  Film, Tv, PlaySquare, Settings, Search, Menu, ChevronRight, ChevronLeft,
  Star, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, X,
  Bookmark, Clock, Sparkles, Check, ShieldCheck, Calendar, LogOut,
  ExternalLink, Crown, AlertCircle, Code2, Folder, Loader2,
  Sun, PictureInPicture2, Gauge, RefreshCw, SkipBack, Plus
} from 'lucide-react';

interface ClientPortalViewProps {
  channels: Channel[];
  categories: string[];
  currentUser: UserAccount | null;
  onLogout: () => void;
  onOpenImporter?: () => void;
  onToggleFavorite: (channelId: string) => void;
  onSwitchToAdmin?: () => void;
  isAdminPreview?: boolean;
}

interface ClientTabConfig {
  id: 'movies' | 'series' | 'live' | 'settings';
  label: string;
  visible: boolean;
}

interface ClientBranding {
  appName: string;
  accentColor: string;
  logoUrl: string;
  footerText: string;
}

const DEFAULT_CLIENT_TABS: ClientTabConfig[] = [
  { id: 'movies', label: 'FILMES', visible: true },
  { id: 'series', label: 'SÉRIES', visible: true },
  { id: 'live', label: 'TV AO VIVO', visible: true },
  { id: 'settings', label: 'CONFIGURAÇÕES', visible: true },
];

const DEFAULT_BRANDING: ClientBranding = {
  appName: 'RPR TV',
  accentColor: '#dc2626',
  logoUrl: '',
  footerText: 'Transmissão HD • Canais ao Vivo • Player Rápido',
};

type ClientTab = 'movies' | 'series' | 'live' | 'settings';

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildHeroSlides(items: VodItem[]): VodItem[] {
  if (!items || items.length === 0) return [];
  const sorted = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  let topPool = sorted.filter((m) => (m.rating || 0) >= 7);
  if (topPool.length < 3) topPool = sorted;
  const top3 = topPool.slice(0, 3);
  const topIds = new Set(top3.map((t) => t.id));
  const poolWithoutTop = items.filter((m) => !topIds.has(m.id));
  const shuffled = shuffleArray(poolWithoutTop);
  return [...top3, ...shuffled.slice(0, 5)].slice(0, 8);
}

function isHlsUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.m3u8') || lower.includes('/hls/') || lower.includes('format=m3u8');
}

function isDirectVideoUrl(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.mp4') || lower.endsWith('.mkv') || lower.endsWith('.avi') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.m4v');
}

function buildProxyUrl(url: string): string {
  return `/api/proxy-stream?url=${encodeURIComponent(url)}`;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `#${clean}${a}`;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  channels,
  categories,
  currentUser,
  onLogout,
  onOpenImporter,
  onToggleFavorite,
  onSwitchToAdmin,
  isAdminPreview = false,
}) => {
  const [activeTab, setActiveTab] = useState<ClientTab>('live');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [clientTabs, setClientTabs] = useState<ClientTabConfig[]>(DEFAULT_CLIENT_TABS);
  const [branding, setBranding] = useState<ClientBranding>(DEFAULT_BRANDING);

  const accent = branding.accentColor;

  useEffect(() => {
    const token = localStorage.getItem('iptv_auth_token') || sessionStorage.getItem('iptv_auth_token') || '';
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    fetch('/api/client-config', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (Array.isArray(data.clientTabs) && data.clientTabs.length > 0) {
            setClientTabs(data.clientTabs);
          }
          if (data.branding) {
            setBranding({ ...DEFAULT_BRANDING, ...data.branding });
          }
        }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    const current = clientTabs.find(t => t.id === activeTab);
    if (!current || !current.visible) {
      const firstVisible = clientTabs.find(t => t.visible);
      if (firstVisible) setActiveTab(firstVisible.id);
    }
  }, [clientTabs]);

  const [nowPlaying, setNowPlaying] = useState<{
    title: string;
    streamUrl: string;
    category?: string;
    logoUrl?: string;
    type: 'live' | 'vod';
    item?: Channel | VodItem;
  } | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [lastChannel, setLastChannel] = useState<Channel | null>(null);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(1);
  const [showBrightness, setShowBrightness] = useState<boolean>(false);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [hlsLevels, setHlsLevels] = useState<Array<{ index: number; name: string }>>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [usedFormat, setUsedFormat] = useState<'m3u8' | 'ts'>('m3u8');

  const [recentlyWatched, setRecentlyWatched] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`iptv_recent_${currentUser?.id || 'guest'}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const isXtream = useMemo(() => {
    const pUrl = currentUser?.playlistUrl || '';
    return pUrl.includes('username=') && pUrl.includes('password=');
  }, [currentUser?.playlistUrl]);

  const [xtreamCategories, setXtreamCategories] = useState<{
    live: Array<{ id: string; name: string }>;
    vod: Array<{ id: string; name: string }>;
    series: Array<{ id: string; name: string }>;
  }>({ live: [], vod: [], series: [] });

  const [loadingCats, setLoadingCats] = useState<boolean>(false);
  const [selectedLiveCat, setSelectedLiveCat] = useState<{ id: string; name: string } | null>(null);
  const [selectedVodCat, setSelectedVodCat] = useState<{ id: string; name: string } | null>(null);
  const [selectedSeriesCat, setSelectedSeriesCat] = useState<{ id: string; name: string } | null>(null);

  const [xtreamStreamsCache, setXtreamStreamsCache] = useState<Record<string, any[]>>({});
  const [loadingStreams, setLoadingStreams] = useState<boolean>(false);

  const [seriesModal, setSeriesModal] = useState<{
    isOpen: boolean;
    series: any | null;
    info?: any;
    seasons: any[];
    episodes: Record<string, any[]>;
    selectedSeason: number;
    loading: boolean;
  }>({
    isOpen: false,
    series: null,
    seasons: [],
    episodes: {},
    selectedSeason: 1,
    loading: false,
  });

  useEffect(() => {
    if (!isXtream || !currentUser?.playlistUrl) return;
    const targetType = activeTab === 'movies' ? 'vod' : activeTab === 'series' ? 'series' : 'live';
    if (xtreamCategories[targetType].length > 0) return;

    let isMounted = true;
    setLoadingCats(true);

    fetch('/api/xtream/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUser.playlistUrl, type: targetType }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.categories)) {
          setXtreamCategories((prev) => ({ ...prev, [targetType]: data.categories }));
          if (targetType === 'vod' && data.categories.length > 0 && !selectedVodCat) {
            setSelectedVodCat(data.categories[0]);
            loadStreamsForCategory('vod', data.categories[0].id);
          } else if (targetType === 'series' && data.categories.length > 0 && !selectedSeriesCat) {
            setSelectedSeriesCat(data.categories[0]);
            loadStreamsForCategory('series', data.categories[0].id);
          }
        }
      })
      .catch((err) => console.error('Erro ao buscar categorias Xtream:', err))
      .finally(() => {
        if (isMounted) setLoadingCats(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, isXtream, currentUser?.playlistUrl]);

  const loadStreamsForCategory = async (type: 'live' | 'vod' | 'series', catId: string) => {
    const cacheKey = `${type}_${catId}`;
    if (xtreamStreamsCache[cacheKey]) return;

    setLoadingStreams(true);
    try {
      const res = await fetch('/api/xtream/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentUser?.playlistUrl,
          type,
          categoryId: catId,
          limit: 5000,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setXtreamStreamsCache((prev) => ({ ...prev, [cacheKey]: data.items }));
      }
    } catch (err) {
      console.error('Erro ao carregar streams da categoria:', err);
    } finally {
      setLoadingStreams(false);
    }
  };

  const handleSelectLiveCategory = (cat: { id: string; name: string }) => {
    setSelectedLiveCat(cat);
    setActiveCategory(cat.name);
    loadStreamsForCategory('live', cat.id);
  };

  const handleSelectVodCategory = (cat: { id: string; name: string }) => {
    setSelectedVodCat(cat);
    loadStreamsForCategory('vod', cat.id);
  };

  const handleSelectSeriesCategory = (cat: { id: string; name: string }) => {
    setSelectedSeriesCat(cat);
    loadStreamsForCategory('series', cat.id);
  };

  const handleOpenSeriesModal = async (seriesItem: any) => {
    const sId = seriesItem.seriesId || String(seriesItem.id).replace('series_', '');
    setSeriesModal({ isOpen: true, series: seriesItem, seasons: [], episodes: {}, selectedSeason: 1, loading: true });

    try {
      const res = await fetch('/api/xtream/series-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: currentUser?.playlistUrl, seriesId: sId }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const seasons = data.data.seasons || [];
        const episodes = data.data.episodes || {};
        const firstSeason = seasons[0]?.season_number ? Number(seasons[0].season_number) : 1;
        setSeriesModal({ isOpen: true, series: seriesItem, info: data.data.info, seasons, episodes, selectedSeason: firstSeason, loading: false });
      } else {
        setSeriesModal((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Erro ao buscar episódios da série:', err);
      setSeriesModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handlePlayEpisode = (ep: any) => {
    const ext = ep.container_extension || 'mp4';
    let baseUrl = '', username = '', password = '';
    try {
      const parsedUrl = new URL(currentUser?.playlistUrl || '');
      baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      username = parsedUrl.searchParams.get('username') || '';
      password = parsedUrl.searchParams.get('password') || '';
    } catch {}

    const streamUrl = `${baseUrl}/series/${username}/${password}/${ep.id}.${ext}`;

    setNowPlaying({
      title: `${seriesModal.series?.title || 'Série'} - ${ep.title || `Episódio ${ep.episode_num}`}`,
      streamUrl,
      category: seriesModal.series?.genre || 'Série',
      logoUrl: ep.info?.movie_image || seriesModal.series?.posterUrl,
      type: 'vod',
      item: {
        id: `ep_${ep.id}`,
        title: ep.title || `Episódio ${ep.episode_num}`,
        type: 'series',
        posterUrl: ep.info?.movie_image || seriesModal.series?.posterUrl || '',
        streamUrl,
        rating: 4.8, year: 2024,
        genre: seriesModal.series?.genre || 'Séries',
        category: 'Séries',
        synopsis: ep.info?.plot || '',
      },
    });

    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { window.scrollTo(0, 0); }
    setSeriesModal((prev) => ({ ...prev, isOpen: false }));
  };

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (activeTab !== 'movies' && activeTab !== 'series') return;
    const interval = setInterval(() => setActiveSlide((prev) => (prev + 1) % 8), 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const scheduleHideControls = () => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => { if (isPlaying) setControlsVisible(false); }, 3500);
  };

  const showControlsTemporarily = () => {
    setControlsVisible(true);
    scheduleHideControls();
  };

  useEffect(() => {
    if (isPlaying) scheduleHideControls();
    else { setControlsVisible(true); if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); }
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [isPlaying]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

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
  }, [videoRef.current]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.style.filter = `brightness(${brightness})`;
  }, [brightness]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  const tryFormatFallback = () => {
    if (!nowPlaying) return;
    if (usedFormat === 'm3u8' && nowPlaying.streamUrl.includes('.m3u8')) {
      setUsedFormat('ts');
      setReconnectAttempt(0);
      setPlayerError('Tentando formato alternativo (.ts)...');
      setTimeout(() => {
        const tsUrl = nowPlaying.streamUrl.replace('.m3u8', '.ts');
        if (videoRef.current) {
          if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
          videoRef.current.src = buildProxyUrl(tsUrl);
          videoRef.current.play().then(() => {
            setIsPlaying(true); setPlayerError(null); setIsReconnecting(false);
          }).catch(() => setPlayerError('Formato alternativo também falhou.'));
        }
      }, 800);
    } else {
      setPlayerError('Stream indisponível. Tente novamente mais tarde.');
    }
  };

  useEffect(() => {
    if (!nowPlaying || !videoRef.current) return;

    setPlayerError(null);
    setIsBuffering(true);
    setIsReconnecting(false);
    setReconnectAttempt(0);
    setUsedFormat('m3u8');

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const video = videoRef.current;
    const originalUrl = nowPlaying.streamUrl;
    const proxyUrl = buildProxyUrl(originalUrl);

    const isHls = isHlsUrl(originalUrl);
    const isDirect = isDirectVideoUrl(originalUrl);

    if (Hls.isSupported() && isHls && !isDirect) {
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

      hls.loadSource(proxyUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsBuffering(false);
        const levels = (data.levels || []).map((lvl: any, idx: number) => ({
          index: idx,
          name: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}kbps`,
        }));
        setHlsLevels(levels);
        setCurrentLevel(hls.currentLevel);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setCurrentLevel(data.level));
      hls.on(Hls.Events.BUFFER_APPENDING, () => setIsBuffering(true));
      hls.on(Hls.Events.BUFFER_APPENDED, () => setIsBuffering(false));

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        setIsBuffering(false);

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          const attempt = reconnectAttempt + 1;
          if (attempt <= 3) {
            setIsReconnecting(true);
            setReconnectAttempt(attempt);
            setPlayerError(`Conexão caiu. Reconectando... (${attempt}/3)`);
            hls.stopLoad();
            reconnectTimerRef.current = setTimeout(() => {
              try {
                hls.startLoad();
                setIsReconnecting(false);
                setPlayerError(null);
              } catch { tryFormatFallback(); }
            }, 2000);
          } else {
            tryFormatFallback();
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setPlayerError('Ajustando codecs de reprodução...');
          hls.recoverMediaError();
        } else {
          setPlayerError('Stream indisponível ou bloqueado pela operadora.');
          hls.destroy();
        }
      });

      hlsRef.current = hls;
      return () => {
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      };
    }

    const onLoaded = () => {
      setIsBuffering(false);
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    };
    const onErr = () => {
      setIsBuffering(false);
      setPlayerError('Tentando reconectar...');
      if (Hls.isSupported()) {
        try {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(proxyUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setPlayerError(null);
            video.play().then(() => setIsPlaying(true)).catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              hls.destroy();
              setPlayerError('Este arquivo usa um codec não suportado pelo navegador. No app Android rodaria normal.');
            }
          });
          hlsRef.current = hls;
        } catch {
          setPlayerError('Este arquivo usa um codec não suportado pelo navegador.');
        }
      } else {
        setPlayerError('Este arquivo usa um codec não suportado pelo navegador.');
      }
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onErr);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onLoaded);

    try {
      video.src = proxyUrl;
      video.load();
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } catch {
      setIsBuffering(false);
      setPlayerError('Erro ao definir a fonte do vídeo.');
    }

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onErr);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onLoaded);
    };
  }, [nowPlaying]);

  const handlePlayChannel = (channel: Channel) => {
    if (nowPlaying?.item && (nowPlaying.item as any).id !== channel.id && nowPlaying.type === 'live') {
      setLastChannel(nowPlaying.item as Channel);
    }
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { window.scrollTo(0, 0); }
    setNowPlaying({
      title: channel.name, streamUrl: channel.streamUrl,
      category: channel.groupTitle || 'Geral', logoUrl: channel.logoUrl,
      type: 'live', item: channel,
    });

    setRecentlyWatched((prev) => {
      const filtered = prev.filter((id) => id !== channel.id);
      const updated = [channel.id, ...filtered].slice(0, 20);
      try { localStorage.setItem(`iptv_recent_${currentUser?.id || 'guest'}`, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handlePlayVod = (item: VodItem) => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { window.scrollTo(0, 0); }
    setNowPlaying({
      title: item.title, streamUrl: item.streamUrl,
      category: item.genre, logoUrl: item.posterUrl,
      type: 'vod', item: item,
    });
  };

  const favoriteChannels = useMemo(() => channels.filter((c) => c.isFavorite), [channels]);

  const recentChannels = useMemo(() => {
    const map = new Map(channels.map((c) => [c.id, c]));
    return recentlyWatched.map((id) => map.get(id)).filter(Boolean) as Channel[];
  }, [channels, recentlyWatched]);

  const { playlistMovies, playlistSeries, liveChannelsList } = useMemo(() => {
    const movies: Channel[] = [];
    const series: Channel[] = [];
    const live: Channel[] = [];
    for (const ch of channels) {
      const group = (ch.groupTitle || '').toUpperCase();
      if (group.includes('FILME') || group.includes('MOVIE') || group.includes('CINEMA') || group.includes('VOD') || ch.streamUrl.endsWith('.mp4') || ch.streamUrl.endsWith('.mkv')) {
        movies.push(ch);
      } else if (group.includes('SERIE') || group.includes('TEMPORADA') || group.includes('EPISODIO') || group.includes('NOVELA')) {
        series.push(ch);
      } else {
        live.push(ch);
      }
    }
    return { playlistMovies: movies, playlistSeries: series, liveChannelsList: live.length > 0 ? live : channels };
  }, [channels]);

  const allMovies = useMemo<VodItem[]>(() => {
    const list = [...SAMPLE_MOVIES];
    if (playlistMovies.length > 0) {
      playlistMovies.forEach((m) => {
        list.push({
          id: m.id, title: m.name, type: 'movie',
          posterUrl: m.logoUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
          streamUrl: m.streamUrl, rating: 4.2, year: 2024,
          genre: m.groupTitle || 'Filmes M3U', category: 'Playlist',
          synopsis: `Título importado da lista M3U: ${m.name}`, badge: 'M3U VOD',
        });
      });
    }
    return list;
  }, [playlistMovies]);

  const displayedMovies = useMemo(() => {
    if (isXtream && selectedVodCat) {
      const items = (xtreamStreamsCache[`vod_${selectedVodCat.id}`] || []) as VodItem[];
      if (!searchQuery.trim()) return items;
      const query = searchQuery.toLowerCase();
      return items.filter((m) => m.title.toLowerCase().includes(query) || (m.genre && m.genre.toLowerCase().includes(query)));
    }
    if (!searchQuery.trim()) return allMovies;
    const query = searchQuery.toLowerCase();
    return allMovies.filter((m) => m.title.toLowerCase().includes(query) || m.genre.toLowerCase().includes(query));
  }, [isXtream, selectedVodCat, xtreamStreamsCache, allMovies, searchQuery]);

  const allSeries = useMemo<VodItem[]>(() => {
    const list = [...SAMPLE_SERIES];
    if (playlistSeries.length > 0) {
      playlistSeries.forEach((s) => {
        list.push({
          id: s.id, title: s.name, type: 'series',
          posterUrl: s.logoUrl || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=600&q=80',
          streamUrl: s.streamUrl, rating: 4.5, year: 2024,
          genre: s.groupTitle || 'Séries M3U', category: 'Playlist',
          synopsis: `Série importada da lista M3U: ${s.name}`,
          badge: 'M3U SÉRIE', duration: '1 Temporada',
        });
      });
    }
    return list;
  }, [playlistSeries]);

  const displayedSeries = useMemo(() => {
    if (isXtream && selectedSeriesCat) {
      const items = (xtreamStreamsCache[`series_${selectedSeriesCat.id}`] || []) as VodItem[];
      if (!searchQuery.trim()) return items;
      const query = searchQuery.toLowerCase();
      return items.filter((s) => s.title.toLowerCase().includes(query) || (s.genre && s.genre.toLowerCase().includes(query)));
    }
    if (!searchQuery.trim()) return allSeries;
    const query = searchQuery.toLowerCase();
    return allSeries.filter((s) => s.title.toLowerCase().includes(query) || s.genre.toLowerCase().includes(query));
  }, [isXtream, selectedSeriesCat, xtreamStreamsCache, allSeries, searchQuery]);

  const movieHeroSlides = useMemo(() => buildHeroSlides(displayedMovies), [displayedMovies.length, selectedVodCat?.id]);
  const seriesHeroSlides = useMemo(() => buildHeroSlides(displayedSeries), [displayedSeries.length, selectedSeriesCat?.id]);

  const channelsForSelectedCategory = useMemo(() => {
    if (isXtream && selectedLiveCat && activeCategory === selectedLiveCat.name) {
      const items = (xtreamStreamsCache[`live_${selectedLiveCat.id}`] || []) as Channel[];
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return items.filter((c) => c.name.toLowerCase().includes(q));
      }
      return items;
    }
    let list: Channel[] = [];
    if (!activeCategory || activeCategory === 'Todos') list = liveChannelsList;
    else if (activeCategory === 'Favoritos') list = favoriteChannels;
    else if (activeCategory === 'Último assistido') list = recentChannels;
    else list = liveChannelsList.filter((c) => (c.groupTitle || 'Sem Categoria') === activeCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter((c) => c.name.toLowerCase().includes(q) || (c.groupTitle && c.groupTitle.toLowerCase().includes(q)));
    }
    return list;
  }, [isXtream, selectedLiveCat, activeCategory, xtreamStreamsCache, liveChannelsList, favoriteChannels, recentChannels, searchQuery]);

  const [channelDisplayLimit, setChannelDisplayLimit] = useState<number>(80);
  const [movieDisplayLimit, setMovieDisplayLimit] = useState<number>(48);
  const [seriesDisplayLimit, setSeriesDisplayLimit] = useState<number>(48);

  useEffect(() => setChannelDisplayLimit(80), [activeCategory, searchQuery]);
  useEffect(() => setMovieDisplayLimit(48), [searchQuery, selectedVodCat?.id]);
  useEffect(() => setSeriesDisplayLimit(48), [searchQuery, selectedSeriesCat?.id]);

  const visibleChannels = useMemo(() => channelsForSelectedCategory.slice(0, channelDisplayLimit), [channelsForSelectedCategory, channelDisplayLimit]);
  const visibleMovies = useMemo(() => displayedMovies.slice(0, movieDisplayLimit), [displayedMovies, movieDisplayLimit]);
  const visibleSeries = useMemo(() => displayedSeries.slice(0, seriesDisplayLimit), [displayedSeries, seriesDisplayLimit]);

  const categoryFolderItems = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ch of liveChannelsList) {
      const grp = ch.groupTitle || 'CANAIS | Variados';
      counts[grp] = (counts[grp] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [liveChannelsList]);

  const expirationInfo = useMemo(() => {
    if (!currentUser?.expirationDate) {
      return { status: 'Ativo Ilimitado', daysLeft: 999, isExpiringSoon: false, isExpired: false, label: 'Vitalício' };
    }
    const expDate = new Date(currentUser.expirationDate);
    const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const isExpired = daysLeft <= 0;
    const isExpiringSoon = daysLeft <= 5 && !isExpired;
    const formattedDate = expDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return {
      status: isExpired ? 'Vencido' : isExpiringSoon ? 'Vencendo em Breve' : 'Plano Ativo',
      daysLeft, isExpiringSoon, isExpired, label: formattedDate,
    };
  }, [currentUser?.expirationDate]);

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
        if (screen.orientation && (screen.orientation as any).lock) (screen.orientation as any).lock('landscape').catch(() => {});
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if ((videoRef.current as any).requestPictureInPicture) await (videoRef.current as any).requestPictureInPicture();
      else { setPlayerError('PiP não suportado neste navegador.'); setTimeout(() => setPlayerError(null), 3000); }
    } catch {
      setPlayerError('Não foi possível ativar o PiP agora.');
      setTimeout(() => setPlayerError(null), 3000);
    }
  };

  const changeQuality = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentLevel(levelIndex);
      setShowQualityMenu(false);
    }
  };

  const handleZapLast = () => {
    if (!lastChannel || !nowPlaying || nowPlaying.type !== 'live') return;
    const curChannel = nowPlaying.item as Channel | undefined;
    setNowPlaying({
      title: lastChannel.name, streamUrl: lastChannel.streamUrl,
      category: lastChannel.groupTitle || 'Geral', logoUrl: lastChannel.logoUrl,
      type: 'live', item: lastChannel,
    });
    if (curChannel && curChannel.streamUrl) setLastChannel(curChannel);
  };

  const renderHero = (slides: VodItem[], isSeries: boolean) => {
    if (slides.length === 0) return null;
    const totalSlides = slides.length;

    return (
      <div className="relative w-full overflow-hidden pt-2 pb-1">
        <div className="relative flex items-center justify-center min-h-[340px] sm:min-h-[400px]">
          {slides.map((item, idx) => {
            const isCurrent = idx === activeSlide % totalSlides;
            const isPrev = idx === (activeSlide - 1 + totalSlides) % totalSlides;
            const isNext = idx === (activeSlide + 1) % totalSlides;
            if (!isCurrent && !isPrev && !isNext) return null;

            return (
              <div
                key={`${isSeries ? 's' : 'm'}-hero-${item.id}-${idx}`}
                onClick={() => {
                  if (isCurrent) { if (isSeries && isXtream) handleOpenSeriesModal(item); else handlePlayVod(item); }
                  else setActiveSlide(idx);
                }}
                className={`absolute transition-all duration-500 ease-out cursor-pointer rounded-2xl overflow-hidden shadow-2xl border ${
                  isCurrent
                    ? 'z-20 w-[78%] sm:w-[65%] h-[320px] sm:h-[390px] scale-100 opacity-100'
                    : isPrev
                    ? 'z-10 w-[65%] sm:w-[50%] h-[270px] sm:h-[330px] -translate-x-[45%] scale-90 opacity-40 border-slate-700/50'
                    : 'z-10 w-[65%] sm:w-[50%] h-[270px] sm:h-[330px] translate-x-[45%] scale-90 opacity-40 border-slate-700/50'
                }`}
                style={isCurrent ? { borderColor: hexWithAlpha(accent, 0.6), boxShadow: `0 20px 50px -12px ${hexWithAlpha(accent, 0.5)}` } : {}}
              >
                <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-between p-4 sm:p-5">
                  <div className="flex items-start justify-between">
                    <div className="text-white font-black text-sm sm:text-base px-2.5 py-1 rounded-md shadow-md" style={{ background: accent }}>
                      {idx + 1}
                    </div>
                    {item.badge && (
                      <span className="bg-black/60 backdrop-blur-md text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  {isCurrent && (
                    <div className="space-y-1.5 text-center">
                      <p className="text-[10px] sm:text-xs font-semibold tracking-widest uppercase drop-shadow" style={{ color: accent }}>
                        JÁ DISPONÍVEL
                      </p>
                      <h2 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wider drop-shadow-md">
                        {item.title}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-slate-300 line-clamp-1 font-medium">{item.synopsis}</p>

                      <div className="flex items-center justify-center gap-1 pt-1">
                        {[...Array(5)].map((_, s) => <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                      </div>

                      <div className="pt-2 flex justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSeries && isXtream) handleOpenSeriesModal(item);
                            else handlePlayVod(item);
                          }}
                          className="px-4 py-1.5 rounded-full text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition active:scale-95"
                          style={{ background: accent, boxShadow: `0 10px 25px -6px ${hexWithAlpha(accent, 0.6)}` }}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Assistir Agora</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-3">
          {slides.map((_, dotIdx) => (
            <button
              key={dotIdx}
              onClick={() => setActiveSlide(dotIdx)}
              className={`h-2 rounded-full transition-all cursor-pointer`}
              style={{
                width: activeSlide % totalSlides === dotIdx ? 24 : 8,
                background: activeSlide % totalSlides === dotIdx ? accent : '#475569'
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const visibleTabs = clientTabs.filter(t => t.visible);

  const getTabLabel = (id: ClientTab): string => {
    const t = clientTabs.find(x => x.id === id);
    return t ? t.label : id.toUpperCase();
  };

  const renderTabIcon = (id: ClientTab, size: 'sm' | 'lg' = 'sm') => {
    const cls = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
    if (id === 'movies') return <Film className={cls} />;
    if (id === 'series') return <PlaySquare className={cls} />;
    if (id === 'live') return <Tv className={cls} />;
    if (id === 'settings') return <Settings className={cls} />;
    return null;
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-slate-100 flex flex-col font-sans select-none relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-[140px]" style={{ background: hexWithAlpha(accent, 0.15) }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full blur-[160px]" style={{ background: hexWithAlpha(accent, 0.08) }} />
        <div className="absolute inset-0 bg-[radial-gradient(#1e2433_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      {isAdminPreview && (
        <div className="relative z-50 text-white px-4 py-2 text-xs flex items-center justify-between shadow-md" style={{ background: `linear-gradient(90deg, ${accent}, ${hexWithAlpha(accent, 0.8)})` }}>
          <div className="flex items-center gap-2 font-medium">
            <Crown className="w-4 h-4 shrink-0" />
            <span>
              <strong>Modo de Pré-visualização do Cliente:</strong> Esta é a interface visual exata que o cliente final acessa.
            </span>
          </div>
          {onSwitchToAdmin && (
            <button
              onClick={onSwitchToAdmin}
              className="px-3 py-1 bg-black/40 hover:bg-black/60 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Voltar ao Painel</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <header className="sticky top-0 z-40 bg-[#0c0e14]/90 backdrop-blur-md px-4 py-3 border-b border-slate-800/60 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {activeTab === 'live' && activeCategory !== null ? (
            <button
              onClick={() => { setActiveCategory(null); setSearchQuery(''); }}
              className="w-10 h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-200 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          ) : (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="w-10 h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-200 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
          )}

          <div className="flex-1 text-center flex items-center justify-center gap-2 min-w-0">
            {branding.logoUrl && (
              <img src={branding.logoUrl} alt="logo" className="w-6 h-6 object-contain shrink-0" />
            )}
            <h1 className="text-lg sm:text-xl font-bold tracking-wide text-white drop-shadow-sm truncate px-2">
              {activeTab === 'movies' && getTabLabel('movies')}
              {activeTab === 'series' && getTabLabel('series')}
              {activeTab === 'live' && (activeCategory ? activeCategory : getTabLabel('live'))}
              {activeTab === 'settings' && getTabLabel('settings')}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToAdmin && (
              <button
                onClick={onSwitchToAdmin}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm"
                style={{ background: hexWithAlpha(accent, 0.2), borderColor: hexWithAlpha(accent, 0.5), color: accent }}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Studio</span>
              </button>
            )}

            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer shadow-sm ${isSearchOpen || searchQuery ? 'text-white' : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/60'}`}
              style={isSearchOpen || searchQuery ? { background: accent, borderColor: accent } : {}}
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pt-3 max-w-4xl mx-auto"
            >
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'movies' ? 'Buscar filmes...'
                    : activeTab === 'series' ? 'Buscar séries...'
                    : 'Buscar canais...'
                  }
                  autoFocus
                  className="w-full bg-[#151923] border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {nowPlaying && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="sticky top-16 z-30 w-full bg-black border-b border-slate-800/80 shadow-lg"
          >
            <div
              ref={playerContainerRef}
              onMouseMove={showControlsTemporarily}
              onTouchStart={showControlsTemporarily}
              onClick={showControlsTemporarily}
              className="relative w-full max-w-4xl mx-auto aspect-video max-h-[45vh] bg-black overflow-hidden group"
            >
              <video
                ref={videoRef}
                className="w-full h-full object-contain bg-black"
                playsInline autoPlay controls={false}
                onClick={() => {
                  if (controlsVisible) {
                    if (videoRef.current) {
                      if (isPlaying) videoRef.current.pause();
                      else videoRef.current.play();
                      setIsPlaying(!isPlaying);
                    }
                  } else showControlsTemporarily();
                }}
              />

              <AnimatePresence>
                {controlsVisible && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute top-0 left-0 right-0 z-20 p-2 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: nowPlaying.type === 'live' ? accent : '#3b82f6' }} />
                      <span className="text-xs font-bold truncate">{nowPlaying.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded uppercase shrink-0 border" style={nowPlaying.type === 'live' ? { background: hexWithAlpha(accent, 0.3), color: '#fff', borderColor: hexWithAlpha(accent, 0.6) } : { background: 'rgba(59,130,246,0.3)', color: '#93c5fd', borderColor: 'rgba(59,130,246,0.5)' }}>
                        {nowPlaying.type === 'live' ? 'AO VIVO' : 'VOD'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={toggleFullscreen} className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white transition cursor-pointer">
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setNowPlaying(null)} className="p-1.5 rounded-lg text-white transition cursor-pointer" style={{ background: hexWithAlpha(accent, 0.8) }}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isReconnecting && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-red-950/95 border border-red-500/50 px-3 py-2 rounded-xl flex items-center gap-2 text-red-200 text-[11px] shadow-lg pointer-events-none"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-red-400 animate-spin" />
                    <span className="font-semibold">Reconectando {reconnectAttempt}/3</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {isBuffering && !isReconnecting && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 pointer-events-none">
                  <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
                </div>
              )}

              {playerError && !isReconnecting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 p-4 text-center">
                  <AlertCircle className="w-8 h-8 mb-2" style={{ color: accent }} />
                  <p className="text-xs font-semibold text-white mb-2 max-w-md">{playerError}</p>
                  <button onClick={() => { if (videoRef.current) { videoRef.current.load(); setPlayerError(null); } }} className="px-3 py-1 text-white rounded-lg text-[11px] font-bold cursor-pointer" style={{ background: accent }}>
                    Tentar Novamente
                  </button>
                </div>
              )}

              <AnimatePresence>
                {controlsVisible && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-0 left-0 right-0 z-20 px-2 pt-6 pb-2 bg-gradient-to-t from-black/95 via-black/60 to-transparent"
                  >
                    <AnimatePresence>
                      {showBrightness && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-14 left-2 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-xl">
                          <Sun className="w-3.5 h-3.5 text-yellow-400" />
                          <input type="range" min="0.3" max="1.5" step="0.05" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} className="w-24 h-1 accent-yellow-400" />
                          <span className="text-[10px] text-yellow-300 font-mono w-9 text-right">{Math.round(brightness * 100)}%</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {showQualityMenu && hlsLevels.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-14 right-2 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-xl py-1 shadow-xl min-w-[120px]">
                          <div className="px-2.5 py-0.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wide border-b border-slate-800">Qualidade</div>
                          <button onClick={() => changeQuality(-1)} className={`w-full text-left px-2.5 py-1 text-xs hover:bg-slate-800 transition flex items-center justify-between ${currentLevel === -1 ? 'font-bold' : 'text-slate-200'}`} style={currentLevel === -1 ? { color: accent } : {}}>
                            <span>Auto</span>
                            {currentLevel === -1 && <Check className="w-3 h-3" />}
                          </button>
                          {hlsLevels.slice().reverse().map((lvl) => (
                            <button key={lvl.index} onClick={() => changeQuality(lvl.index)} className={`w-full text-left px-2.5 py-1 text-xs hover:bg-slate-800 transition flex items-center justify-between ${currentLevel === lvl.index ? 'font-bold' : 'text-slate-200'}`} style={currentLevel === lvl.index ? { color: accent } : {}}>
                              <span>{lvl.name}</span>
                              {currentLevel === lvl.index && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { if (videoRef.current) { if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); } else { videoRef.current.play(); setIsPlaying(true); } } }}
                          className="w-8 h-8 rounded-full text-white flex items-center justify-center transition active:scale-95 shadow-md"
                          style={{ background: accent }}
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                        </button>

                        <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } }} className="p-1.5 text-slate-300 hover:text-white transition">
                          {isMuted ? <VolumeX className="w-4 h-4" style={{ color: accent }} /> : <Volume2 className="w-4 h-4" />}
                        </button>

                        {!isMuted && (
                          <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="hidden sm:block w-16 h-1" />
                        )}

                        {nowPlaying.type === 'live' && lastChannel && (
                          <button onClick={handleZapLast} className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-mono transition">
                            <SkipBack className="w-3 h-3" /> Zap
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setShowBrightness(!showBrightness)} className={`p-1.5 rounded-lg transition ${showBrightness ? 'bg-yellow-500/30 text-yellow-300' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                          <Sun className="w-3.5 h-3.5" />
                        </button>

                        {hlsLevels.length > 0 && (
                          <button onClick={() => setShowQualityMenu(!showQualityMenu)} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono transition ${showQualityMenu ? 'text-white' : 'bg-white/10 hover:bg-white/20'}`} style={showQualityMenu ? { background: hexWithAlpha(accent, 0.4), color: '#fff' } : { color: accent }}>
                            <Gauge className="w-3 h-3" />
                            <span className="hidden sm:inline">{currentLevel === -1 ? 'Auto' : hlsLevels.find((l) => l.index === currentLevel)?.name || 'Auto'}</span>
                          </button>
                        )}

                        <button onClick={togglePiP} className={`p-1.5 rounded-lg transition hidden sm:block ${isPipActive ? 'text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`} style={isPipActive ? { background: hexWithAlpha(accent, 0.4) } : {}}>
                          <PictureInPicture2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="hidden sm:block text-[11px] text-slate-300 font-medium px-2">{nowPlaying.category}</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-4 py-4 pb-28 relative z-10">
        {activeTab === 'movies' && (
          <div className="space-y-6">
            {!searchQuery && renderHero(movieHeroSlides, false)}

            {isXtream && xtreamCategories.vod.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Folder className="w-3.5 h-3.5" style={{ color: accent }} />
                    Categorias ({xtreamCategories.vod.length})
                  </span>
                  {selectedVodCat && <span className="text-[11px] font-medium truncate max-w-[200px]" style={{ color: accent }}>{selectedVodCat.name}</span>}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
                  {xtreamCategories.vod.map((cat) => {
                    const isSelected = selectedVodCat?.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectVodCategory(cat)}
                        className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border cursor-pointer ${isSelected ? 'text-white' : 'bg-[#121622] text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800'}`}
                        style={isSelected ? { background: accent, borderColor: accent } : {}}
                      >
                        <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Film className="w-4 h-4" style={{ color: accent }} />
                  <span>
                    {searchQuery ? 'Resultados' : selectedVodCat ? selectedVodCat.name : getTabLabel('movies')} ({displayedMovies.length})
                  </span>
                </h3>
                {loadingStreams && (
                  <span className="text-xs flex items-center gap-1.5 animate-pulse" style={{ color: accent }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Carregando...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {visibleMovies.map((movie) => (
                  <div
                    key={movie.id}
                    onClick={() => handlePlayVod(movie)}
                    className="group relative bg-[#131722] rounded-xl overflow-hidden border border-slate-800 transition-all duration-300 shadow-md flex flex-col cursor-pointer active:scale-98"
                  >
                    <div className="relative aspect-[2/3] w-full bg-slate-900 overflow-hidden">
                      <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#131722] via-transparent to-black/30" />

                      <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold text-white border border-white/10 shadow-sm">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{movie.rating ? movie.rating.toFixed(1) : '—'}</span>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <div className="w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg" style={{ background: accent }}>
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      {movie.badge && (
                        <div className="absolute bottom-2 right-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: hexWithAlpha(accent, 0.9) }}>
                          {movie.badge}
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{movie.title}</h4>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>{movie.genre}</span>
                        <span>{movie.year}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {visibleMovies.length < displayedMovies.length && (
                <div className="p-4 bg-[#0e111a] rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">Exibindo <strong>{visibleMovies.length}</strong> de <strong>{displayedMovies.length}</strong></span>
                  <button onClick={() => setMovieDisplayLimit((prev) => prev + 48)} className="px-4 py-2 rounded-xl text-white font-bold text-xs transition cursor-pointer" style={{ background: accent }}>
                    Carregar Mais (+48)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'series' && (
          <div className="space-y-6">
            {!searchQuery && renderHero(seriesHeroSlides, true)}

            {isXtream && xtreamCategories.series.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Folder className="w-3.5 h-3.5" style={{ color: accent }} />
                    Categorias ({xtreamCategories.series.length})
                  </span>
                  {selectedSeriesCat && <span className="text-[11px] font-medium truncate max-w-[200px]" style={{ color: accent }}>{selectedSeriesCat.name}</span>}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
                  {xtreamCategories.series.map((cat) => {
                    const isSelected = selectedSeriesCat?.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectSeriesCategory(cat)}
                        className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border cursor-pointer ${isSelected ? 'text-white' : 'bg-[#121622] text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800'}`}
                        style={isSelected ? { background: accent, borderColor: accent } : {}}
                      >
                        <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <PlaySquare className="w-4 h-4" style={{ color: accent }} />
                  <span>
                    {searchQuery ? 'Resultados' : selectedSeriesCat ? selectedSeriesCat.name : getTabLabel('series')} ({displayedSeries.length})
                  </span>
                </h3>
                {loadingStreams && (
                  <span className="text-xs flex items-center gap-1.5 animate-pulse" style={{ color: accent }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Carregando...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {visibleSeries.map((series) => (
                  <div
                    key={series.id}
                    onClick={() => (isXtream ? handleOpenSeriesModal(series) : handlePlayVod(series))}
                    className="group relative bg-[#131722] rounded-xl overflow-hidden border border-slate-800 transition-all duration-300 shadow-md flex flex-col cursor-pointer active:scale-98"
                  >
                    <div className="relative aspect-[2/3] w-full bg-slate-900 overflow-hidden">
                      <img src={series.posterUrl} alt={series.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#131722] via-transparent to-black/30" />
                      <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold text-white border border-white/10 shadow-sm">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{series.rating ? series.rating.toFixed(1) : '—'}</span>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <div className="w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg" style={{ background: accent }}>
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                      {series.badge && (
                        <div className="absolute bottom-2 right-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: hexWithAlpha(accent, 0.9) }}>
                          {series.badge}
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{series.title}</h4>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>{series.genre}</span>
                        <span>{series.duration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {visibleSeries.length < displayedSeries.length && (
                <div className="p-4 bg-[#0e111a] rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">Exibindo <strong>{visibleSeries.length}</strong> de <strong>{displayedSeries.length}</strong></span>
                  <button onClick={() => setSeriesDisplayLimit((prev) => prev + 48)} className="px-4 py-2 rounded-xl text-white font-bold text-xs transition cursor-pointer" style={{ background: accent }}>
                    Carregar Mais (+48)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div>
            {activeCategory === null && (
              <div className="bg-[#0e111a] rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl divide-y divide-slate-800/50">
                <button onClick={() => setActiveCategory('Todos')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition cursor-pointer text-left">
                  <div className="flex items-center gap-3">
                    <Tv className="w-5 h-5" style={{ color: accent }} />
                    <span className="font-semibold text-sm sm:text-base text-white">Todos ( {liveChannelsList.length} )</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>

                <button onClick={() => setActiveCategory('Favoritos')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition cursor-pointer text-left">
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <span className="font-semibold text-sm sm:text-base text-white">Favoritos ( {favoriteChannels.length} )</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>

                <button onClick={() => setActiveCategory('Último assistido')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition cursor-pointer text-left">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold text-sm sm:text-base text-white">Último assistido ( {recentChannels.length} )</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>

                {isXtream && xtreamCategories.live.length > 0 ? (
                  xtreamCategories.live.map((cat) => (
                    <button key={cat.id} onClick={() => handleSelectLiveCategory(cat)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition cursor-pointer text-left group">
                      <div className="flex items-center gap-3 truncate">
                        <Folder className="w-5 h-5 shrink-0" style={{ color: accent }} />
                        <span className="font-semibold text-sm sm:text-base text-slate-200 truncate pr-2">{cat.name}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                    </button>
                  ))
                ) : (
                  categoryFolderItems.map(([groupName, count]) => (
                    <button key={groupName} onClick={() => setActiveCategory(groupName)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition cursor-pointer text-left">
                      <span className="font-semibold text-sm sm:text-base text-slate-200 truncate pr-2">{groupName} ( {count} )</span>
                      <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}

            {activeCategory !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 pb-2 text-xs text-slate-400 border-b border-slate-800">
                  <span>Exibindo <strong>{channelsForSelectedCategory.length}</strong> canais em <em>{activeCategory}</em></span>
                  <button onClick={() => setActiveCategory(null)} className="font-semibold cursor-pointer" style={{ color: accent }}>Ver todas as pastas</button>
                </div>

                {loadingStreams ? (
                  <div className="py-16 text-center bg-[#0e111a] rounded-2xl border border-slate-800 shadow-lg">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: accent }} />
                    <p className="text-sm text-slate-200 font-bold">Carregando canais...</p>
                  </div>
                ) : channelsForSelectedCategory.length === 0 ? (
                  <div className="text-center py-12 bg-[#0e111a] rounded-2xl border border-slate-800">
                    <Tv className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">Nenhum canal encontrado.</p>
                  </div>
                ) : (
                  <div className="bg-[#0c0f17] rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60 shadow-lg">
                    {visibleChannels.map((channel) => (
                      <div
                        key={channel.id}
                        onClick={() => handlePlayChannel(channel)}
                        className={`px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition cursor-pointer active:bg-slate-800 group ${nowPlaying?.item?.id === channel.id ? 'bg-red-950/20' : ''}`}
                        style={nowPlaying?.item?.id === channel.id ? { borderLeft: `4px solid ${accent}` } : {}}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm shrink-0 overflow-hidden border border-slate-700">
                            {channel.logoUrl ? (
                              <img src={channel.logoUrl} alt={channel.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                            ) : (
                              <span className="text-slate-900 font-black text-xs uppercase text-center leading-tight">{channel.name.slice(0, 4)}</span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm sm:text-base text-white tracking-wide truncate">{channel.name}</h4>
                            <p className="text-[11px] text-slate-400 truncate">{channel.groupTitle || 'Canal TV'}</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel.id); }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-yellow-400 hover:scale-110 active:scale-95 transition cursor-pointer"
                        >
                          <Bookmark className={`w-6 h-6 ${channel.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'fill-yellow-400/20 text-yellow-400'}`} />
                        </button>
                      </div>
                    ))}

                    {visibleChannels.length < channelsForSelectedCategory.length && (
                      <div className="p-4 bg-[#090c13] text-center flex flex-col sm:flex-row items-center justify-between gap-3">
                        <span className="text-xs text-slate-400">Exibindo <strong>{visibleChannels.length}</strong> de <strong>{channelsForSelectedCategory.length}</strong></span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setChannelDisplayLimit((prev) => prev + 100)} className="px-4 py-2 rounded-xl text-white font-bold text-xs transition cursor-pointer" style={{ background: accent }}>
                            Carregar Mais (+100)
                          </button>
                          <button onClick={() => setChannelDisplayLimit(channelsForSelectedCategory.length)} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer">
                            Mostrar Todos
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-[#0e111a] rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border" style={{ background: hexWithAlpha(accent, 0.2), borderColor: hexWithAlpha(accent, 0.5), color: accent }}>
                    {currentUser?.name?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{currentUser?.name || 'Cliente'}</h3>
                    <p className="text-xs text-slate-400">@{currentUser?.username || 'cliente'}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${expirationInfo.isExpired ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : expirationInfo.isExpiringSoon ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
                    {expirationInfo.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-[11px] text-slate-400">Data de Vencimento</p>
                    <p className="text-sm font-semibold text-white">{expirationInfo.label}</p>
                  </div>
                </div>

                <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-[11px] text-slate-400">Dias Restantes</p>
                    <p className="text-sm font-semibold text-white">{expirationInfo.daysLeft > 365 ? 'Acesso Ativo' : `${expirationInfo.daysLeft} dias`}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Lista Conectada</span>
                  <span className="text-xs font-bold" style={{ color: accent }}>{channels.length} Canais Carregados</span>
                </div>
                {currentUser?.playlistName && <p className="text-xs font-medium text-slate-200 truncate">{currentUser.playlistName}</p>}
                {onOpenImporter && (
                  <button onClick={onOpenImporter} className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition border border-slate-700 cursor-pointer">
                    Carregar Nova Lista M3U
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button onClick={onLogout} className="w-full py-3.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/40 text-rose-300 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 shadow-sm">
                <LogOut className="w-4 h-4" />
                <span>Desconectar da Conta</span>
              </button>
            </div>

            {branding.footerText && (
              <p className="text-center text-[10px] text-slate-500 pt-2">{branding.footerText}</p>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#08080c]/95 backdrop-blur-lg border-t border-slate-800/80 shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-around py-2 px-1">
          {visibleTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-95 cursor-pointer group min-w-0"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${active ? 'text-white scale-105' : 'bg-transparent text-slate-400 group-hover:text-slate-200'}`}
                  style={active ? { background: accent, boxShadow: `0 10px 25px -6px ${hexWithAlpha(accent, 0.6)}` } : {}}
                >
                  {renderTabIcon(tab.id, 'lg')}
                </div>
                <span
                  className={`text-[10px] font-black tracking-wider transition-colors truncate max-w-[80px]`}
                  style={{ color: active ? accent : undefined }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDrawerOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="relative w-72 max-w-[80vw] bg-[#0c0e16] border-r border-slate-800 p-5 flex flex-col justify-between shadow-2xl z-10"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm overflow-hidden" style={{ background: accent }}>
                      {branding.logoUrl ? (
                        <img src={branding.logoUrl} alt="logo" className="w-full h-full object-contain" />
                      ) : (
                        branding.appName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-sm truncate">{branding.appName}</h3>
                      <p className="text-[10px] text-slate-400">Menu</p>
                    </div>
                  </div>
                  <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
                </div>

                <nav className="space-y-1">
                  {visibleTabs.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setActiveCategory(null); setIsDrawerOpen(false); }}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition cursor-pointer ${active ? 'text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                        style={active ? { background: accent } : {}}
                      >
                        {renderTabIcon(tab.id)}
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                {onSwitchToAdmin && (
                  <button
                    onClick={() => { setIsDrawerOpen(false); onSwitchToAdmin(); }}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition border"
                    style={{ background: hexWithAlpha(accent, 0.2), borderColor: hexWithAlpha(accent, 0.4), color: accent }}
                  >
                    <Code2 className="w-4 h-4" />
                    <span>Voltar ao Studio</span>
                  </button>
                )}

                <button onClick={() => { setIsDrawerOpen(false); onLogout(); }} className="w-full py-2 px-3 text-rose-400 hover:bg-rose-950/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair da Conta</span>
                </button>

                {branding.footerText && (
                  <p className="text-center text-[10px] text-slate-500 pt-1">{branding.footerText}</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {seriesModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSeriesModal((prev) => ({ ...prev, isOpen: false }))} className="fixed inset-0 bg-black/85 backdrop-blur-md" />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-3xl bg-[#0e121d] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col my-auto"
            >
              <div className="relative p-5 border-b border-slate-800 flex items-start justify-between gap-4" style={{ background: `linear-gradient(180deg, ${hexWithAlpha(accent, 0.2)}, #0e121d)` }}>
                <div className="flex items-start gap-4">
                  <div className="w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shadow-md shrink-0">
                    <img src={seriesModal.series?.posterUrl} alt={seriesModal.series?.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border" style={{ color: accent, background: hexWithAlpha(accent, 0.15), borderColor: hexWithAlpha(accent, 0.4) }}>
                      SÉRIE
                    </span>
                    <h2 className="text-lg sm:text-2xl font-black text-white leading-tight">{seriesModal.series?.title}</h2>
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{seriesModal.info?.plot || seriesModal.series?.synopsis || 'Sinopse indisponível.'}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
                      <span className="flex items-center gap-1 font-semibold text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {seriesModal.info?.rating || seriesModal.series?.rating || '4.8'}
                      </span>
                      <span>•</span>
                      <span>{seriesModal.info?.genre || seriesModal.series?.genre || 'Série'}</span>
                    </div>
                  </div>
                </div>

                <button onClick={() => setSeriesModal((prev) => ({ ...prev, isOpen: false }))} className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {seriesModal.seasons.length > 0 && (
                <div className="px-5 py-3 border-b border-slate-800 bg-[#0a0d16] flex items-center gap-2 overflow-x-auto scrollbar-thin">
                  {seriesModal.seasons.map((s: any) => {
                    const sNum = Number(s.season_number);
                    const isSelected = seriesModal.selectedSeason === sNum;
                    return (
                      <button
                        key={sNum}
                        onClick={() => setSeriesModal((prev) => ({ ...prev, selectedSeason: sNum }))}
                        className={`whitespace-nowrap px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${isSelected ? 'text-white' : 'bg-[#151926] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'}`}
                        style={isSelected ? { background: accent } : {}}
                      >
                        {s.name || `Temporada ${sNum}`}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="p-5 flex-1 overflow-y-auto space-y-2.5">
                {seriesModal.loading ? (
                  <div className="py-16 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: accent }} />
                    <p className="text-sm text-slate-300 font-semibold">Carregando episódios...</p>
                  </div>
                ) : (
                  (() => {
                    const currentSeasonKey = String(seriesModal.selectedSeason);
                    const episodes = seriesModal.episodes[currentSeasonKey] || [];
                    if (episodes.length === 0) {
                      return (
                        <div className="py-12 text-center text-slate-400">
                          <PlaySquare className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm font-medium">Nenhum episódio encontrado.</p>
                        </div>
                      );
                    }
                    return episodes.map((ep: any) => (
                      <div
                        key={ep.id}
                        onClick={() => handlePlayEpisode(ep)}
                        className="p-3 bg-[#131725] hover:bg-slate-800/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3 transition cursor-pointer group active:scale-99"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center justify-center shrink-0 overflow-hidden relative group-hover:border-slate-500 transition">
                            <Play className="w-5 h-5 fill-current ml-0.5" style={{ color: accent }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-white truncate">
                              {ep.episode_num ? `Episódio ${ep.episode_num}: ` : ''}{ep.title || `Episódio`}
                            </h4>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{ep.info?.plot || ep.info?.duration || 'Duração padrão'}</p>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handlePlayEpisode(ep); }} className="px-3.5 py-1.5 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition shrink-0" style={{ background: accent }}>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span className="hidden sm:inline">Assistir</span>
                        </button>
                      </div>
                    ));
                  })()
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
