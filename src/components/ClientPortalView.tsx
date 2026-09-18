import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';
import { Channel, UserAccount } from '../types';
import { VodItem, FEATURED_MOVIES, SAMPLE_MOVIES, SAMPLE_SERIES } from '../data/vodData';
import {
  Film,
  Tv,
  PlaySquare,
  Settings,
  Search,
  Menu,
  ChevronRight,
  ChevronLeft,
  Star,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X,
  Bookmark,
  Clock,
  Radio,
  Sparkles,
  RotateCcw,
  Check,
  ShieldCheck,
  Calendar,
  Layers,
  LogOut,
  ExternalLink,
  Crown,
  AlertCircle,
  Code2,
  Folder,
  FolderOpen,
  Loader2,
  PlayCircle,
  Sun,
  PictureInPicture2,
  Gauge,
  RefreshCw,
  SkipBack
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

type ClientTab = 'movies' | 'series' | 'live' | 'settings';

// Embaralha array (Fisher-Yates)
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Monta 8 slides do hero: 3 top (rating 7-10) + 5 aleatórios
function buildHeroSlides(items: VodItem[]): VodItem[] {
  if (!items || items.length === 0) return [];

  const sorted = [...items].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  // Top: prefere rating >= 7, senão pega os melhores disponíveis
  let topPool = sorted.filter((m) => (m.rating || 0) >= 7);
  if (topPool.length < 3) {
    topPool = sorted;
  }
  const top3 = topPool.slice(0, 3);

  // Aleatórios: pega de todo o pool, embaralha, escolhe 5 (sem repetir os do top)
  const topIds = new Set(top3.map((t) => t.id));
  const poolWithoutTop = items.filter((m) => !topIds.has(m.id));
  const shuffled = shuffleArray(poolWithoutTop);
  const random5 = shuffled.slice(0, 5);

  return [...top3, ...random5].slice(0, 8);
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
          limit: 200,
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
    setSeriesModal({
      isOpen: true,
      series: seriesItem,
      seasons: [],
      episodes: {},
      selectedSeason: 1,
      loading: true,
    });

    try {
      const res = await fetch('/api/xtream/series-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentUser?.playlistUrl,
          seriesId: sId,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const seasons = data.data.seasons || [];
        const episodes = data.data.episodes || {};
        const firstSeason = seasons[0]?.season_number ? Number(seasons[0].season_number) : 1;
        setSeriesModal({
          isOpen: true,
          series: seriesItem,
          info: data.data.info,
          seasons,
          episodes,
          selectedSeason: firstSeason,
          loading: false,
        });
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
    let baseUrl = '';
    let username = '';
    let password = '';
    try {
      const parsedUrl = new URL(currentUser?.playlistUrl || '');
      baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      username = parsedUrl.searchParams.get('username') || '';
      password = parsedUrl.searchParams.get('password') || '';
    } catch {
      // ignore
    }

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
        rating: 4.8,
        year: 2024,
        genre: seriesModal.series?.genre || 'Séries',
        category: 'Séries',
        synopsis: ep.info?.plot || '',
      },
    });

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
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 8);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

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
    if (videoRef.current) {
      videoRef.current.style.filter = `brightness(${brightness})`;
    }
  }, [brightness]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
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
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          videoRef.current.src = tsUrl;
          videoRef.current.play().then(() => {
            setIsPlaying(true);
            setPlayerError(null);
            setIsReconnecting(false);
          }).catch(() => {
            setPlayerError('Formato alternativo também falhou.');
          });
        }
      }, 800);
    } else {
      setPlayerError('Canal indisponível. Tente novamente mais tarde.');
    }
  };

  useEffect(() => {
    if (!nowPlaying || !videoRef.current) return;

    setPlayerError(null);
    setIsBuffering(true);
    setIsReconnecting(false);
    setReconnectAttempt(0);
    setUsedFormat('m3u8');

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    let streamUrl = nowPlaying.streamUrl;

    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && streamUrl.startsWith('http://')) {
      streamUrl = `/api/proxy-stream?url=${encodeURIComponent(streamUrl)}`;
    }

    if (Hls.isSupported() && (streamUrl.includes('.m3u8') || streamUrl.includes('hls') || streamUrl.startsWith('http') || streamUrl.includes('/api/proxy-stream'))) {
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
        const levels = (data.levels || []).map((lvl: any, idx: number) => ({
          index: idx,
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
              } catch {
                tryFormatFallback();
              }
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
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('video/mp4')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
      video.addEventListener('error', () => {
        setIsBuffering(false);
        setPlayerError('Falha ao reproduzir o fluxo nativo.');
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [nowPlaying]);

  const handlePlayChannel = (channel: Channel) => {
    if (nowPlaying?.item && (nowPlaying.item as any).id !== channel.id && nowPlaying.type === 'live') {
      setLastChannel(nowPlaying.item as Channel);
    }
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
    setNowPlaying({
      title: channel.name,
      streamUrl: channel.streamUrl,
      category: channel.groupTitle || 'Geral',
      logoUrl: channel.logoUrl,
      type: 'live',
      item: channel,
    });

    setRecentlyWatched((prev) => {
      const filtered = prev.filter((id) => id !== channel.id);
      const updated = [channel.id, ...filtered].slice(0, 20);
      try {
        localStorage.setItem(`iptv_recent_${currentUser?.id || 'guest'}`, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handlePlayVod = (item: VodItem) => {
    setNowPlaying({
      title: item.title,
      streamUrl: item.streamUrl,
      category: item.genre,
      logoUrl: item.posterUrl,
      type: 'vod',
      item: item,
    });
  };

  const favoriteChannels = useMemo(() => {
    return channels.filter((c) => c.isFavorite);
  }, [channels]);

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

    return {
      playlistMovies: movies,
      playlistSeries: series,
      liveChannelsList: live.length > 0 ? live : channels,
    };
  }, [channels]);

  const allMovies = useMemo<VodItem[]>(() => {
    const list = [...SAMPLE_MOVIES];
    if (playlistMovies.length > 0) {
      playlistMovies.forEach((m) => {
        list.push({
          id: m.id,
          title: m.name,
          type: 'movie',
          posterUrl: m.logoUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
          streamUrl: m.streamUrl,
          rating: 4.2,
          year: 2024,
          genre: m.groupTitle || 'Filmes M3U',
          category: 'Playlist',
          synopsis: `Título importado da lista M3U: ${m.name}`,
          badge: 'M3U VOD',
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
          id: s.id,
          title: s.name,
          type: 'series',
          posterUrl: s.logoUrl || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=600&q=80',
          streamUrl: s.streamUrl,
          rating: 4.5,
          year: 2024,
          genre: s.groupTitle || 'Séries M3U',
          category: 'Playlist',
          synopsis: `Série importada da lista M3U: ${s.name}`,
          badge: 'M3U SÉRIE',
          duration: '1 Temporada',
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

  // Hero dinâmico: 8 slides (3 top rating 7-10 + 5 aleatórios)
  const movieHeroSlides = useMemo(() => {
    return buildHeroSlides(displayedMovies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedMovies.length, selectedVodCat?.id]);

  const seriesHeroSlides = useMemo(() => {
    return buildHeroSlides(displayedSeries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedSeries.length, selectedSeriesCat?.id]);

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
    if (!activeCategory || activeCategory === 'Todos') {
      list = liveChannelsList;
    } else if (activeCategory === 'Favoritos') {
      list = favoriteChannels;
    } else if (activeCategory === 'Último assistido') {
      list = recentChannels;
    } else {
      list = liveChannelsList.filter((c) => (c.groupTitle || 'Sem Categoria') === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter((c) => c.name.toLowerCase().includes(q) || (c.groupTitle && c.groupTitle.toLowerCase().includes(q)));
    }
    return list;
  }, [isXtream, selectedLiveCat, activeCategory, xtreamStreamsCache, liveChannelsList, favoriteChannels, recentChannels, searchQuery]);

  const [channelDisplayLimit, setChannelDisplayLimit] = useState<number>(80);
  const [movieDisplayLimit, setMovieDisplayLimit] = useState<number>(48);
  const [seriesDisplayLimit, setSeriesDisplayLimit] = useState<number>(48);

  useEffect(() => {
    setChannelDisplayLimit(80);
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    setMovieDisplayLimit(48);
  }, [searchQuery, selectedVodCat?.id]);

  useEffect(() => {
    setSeriesDisplayLimit(48);
  }, [searchQuery, selectedSeriesCat?.id]);

  const visibleChannels = useMemo(() => {
    return channelsForSelectedCategory.slice(0, channelDisplayLimit);
  }, [channelsForSelectedCategory, channelDisplayLimit]);

  const visibleMovies = useMemo(() => {
    return displayedMovies.slice(0, movieDisplayLimit);
  }, [displayedMovies, movieDisplayLimit]);

  const visibleSeries = useMemo(() => {
    return displayedSeries.slice(0, seriesDisplayLimit);
  }, [displayedSeries, seriesDisplayLimit]);

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
    const today = new Date();
    const diffTime = expDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isExpired = daysLeft <= 0;
    const isExpiringSoon = daysLeft <= 5 && !isExpired;

    const formattedDate = expDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return {
      status: isExpired ? 'Vencido' : isExpiringSoon ? 'Vencendo em Breve' : 'Plano Ativo',
      daysLeft,
      isExpiringSoon,
      isExpired,
      label: formattedDate,
    };
  }, [currentUser?.expirationDate]);

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
          if (screen.orientation && (screen.orientation as any).lock) {
            (screen.orientation as any).lock('landscape').catch(() => {});
          }
        })
        .catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
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
        setPlayerError('PiP não suportado neste navegador.');
        setTimeout(() => setPlayerError(null), 3000);
      }
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
    if (!lastChannel || !nowPlaying) return;
    const curChannel = nowPlaying.item as Channel | undefined;
    setNowPlaying({
      title: lastChannel.name,
      streamUrl: lastChannel.streamUrl,
      category: lastChannel.groupTitle || 'Geral',
      logoUrl: lastChannel.logoUrl,
      type: 'live',
      item: lastChannel,
    });
    if (curChannel && curChannel.streamUrl) {
      setLastChannel(curChannel);
    }
  };

  // ============================================================
  // RENDER DO HERO CARROSSEL — reutilizado em Filmes e Séries
  // ============================================================
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
                  if (isCurrent) {
                    if (isSeries && isXtream) handleOpenSeriesModal(item);
                    else handlePlayVod(item);
                  } else {
                    setActiveSlide(idx);
                  }
                }}
                className={`absolute transition-all duration-500 ease-out cursor-pointer rounded-2xl overflow-hidden shadow-2xl border ${
                  isCurrent
                    ? 'z-20 w-[78%] sm:w-[65%] h-[320px] sm:h-[390px] scale-100 opacity-100 border-red-500/40 shadow-red-950/40'
                    : isPrev
                    ? 'z-10 w-[65%] sm:w-[50%] h-[270px] sm:h-[330px] -translate-x-[45%] scale-90 opacity-40 border-slate-700/50'
                    : 'z-10 w-[65%] sm:w-[50%] h-[270px] sm:h-[330px] translate-x-[45%] scale-90 opacity-40 border-slate-700/50'
                }`}
              >
                <img
                  src={item.posterUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-between p-4 sm:p-5">
                  <div className="flex items-start justify-between">
                    <div className="bg-red-700 text-white font-black text-sm sm:text-base px-2.5 py-1 rounded-md shadow-md">
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
                      <p className="text-[10px] sm:text-xs text-amber-400 font-semibold tracking-widest uppercase drop-shadow">
                        JÁ DISPONÍVEL
                      </p>
                      <h2 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wider drop-shadow-md">
                        {item.title}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-slate-300 line-clamp-1 font-medium">
                        {item.synopsis}
                      </p>

                      <div className="flex items-center justify-center gap-1 pt-1">
                        {[...Array(5)].map((_, s) => (
                          <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>

                      <div className="pt-2 flex justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSeries && isXtream) handleOpenSeriesModal(item);
                            else handlePlayVod(item);
                          }}
                          className="px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-600/40 transition active:scale-95"
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
              className={`h-2 rounded-full transition-all cursor-pointer ${
                activeSlide % totalSlides === dotIdx ? 'w-6 bg-yellow-400' : 'w-2 bg-slate-600 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 flex flex-col font-sans select-none relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-red-950/20 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-red-900/10 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e2433_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      {isAdminPreview && (
        <div className="relative z-50 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 font-medium">
            <Crown className="w-4 h-4 text-amber-200 shrink-0" />
            <span>
              <strong>Modo de Pré-visualização do Cliente:</strong> Esta é a interface visual exata que o <em>UsuarioComum</em> (cliente final) acessa.
            </span>
          </div>
          {onSwitchToAdmin && (
            <button
              onClick={onSwitchToAdmin}
              className="px-3 py-1 bg-black/40 hover:bg-black/60 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Voltar ao Painel Master</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <header className="sticky top-0 z-40 bg-[#0c0e14]/90 backdrop-blur-md px-4 py-3 border-b border-slate-800/60 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {activeTab === 'live' && activeCategory !== null ? (
            <button
              onClick={() => {
                setActiveCategory(null);
                setSearchQuery('');
              }}
              className="w-10 h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-200 transition active:scale-95 cursor-pointer shadow-sm"
              title="Voltar para Categorias"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          ) : (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="w-10 h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-200 transition active:scale-95 cursor-pointer shadow-sm"
              title="Menu Principal"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
          )}

          <div className="flex-1 text-center">
            <h1 className="text-lg sm:text-xl font-bold tracking-wide text-white drop-shadow-sm truncate px-2">
              {activeTab === 'movies' && 'Filmes'}
              {activeTab === 'series' && 'Séries'}
              {activeTab === 'live' && (activeCategory ? activeCategory : 'TV ao vivo')}
              {activeTab === 'settings' && 'Configurações'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToAdmin && (
              <button
                onClick={onSwitchToAdmin}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm"
                title="Voltar ao Painel Studio / Admin Master"
              >
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Studio / Admin</span>
                <span className="sm:hidden">Studio</span>
              </button>
            )}

            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer shadow-sm ${
                isSearchOpen || searchQuery
                  ? 'bg-red-600 text-white border-red-500 shadow-red-600/30'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700/60'
              }`}
              title="Buscar"
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
                    activeTab === 'movies'
                      ? 'Buscar filmes por título ou gênero...'
                      : activeTab === 'series'
                      ? 'Buscar séries e novelas...'
                      : 'Buscar canais de TV ao vivo...'
                  }
                  autoFocus
                  className="w-full bg-[#151923] border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* PLAYER INLINE — canal ao vivo */}
      <AnimatePresence>
        {nowPlaying && nowPlaying.type === 'live' && (
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
                playsInline
                autoPlay
                controls={false}
                onClick={() => {
                  if (controlsVisible) {
                    if (videoRef.current) {
                      if (isPlaying) videoRef.current.pause();
                      else videoRef.current.play();
                      setIsPlaying(!isPlaying);
                    }
                  } else {
                    showControlsTemporarily();
                  }
                }}
              />

              <AnimatePresence>
                {controlsVisible && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-0 left-0 right-0 z-20 p-2 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shrink-0" />
                      <span className="text-xs font-bold truncate">{nowPlaying.title}</span>
                      <span className="text-[10px] bg-red-600/40 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded uppercase shrink-0">
                        AO VIVO
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={toggleFullscreen}
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white transition cursor-pointer"
                        title="Tela Cheia"
                      >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setNowPlaying(null)}
                        className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition cursor-pointer"
                        title="Fechar Player"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isReconnecting && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-red-950/95 border border-red-500/50 px-3 py-2 rounded-xl flex items-center gap-2 text-red-200 text-[11px] shadow-lg pointer-events-none"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-red-400 animate-spin" />
                    <span className="font-semibold">Reconectando {reconnectAttempt}/3</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {isBuffering && !isReconnecting && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 pointer-events-none">
                  <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {playerError && !isReconnecting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                  <p className="text-xs font-semibold text-white mb-2">{playerError}</p>
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.load();
                        setPlayerError(null);
                      }
                    }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    Tentar Novamente
                  </button>
                </div>
              )}

              <AnimatePresence>
                {controlsVisible && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-0 left-0 right-0 z-20 px-2 pt-6 pb-2 bg-gradient-to-t from-black/95 via-black/60 to-transparent"
                  >
                    <AnimatePresence>
                      {showBrightness && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-14 left-2 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-xl"
                        >
                          <Sun className="w-3.5 h-3.5 text-yellow-400" />
                          <input
                            type="range"
                            min="0.3"
                            max="1.5"
                            step="0.05"
                            value={brightness}
                            onChange={(e) => setBrightness(parseFloat(e.target.value))}
                            className="w-24 h-1 accent-yellow-400"
                          />
                          <span className="text-[10px] text-yellow-300 font-mono w-9 text-right">
                            {Math.round(brightness * 100)}%
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {showQualityMenu && hlsLevels.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-14 right-2 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-xl py-1 shadow-xl min-w-[120px]"
                        >
                          <div className="px-2.5 py-0.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wide border-b border-slate-800">
                            Qualidade
                          </div>
                          <button
                            onClick={() => changeQuality(-1)}
                            className={`w-full text-left px-2.5 py-1 text-xs hover:bg-slate-800 transition flex items-center justify-between ${
                              currentLevel === -1 ? 'text-red-400 font-bold' : 'text-slate-200'
                            }`}
                          >
                            <span>Auto</span>
                            {currentLevel === -1 && <Check className="w-3 h-3" />}
                          </button>
                          {hlsLevels.slice().reverse().map((lvl) => (
                            <button
                              key={lvl.index}
                              onClick={() => changeQuality(lvl.index)}
                              className={`w-full text-left px-2.5 py-1 text-xs hover:bg-slate-800 transition flex items-center justify-between ${
                                currentLevel === lvl.index ? 'text-red-400 font-bold' : 'text-slate-200'
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
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
                              else { videoRef.current.play(); setIsPlaying(true); }
                            }
                          }}
                          className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition active:scale-95 shadow-md"
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                        </button>

                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.muted = !isMuted;
                              setIsMuted(!isMuted);
                            }
                          }}
                          className="p-1.5 text-slate-300 hover:text-white transition"
                        >
                          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                        </button>

                        {!isMuted && (
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="hidden sm:block w-16 h-1 accent-red-500"
                          />
                        )}

                        {lastChannel && (
                          <button
                            onClick={handleZapLast}
                            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-mono transition"
                            title="Canal anterior"
                          >
                            <SkipBack className="w-3 h-3" />
                            Zap
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowBrightness(!showBrightness)}
                          className={`p-1.5 rounded-lg transition ${
                            showBrightness ? 'bg-yellow-500/30 text-yellow-300' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                          title="Brilho"
                        >
                          <Sun className="w-3.5 h-3.5" />
                        </button>

                        {hlsLevels.length > 0 && (
                          <button
                            onClick={() => setShowQualityMenu(!showQualityMenu)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono transition ${
                              showQualityMenu ? 'bg-red-600/40 text-red-200' : 'bg-white/10 hover:bg-white/20 text-red-300'
                            }`}
                          >
                            <Gauge className="w-3 h-3" />
                            <span className="hidden sm:inline">
                              {currentLevel === -1 ? 'Auto' : hlsLevels.find((l) => l.index === currentLevel)?.name || 'Auto'}
                            </span>
                          </button>
                        )}

                        <button
                          onClick={togglePiP}
                          className={`p-1.5 rounded-lg transition hidden sm:block ${
                            isPipActive ? 'bg-red-600/40 text-red-300' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                          title="Picture-in-Picture"
                        >
                          <PictureInPicture2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="hidden sm:block text-[11px] text-slate-300 font-medium px-2">
                          {nowPlaying.category}
                        </div>
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
        {/* ============================================ */}
        {/* TAB: FILMES */}
        {/* ============================================ */}
        {activeTab === 'movies' && (
          <div className="space-y-6">
            {/* HERO — 8 slides dinâmicos (3 top + 5 aleatórios) */}
            {!searchQuery && renderHero(movieHeroSlides, false)}

            {/* Categorias Xtream VOD */}
            {isXtream && xtreamCategories.vod.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Folder className="w-3.5 h-3.5 text-red-500" />
                    Categorias ({xtreamCategories.vod.length})
                  </span>
                  {selectedVodCat && (
                    <span className="text-red-400 text-[11px] font-medium truncate max-w-[200px]">
                      {selectedVodCat.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
                  {xtreamCategories.vod.map((cat) => {
                    const isSelected = selectedVodCat?.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectVodCategory(cat)}
                        className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                          isSelected
                            ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/40'
                            : 'bg-[#121622] text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800'
                        }`}
                      >
                        <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* GRADE VERTICAL COMPLETA — volta ao original */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Film className="w-4 h-4 text-red-500" />
                  <span>
                    {searchQuery
                      ? 'Resultados da Busca'
                      : selectedVodCat
                      ? selectedVodCat.name
                      : 'Catálogo de Filmes'}{' '}
                    ({displayedMovies.length})
                  </span>
                </h3>
                {loadingStreams && (
                  <span className="text-xs text-red-400 flex items-center gap-1.5 animate-pulse">
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
                    className="group relative bg-[#131722] rounded-xl overflow-hidden border border-slate-800 hover:border-red-500/60 transition-all duration-300 shadow-md hover:shadow-red-950/30 flex flex-col cursor-pointer active:scale-98"
                  >
                    <div className="relative aspect-[2/3] w-full bg-slate-900 overflow-hidden">
                      <img
                        src={movie.posterUrl}
                        alt={movie.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#131722] via-transparent to-black/30" />

                      <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold text-white border border-white/10 shadow-sm">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{movie.rating ? movie.rating.toFixed(1) : '—'}</span>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/50">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      {movie.badge && (
                        <div className="absolute bottom-2 right-2 bg-red-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                          {movie.badge}
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                        {movie.title}
                      </h4>
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
                  <span className="text-xs text-slate-400">
                    Exibindo <strong>{visibleMovies.length}</strong> de <strong>{displayedMovies.length}</strong> filmes
                  </span>
                  <button
                    onClick={() => setMovieDisplayLimit((prev) => prev + 48)}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Carregar Mais Filmes (+48)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* TAB: SÉRIES */}
        {/* ============================================ */}
        {activeTab === 'series' && (
          <div className="space-y-6">
            {/* HERO — 8 slides dinâmicos (3 top + 5 aleatórios) */}
            {!searchQuery && renderHero(seriesHeroSlides, true)}

            {/* Categorias Xtream Series */}
            {isXtream && xtreamCategories.series.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Folder className="w-3.5 h-3.5 text-red-500" />
                    Categorias ({xtreamCategories.series.length})
                  </span>
                  {selectedSeriesCat && (
                    <span className="text-red-400 text-[11px] font-medium truncate max-w-[200px]">
                      {selectedSeriesCat.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
                  {xtreamCategories.series.map((cat) => {
                    const isSelected = selectedSeriesCat?.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectSeriesCategory(cat)}
                        className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                          isSelected
                            ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/40'
                            : 'bg-[#121622] text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800'
                        }`}
                      >
                        <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* GRADE VERTICAL COMPLETA */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <PlaySquare className="w-4 h-4 text-red-500" />
                  <span>
                    {searchQuery
                      ? 'Resultados da Busca'
                      : selectedSeriesCat
                      ? selectedSeriesCat.name
                      : 'Catálogo de Séries'}{' '}
                    ({displayedSeries.length})
                  </span>
                </h3>
                {loadingStreams && (
                  <span className="text-xs text-red-400 flex items-center gap-1.5 animate-pulse">
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
                    className="group relative bg-[#131722] rounded-xl overflow-hidden border border-slate-800 hover:border-red-500/60 transition-all duration-300 shadow-md flex flex-col cursor-pointer active:scale-98"
                  >
                    <div className="relative aspect-[2/3] w-full bg-slate-900 overflow-hidden">
                      <img
                        src={series.posterUrl}
                        alt={series.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#131722] via-transparent to-black/30" />

                      <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold text-white border border-white/10 shadow-sm">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{series.rating ? series.rating.toFixed(1) : '—'}</span>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                        <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/50">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      {series.badge && (
                        <div className="absolute bottom-2 right-2 bg-red-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                          {series.badge}
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                        {series.title}
                      </h4>
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
                  <span className="text-xs text-slate-400">
                    Exibindo <strong>{visibleSeries.length}</strong> de <strong>{displayedSeries.length}</strong> séries
                  </span>
                  <button
                    onClick={() => setSeriesDisplayLimit((prev) => prev + 48)}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Carregar Mais Séries (+48)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* TAB: TV AO VIVO — sem alterações */}
        {/* ============================================ */}
        {activeTab === 'live' && (
          <div>
            {activeCategory === null && (
              <div className="bg-[#0e111a] rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl divide-y divide-slate-800/50">
                <button
                  onClick={() => setActiveCategory('Todos')}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition active:bg-slate-800 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Tv className="w-5 h-5 text-red-500" />
                    <span className="font-semibold text-sm sm:text-base text-white">
                      Todos ( {liveChannelsList.length} )
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>

                <button
                  onClick={() => setActiveCategory('Favoritos')}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition active:bg-slate-800 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <span className="font-semibold text-sm sm:text-base text-white">
                      Favoritos ( {favoriteChannels.length} )
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>

                <button
                  onClick={() => setActiveCategory('Último assistido')}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition active:bg-slate-800 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold text-sm sm:text-base text-white">
                      Último assistido ( {recentChannels.length} )
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>

                {isXtream && xtreamCategories.live.length > 0 ? (
                  xtreamCategories.live.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleSelectLiveCategory(cat)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition active:bg-slate-800 cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Folder className="w-5 h-5 text-red-500 group-hover:text-red-400 shrink-0" />
                        <span className="font-semibold text-sm sm:text-base text-slate-200 truncate pr-2">
                          {cat.name}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                    </button>
                  ))
                ) : (
                  categoryFolderItems.map(([groupName, count]) => (
                    <button
                      key={groupName}
                      onClick={() => setActiveCategory(groupName)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/40 transition active:bg-slate-800 cursor-pointer text-left"
                    >
                      <span className="font-semibold text-sm sm:text-base text-slate-200 truncate pr-2">
                        {groupName} ( {count} )
                      </span>
                      <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}

            {activeCategory !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 pb-2 text-xs text-slate-400 border-b border-slate-800">
                  <span>
                    Exibindo <strong>{channelsForSelectedCategory.length}</strong> canais em <em>{activeCategory}</em>
                  </span>
                  <button
                    onClick={() => setActiveCategory(null)}
                    className="text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                  >
                    Ver todas as pastas
                  </button>
                </div>

                {loadingStreams ? (
                  <div className="py-16 text-center bg-[#0e111a] rounded-2xl border border-slate-800 shadow-lg">
                    <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-200 font-bold">Carregando canais da pasta...</p>
                    <p className="text-xs text-slate-500 mt-1">Carregamento inteligente estilo TiviMate sem travar</p>
                  </div>
                ) : channelsForSelectedCategory.length === 0 ? (
                  <div className="text-center py-12 bg-[#0e111a] rounded-2xl border border-slate-800">
                    <Tv className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">Nenhum canal encontrado nesta categoria.</p>
                  </div>
                ) : (
                  <div className="bg-[#0c0f17] rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60 shadow-lg">
                    {visibleChannels.map((channel) => (
                      <div
                        key={channel.id}
                        onClick={() => handlePlayChannel(channel)}
                        className={`px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition cursor-pointer active:bg-slate-800 group ${
                          nowPlaying?.item?.id === channel.id ? 'bg-red-950/20 border-l-4 border-red-600' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm shrink-0 overflow-hidden border border-slate-700">
                            {channel.logoUrl ? (
                              <img
                                src={channel.logoUrl}
                                alt={channel.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="text-slate-900 font-black text-xs uppercase text-center leading-tight">
                                {channel.name.slice(0, 4)}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm sm:text-base text-white tracking-wide truncate group-hover:text-red-400 transition-colors">
                              {channel.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate">
                              {channel.groupTitle || 'Canal TV'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(channel.id);
                          }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-yellow-400 hover:scale-110 active:scale-95 transition cursor-pointer"
                          title={channel.isFavorite ? 'Remover dos Favoritos' : 'Salvar nos Favoritos'}
                        >
                          <Bookmark
                            className={`w-6 h-6 ${
                              channel.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'fill-yellow-400/20 text-yellow-400'
                            }`}
                          />
                        </button>
                      </div>
                    ))}

                    {visibleChannels.length < channelsForSelectedCategory.length && (
                      <div className="p-4 bg-[#090c13] text-center flex flex-col sm:flex-row items-center justify-between gap-3">
                        <span className="text-xs text-slate-400">
                          Exibindo <strong>{visibleChannels.length}</strong> de <strong>{channelsForSelectedCategory.length}</strong> canais
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setChannelDisplayLimit((prev) => prev + 100)}
                            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-red-950/40"
                          >
                            Carregar Mais (+100 canais)
                          </button>
                          <button
                            onClick={() => setChannelDisplayLimit(channelsForSelectedCategory.length)}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
                          >
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
                  <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center font-black text-red-400 text-lg">
                    {currentUser?.name?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{currentUser?.name || 'Cliente'}</h3>
                    <p className="text-xs text-slate-400">@{currentUser?.username || 'cliente'}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${
                      expirationInfo.isExpired
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : expirationInfo.isExpiringSoon
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
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
                    <p className="text-sm font-semibold text-white">
                      {expirationInfo.daysLeft > 365 ? 'Acesso Ativo' : `${expirationInfo.daysLeft} dias`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Lista Conectada</span>
                  <span className="text-xs font-bold text-red-400">{channels.length} Canais Carregados</span>
                </div>
                {currentUser?.playlistName && (
                  <p className="text-xs font-medium text-slate-200 truncate">{currentUser.playlistName}</p>
                )}
                {onOpenImporter && (
                  <button
                    onClick={onOpenImporter}
                    className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition border border-slate-700 cursor-pointer"
                  >
                    Carregar Nova Lista M3U
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onLogout}
                className="w-full py-3.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/40 text-rose-300 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Desconectar da Conta</span>
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090b10]/95 backdrop-blur-lg border-t border-slate-800/80 shadow-2xl">
        <div className="max-w-md mx-auto grid grid-cols-4 py-2 px-1">
          <button
            onClick={() => {
              setActiveTab('movies');
              setSearchQuery('');
            }}
            className="flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-95 cursor-pointer group"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeTab === 'movies'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/50 scale-105'
                  : 'bg-transparent text-slate-400 group-hover:text-slate-200'
              }`}
            >
              <Film className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] font-black tracking-wider transition-colors ${
                activeTab === 'movies' ? 'text-red-500' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              FILMES
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('series');
              setSearchQuery('');
            }}
            className="flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-95 cursor-pointer group"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeTab === 'series'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/50 scale-105'
                  : 'bg-transparent text-slate-400 group-hover:text-slate-200'
              }`}
            >
              <PlaySquare className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] font-black tracking-wider transition-colors ${
                activeTab === 'series' ? 'text-red-500' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              SÉRIES
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('live');
              setSearchQuery('');
            }}
            className="flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-95 cursor-pointer group"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeTab === 'live'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/50 scale-105'
                  : 'bg-transparent text-slate-400 group-hover:text-slate-200'
              }`}
            >
              <Tv className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] font-black tracking-wider transition-colors ${
                activeTab === 'live' ? 'text-red-500' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              TV AO VIVO
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('settings');
              setSearchQuery('');
            }}
            className="flex flex-col items-center justify-center gap-1 py-1 transition-all active:scale-95 cursor-pointer group"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeTab === 'settings'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/50 scale-105'
                  : 'bg-transparent text-slate-400 group-hover:text-slate-200'
              }`}
            >
              <Settings className="w-5 h-5" />
            </div>
            <span
              className={`text-[10px] font-black tracking-wider transition-colors truncate max-w-[70px] ${
                activeTab === 'settings' ? 'text-red-500' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              CONFIGUR...
            </span>
          </button>
        </div>
      </nav>

      {/* MODAL DO PLAYER — só VOD */}
      <AnimatePresence>
        {nowPlaying && nowPlaying.type === 'vod' && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-end sm:justify-center p-0 sm:p-4"
          >
            <div
              className="relative w-full max-w-4xl mx-auto bg-black rounded-none sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col aspect-video max-h-[85vh]"
            >
              <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-md">
                    {nowPlaying.title}
                  </span>
                  <span className="hidden sm:inline-block text-[10px] bg-red-600/40 text-red-300 border border-red-500/40 px-2 py-0.5 rounded uppercase">
                    VOD
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-slate-300 hover:text-white transition cursor-pointer"
                    title="Tela Cheia"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setNowPlaying(null)}
                    className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition cursor-pointer"
                    title="Fechar Player"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <video
                ref={videoRef}
                className="w-full h-full object-contain bg-black"
                playsInline
                autoPlay
                controls={false}
                onClick={() => {
                  if (videoRef.current) {
                    if (isPlaying) videoRef.current.pause();
                    else videoRef.current.play();
                    setIsPlaying(!isPlaying);
                  }
                }}
              />

              <AnimatePresence>
                {isReconnecting && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-red-950/95 border border-red-500/50 px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-red-200 text-xs shadow-lg pointer-events-none"
                  >
                    <RefreshCw className="w-4 h-4 text-red-400 animate-spin" />
                    <span className="font-semibold">
                      Reconectando... {reconnectAttempt}/3
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {isBuffering && !isReconnecting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 pointer-events-none">
                  <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-3 shadow-lg" />
                  <span className="text-xs font-semibold text-white bg-black/70 px-3 py-1 rounded-full">
                    Carregando...
                  </span>
                </div>
              )}

              {playerError && !isReconnecting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 p-4 text-center">
                  <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
                  <p className="text-sm font-semibold text-white mb-3">{playerError}</p>
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.load();
                        setPlayerError(null);
                      }
                    }}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Tentar Novamente
                  </button>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 z-20 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        if (isPlaying) {
                          videoRef.current.pause();
                          setIsPlaying(false);
                        } else {
                          videoRef.current.play();
                          setIsPlaying(true);
                        }
                      }
                    }}
                    className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition active:scale-95 shadow-md"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>

                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                        setIsMuted(!isMuted);
                      }
                    }}
                    className="p-1.5 text-slate-300 hover:text-white transition"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>

                <div className="text-xs text-slate-300 font-medium">
                  {nowPlaying.category}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="relative w-72 max-w-[80vw] bg-[#0c0e16] border-r border-slate-800 p-5 flex flex-col justify-between shadow-2xl z-10"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-black text-sm">
                      XC
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">XCloud IPTV</h3>
                      <p className="text-[10px] text-slate-400">Portal do Assinante</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('live');
                      setActiveCategory(null);
                      setIsDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition cursor-pointer ${
                      activeTab === 'live' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Tv className="w-4 h-4" />
                    <span>TV ao Vivo</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('movies');
                      setIsDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition cursor-pointer ${
                      activeTab === 'movies' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Film className="w-4 h-4" />
                    <span>Filmes</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('series');
                      setIsDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition cursor-pointer ${
                      activeTab === 'series' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <PlaySquare className="w-4 h-4" />
                    <span>Séries</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setIsDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition cursor-pointer ${
                      activeTab === 'settings' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Configurações & Perfil</span>
                  </button>
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                {onSwitchToAdmin && (
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onSwitchToAdmin();
                    }}
                    className="w-full py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <Code2 className="w-4 h-4 text-blue-400" />
                    <span>Voltar ao Studio / Admin Master</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onLogout();
                  }}
                  className="w-full py-2 px-3 text-rose-400 hover:bg-rose-950/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {seriesModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSeriesModal((prev) => ({ ...prev, isOpen: false }))}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-3xl bg-[#0e121d] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col my-auto"
            >
              <div className="relative p-5 bg-gradient-to-b from-red-950/40 via-[#0e121d] to-[#0e121d] border-b border-slate-800 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shadow-md shrink-0">
                    <img
                      src={seriesModal.series?.posterUrl}
                      alt={seriesModal.series?.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-red-400 bg-red-950/60 border border-red-500/30 px-2 py-0.5 rounded">
                      SÉRIE XCIPTV
                    </span>
                    <h2 className="text-lg sm:text-2xl font-black text-white leading-tight">
                      {seriesModal.series?.title}
                    </h2>
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {seriesModal.info?.plot || seriesModal.series?.synopsis || 'Sinopse indisponível.'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
                      <span className="flex items-center gap-1 font-semibold text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {seriesModal.info?.rating || seriesModal.series?.rating || '4.8'}
                      </span>
                      <span>•</span>
                      <span>{seriesModal.info?.genre || seriesModal.series?.genre || 'Série'}</span>
                      {seriesModal.info?.releaseDate && (
                        <>
                          <span>•</span>
                          <span>{String(seriesModal.info.releaseDate).slice(0, 4)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSeriesModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                >
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
                        className={`whitespace-nowrap px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-red-600 text-white shadow-md shadow-red-950/40'
                            : 'bg-[#151926] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                        }`}
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
                    <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-300 font-semibold">Carregando episódios sob demanda...</p>
                    <p className="text-xs text-slate-500 mt-1">Conectando à API Xtream Codes</p>
                  </div>
                ) : (
                  (() => {
                    const currentSeasonKey = String(seriesModal.selectedSeason);
                    const episodes = seriesModal.episodes[currentSeasonKey] || [];

                    if (episodes.length === 0) {
                      return (
                        <div className="py-12 text-center text-slate-400">
                          <PlaySquare className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm font-medium">Nenhum episódio encontrado para esta temporada.</p>
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
                          <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center justify-center shrink-0 overflow-hidden relative group-hover:border-red-500/60 transition">
                            <Play className="w-5 h-5 text-red-500 fill-current ml-0.5 group-hover:scale-110 transition" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-white truncate group-hover:text-red-400 transition-colors">
                              {ep.episode_num ? `Episódio ${ep.episode_num}: ` : ''}
                              {ep.title || `Episódio`}
                            </h4>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {ep.info?.plot || ep.info?.duration || 'Duração padrão'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayEpisode(ep);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition shrink-0"
                        >
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
