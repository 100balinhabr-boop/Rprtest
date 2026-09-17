import React, { useState, useEffect } from 'react';
import { SAMPLE_PLAYLISTS } from '../data/samplePlaylists';
import { parseM3U } from '../utils/m3uParserWeb';
import { Channel, UserAccount } from '../types';
import { 
  X, 
  Globe, 
  FileText, 
  Upload, 
  Sparkles, 
  Check, 
  AlertCircle,
  Play,
  Save,
  Trash2,
  Tv
} from 'lucide-react';

interface PlaylistImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaylistLoaded: (channels: Channel[], groups: string[]) => void;
  currentUser?: UserAccount | null;
  onUserUpdated?: (updatedUser: UserAccount) => void;
}

export const PlaylistImporterModal: React.FC<PlaylistImporterModalProps> = ({
  isOpen,
  onClose,
  onPlaylistLoaded,
  currentUser,
  onUserUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'sample' | 'url' | 'xtream' | 'file' | 'paste'>('url');
  const [urlInput, setUrlInput] = useState<string>(currentUser?.playlistUrl || 'http://fsnovinho.shop/get.php?username=22612577&password=37417145&type=m3u_plus&output=ts');
  const [playlistNameInput, setPlaylistNameInput] = useState<string>(currentUser?.playlistName || 'Minha Lista IPTV');
  const [saveToAccount, setSaveToAccount] = useState<boolean>(true);
  const [pasteInput, setPasteInput] = useState<string>('');
  const [xtreamServer, setXtreamServer] = useState<string>('http://fsnovinho.shop');
  const [xtreamUser, setXtreamUser] = useState<string>('22612577');
  const [xtreamPass, setXtreamPass] = useState<string>('37417145');
  const [loadMode, setLoadMode] = useState<'all' | 'live'>('live');
  const [maxLimit, setMaxLimit] = useState<number>(2000); // 2000 = Padrão rápido e fluido sem travamentos
  const [loading, setLoading] = useState<boolean>(false);
  const [isRemovingSaved, setIsRemovingSaved] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.playlistUrl) {
      setUrlInput(currentUser.playlistUrl);
    }
    if (currentUser?.playlistName) {
      setPlaylistNameInput(currentUser.playlistName);
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const savePlaylistToServer = async (targetUrl: string, name?: string) => {
    if (!currentUser) return null;
    const token = localStorage.getItem('iptv_auth_token') || sessionStorage.getItem('iptv_auth_token');
    if (!token) return null;

    try {
      const res = await fetch('/api/user/playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          playlistUrl: targetUrl,
          playlistName: name || playlistNameInput || 'Minha Lista IPTV',
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        if (onUserUpdated) onUserUpdated(data.user);
        return data.user;
      }
    } catch (err) {
      console.error('Erro ao salvar lista no servidor:', err);
    }
    return null;
  };

  const handleRemoveSavedPlaylist = async () => {
    if (!currentUser) return;
    const token = localStorage.getItem('iptv_auth_token') || sessionStorage.getItem('iptv_auth_token');
    if (!token) return;

    setIsRemovingSaved(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/user/playlist', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.user && onUserUpdated) {
        onUserUpdated(data.user);
        setSuccessMessage('Lista desvinculada da sua conta com sucesso.');
      }
    } catch (err: any) {
      setErrorMessage('Erro ao desvincular lista: ' + err.message);
    } finally {
      setIsRemovingSaved(false);
    }
  };

  const handleLoadSample = (rawM3u: string) => {
    try {
      const { channels, groups } = parseM3U(rawM3u);
      onPlaylistLoaded(channels, groups);
      onClose();
    } catch (err: any) {
      setErrorMessage('Falha ao processar lista demonstrativa: ' + err.message);
    }
  };

  const handleFetchUrl = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl || urlInput).trim();
    if (!targetUrl) {
      setErrorMessage('Por favor, digite uma URL válida.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Calls server-side proxy which resolves Mixed Content (HTTPS -> HTTP), CORS, and Out-of-Memory
      const res = await fetch('/api/load-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: targetUrl,
          maxChannels: maxLimit, // 0 = Sem limites / Carregar lista inteira
          mode: loadMode, // 'all' (TV + Filmes + Séries) ou 'live' (Apenas TV)
          preferFormat: 'm3u8'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Erro HTTP ${res.status}`);
      }

      if (!data.channels || data.channels.length === 0) {
        throw new Error('Nenhum canal válido foi encontrado nesta lista.');
      }

      const groupNames = Array.isArray(data.groups)
        ? data.groups.map((g: any) => (typeof g === 'string' ? g : g.name))
        : Array.from(new Set(data.channels.map((c: any) => c.groupTitle || 'Geral')));

      // Se solicitado, salva a lista vinculada ao usuário no backend
      if (saveToAccount && currentUser) {
        await savePlaylistToServer(targetUrl, playlistNameInput);
        setSuccessMessage(
          `Sucesso! ${data.channels.length} canais carregados e lista salva na conta de @${currentUser.username}!`
        );
      } else {
        setSuccessMessage(data.message || `Sucesso! ${data.channels.length} canais carregados.`);
      }

      setTimeout(() => {
        onPlaylistLoaded(data.channels, groupNames as string[]);
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(
        `Erro ao processar lista: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleXtreamLogin = async () => {
    if (!xtreamServer.trim() || !xtreamUser.trim() || !xtreamPass.trim()) {
      setErrorMessage('Preencha o servidor, usuário e senha.');
      return;
    }

    const builtUrl = `${xtreamServer.trim()}/get.php?username=${xtreamUser.trim()}&password=${xtreamPass.trim()}&type=m3u_plus&output=ts`;
    setUrlInput(builtUrl);
    await handleFetchUrl(builtUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string || '').trim();
        
        // Verifica se é um arquivo JSON de backup de favoritos ou canais
        if (file.name.toLowerCase().endsWith('.json') || text.startsWith('{') || text.startsWith('[')) {
          const parsed = JSON.parse(text);
          const rawChannels = Array.isArray(parsed.channels)
            ? parsed.channels
            : Array.isArray(parsed.favorites)
            ? parsed.favorites
            : Array.isArray(parsed)
            ? parsed
            : null;

          if (!rawChannels || rawChannels.length === 0) {
            throw new Error('O arquivo JSON não contém uma lista válida de canais ou favoritos.');
          }

          const channels: Channel[] = rawChannels
            .map((item: any, idx: number) => ({
              id: String(item.id || `json_ch_${idx}_${Date.now()}`),
              name: String(item.name || item.tvgName || `Canal ${idx + 1}`),
              streamUrl: String(item.streamUrl || item.url || ''),
              logoUrl: item.logoUrl || item.logo || '',
              groupTitle: item.groupTitle || item.group || 'Favoritos',
              tvgId: item.tvgId || '',
              tvgName: item.tvgName || '',
              userAgent: item.userAgent || '',
              isFavorite: item.isFavorite !== undefined ? Boolean(item.isFavorite) : true,
            }))
            .filter((c) => Boolean(c.streamUrl));

          if (channels.length === 0) {
            throw new Error('Nenhum canal com URL de stream válida foi encontrado no arquivo JSON.');
          }

          const groups = Array.from(new Set(channels.map((c) => c.groupTitle || 'Favoritos')));
          onPlaylistLoaded(channels, groups);
          onClose();
          return;
        }

        const { channels, groups } = parseM3U(text);
        if (channels.length === 0) {
          throw new Error('O arquivo selecionado não contém streams ou tags M3U válidas.');
        }
        onPlaylistLoaded(channels, groups);
        onClose();
      } catch (err: any) {
        setErrorMessage('Erro ao ler arquivo: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Erro ao abrir o arquivo no navegador.');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const handleParsePaste = () => {
    const trimmed = pasteInput.trim();
    if (!trimmed) {
      setErrorMessage('Cole o conteúdo da lista M3U ou JSON de backup no campo de texto.');
      return;
    }

    try {
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        const rawChannels = Array.isArray(parsed.channels)
          ? parsed.channels
          : Array.isArray(parsed.favorites)
          ? parsed.favorites
          : Array.isArray(parsed)
          ? parsed
          : null;

        if (!rawChannels || rawChannels.length === 0) {
          throw new Error('O texto JSON colado não contém uma lista válida de canais.');
        }

        const channels: Channel[] = rawChannels
          .map((item: any, idx: number) => ({
            id: String(item.id || `json_paste_${idx}_${Date.now()}`),
            name: String(item.name || item.tvgName || `Canal ${idx + 1}`),
            streamUrl: String(item.streamUrl || item.url || ''),
            logoUrl: item.logoUrl || item.logo || '',
            groupTitle: item.groupTitle || item.group || 'Favoritos',
            tvgId: item.tvgId || '',
            tvgName: item.tvgName || '',
            userAgent: item.userAgent || '',
            isFavorite: item.isFavorite !== undefined ? Boolean(item.isFavorite) : true,
          }))
          .filter((c) => Boolean(c.streamUrl));

        if (channels.length === 0) {
          throw new Error('Nenhum canal com URL válida encontrado no JSON colado.');
        }

        const groups = Array.from(new Set(channels.map((c) => c.groupTitle || 'Favoritos')));
        onPlaylistLoaded(channels, groups);
        onClose();
        return;
      }

      const { channels, groups } = parseM3U(trimmed);
      if (channels.length === 0) {
        throw new Error('Nenhum canal foi detectado no texto colado.');
      }
      onPlaylistLoaded(channels, groups);
      onClose();
    } catch (err: any) {
      setErrorMessage('Erro ao processar texto: ' + err.message);
    }
  };

  return (
    <div 
      id="playlist-importer-backdrop"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
    >
      <div 
        id="playlist-importer-dialog"
        className="bg-[#11192C] border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 bg-[#0E1526] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Importar Lista M3U / M3U8</span>
          </div>
          <button
            id="close-importer-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-[#0B1120] text-xs overflow-x-auto">
          <button
            onClick={() => { setActiveTab('url'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex-1 py-3 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'url'
                ? 'border-blue-500 text-blue-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Via URL M3U</span>
          </button>

          <button
            onClick={() => { setActiveTab('xtream'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex-1 py-3 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'xtream'
                ? 'border-blue-500 text-blue-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Xtream Codes</span>
          </button>

          <button
            onClick={() => { setActiveTab('sample'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex-1 py-3 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'sample'
                ? 'border-blue-500 text-blue-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Listas Teste</span>
          </button>

          <button
            onClick={() => { setActiveTab('file'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex-1 py-3 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'file'
                ? 'border-blue-500 text-blue-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Arquivo</span>
          </button>

          <button
            onClick={() => { setActiveTab('paste'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex-1 py-3 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'paste'
                ? 'border-blue-500 text-blue-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Colar</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 space-y-4">
          {/* User Linked Playlist Banner */}
          {currentUser && currentUser.playlistUrl && (
            <div className="p-3 bg-blue-950/40 border border-blue-600/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0">
                    <Tv className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">
                        {currentUser.playlistName || 'Minha Lista Salva'}
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                        Salva na sua conta
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-sm font-mono">
                      {currentUser.playlistUrl}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleFetchUrl(currentUser.playlistUrl)}
                    disabled={loading}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center gap-1 transition"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>Carregar</span>
                  </button>

                  <button
                    onClick={handleRemoveSavedPlaylist}
                    disabled={isRemovingSaved}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
                    title="Desvincular lista desta conta"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-600/50 rounded-xl flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-600/50 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {activeTab === 'url' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 block">
                  Link HTTP/HTTPS da lista M3U:
                </label>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                  Proxy Anti-CORS & Streaming Ativo
                </span>
              </div>

              <input
                id="m3u-url-input"
                type="url"
                placeholder="http://seu-servidor/get.php?username=...&password=..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full bg-[#0A0F1D] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />

              {currentUser && (
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToAccount}
                      onChange={(e) => setSaveToAccount(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700"
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-semibold text-white">
                        Salvar e vincular esta lista à minha conta (@{currentUser.username})
                      </span>
                      <p className="text-slate-400 mt-0.5">
                        Toda vez que você fizer login com seu usuário e senha, essa lista será carregada automaticamente!
                      </p>
                    </div>
                  </label>

                  {saveToAccount && (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Nome da Lista (opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Minha Lista IPTV HD"
                        value={playlistNameInput}
                        onChange={(e) => setPlaylistNameInput(e.target.value)}
                        className="w-full bg-[#0A0F1D] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Opções de Carregamento da Lista */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Opções de Importação da Lista
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {maxLimit === 0 ? '⚡ Lista Inteira (Sem Cortes)' : `Até ${maxLimit.toLocaleString()} itens`}
                  </span>
                </div>

                {/* Modo: Completo vs Ao Vivo */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    O que deseja carregar?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLoadMode('all')}
                      className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                        loadMode === 'all'
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center gap-1 text-blue-400">
                        <span>🌟 Lista Completa</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        TV ao Vivo + Filmes VOD + Séries completos.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLoadMode('live')}
                      className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                        loadMode === 'live'
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center gap-1 text-emerald-400">
                        <span>📺 Apenas TV ao Vivo</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        Canais de TV rápidos e leves.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Limite de canais */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Limite de Conteúdo:
                    </label>
                    <span className="text-[10px] font-bold text-emerald-400">
                      {maxLimit === 0 ? '✓ Sem Limite (Lista Inteira)' : `${maxLimit.toLocaleString()} itens`}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'Sem Limite', value: 0 },
                      { label: '50.000', value: 50000 },
                      { label: '20.000', value: 20000 },
                      { label: '5.000', value: 5000 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setMaxLimit(opt.value)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                          maxLimit === opt.value
                            ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                id="fetch-url-btn"
                onClick={() => handleFetchUrl()}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processando e Carregando Mídias...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Processar e {saveToAccount && currentUser ? 'Salvar Lista' : 'Carregar Canais'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === 'xtream' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Conexão direta via API Xtream Codes (padrão de apps IPTV profissionais para listas gigantes):
              </p>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Servidor / Host (com http://)</label>
                <input
                  type="text"
                  value={xtreamServer}
                  onChange={(e) => setXtreamServer(e.target.value)}
                  className="w-full bg-[#0A0F1D] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Usuário</label>
                  <input
                    type="text"
                    value={xtreamUser}
                    onChange={(e) => setXtreamUser(e.target.value)}
                    className="w-full bg-[#0A0F1D] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Senha</label>
                  <input
                    type="text"
                    value={xtreamPass}
                    onChange={(e) => setXtreamPass(e.target.value)}
                    className="w-full bg-[#0A0F1D] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Opções de Carregamento Xtream */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Opções de Importação Xtream
                  </span>
                  <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {maxLimit === 0 ? '⚡ Lista Inteira (Sem Cortes)' : `Até ${maxLimit.toLocaleString()} itens`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoadMode('all')}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                      loadMode === 'all'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1 text-indigo-400">
                      <span>🌟 Lista Completa</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                      TV + Filmes VOD + Séries.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLoadMode('live')}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                      loadMode === 'live'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1 text-emerald-400">
                      <span>📺 Apenas TV ao Vivo</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                      Canais rápidos da API Xtream.
                    </p>
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Sem Limite', value: 0 },
                    { label: '50.000', value: 50000 },
                    { label: '20.000', value: 20000 },
                    { label: '5.000', value: 5000 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMaxLimit(opt.value)}
                      className={`py-1 px-1.5 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                        maxLimit === opt.value
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {currentUser && (
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToAccount}
                      onChange={(e) => setSaveToAccount(e.target.checked)}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-semibold text-white">
                        Salvar e vincular esta lista Xtream à minha conta (@{currentUser.username})
                      </span>
                      <p className="text-slate-400 mt-0.5">
                        Toda vez que você fizer login, essa lista será aberta automaticamente.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <button
                onClick={handleXtreamLogin}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Carregando Canais da API Xtream...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Conectar e {saveToAccount && currentUser ? 'Salvar Lista na Conta' : 'Carregar Canais'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === 'sample' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Selecione uma lista oficial de demonstração para testar imediatamente o Parser e o Player:
              </p>
              {SAMPLE_PLAYLISTS.map((sample, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 rounded-xl flex items-center justify-between gap-3 transition"
                >
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-white">{sample.title}</h4>
                    <p className="text-[11px] text-slate-400">{sample.description}</p>
                  </div>
                  <button
                    onClick={() => handleLoadSample(sample.rawM3u)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shrink-0 shadow"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>Carregar</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'file' && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-slate-300 block">
                Selecione um arquivo local (.m3u, .m3u8 ou backup .json):
              </label>
              <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-6 text-center bg-slate-900/50 transition">
                <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <label className="cursor-pointer text-xs font-bold text-blue-400 hover:underline">
                  <span>Clique para selecionar o arquivo</span>
                  <input
                    type="file"
                    accept=".m3u,.m3u8,.txt,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-500 mt-1">
                  Suporta listas M3U/M3U8 e backups de canais favoritos em formato JSON para restauração instantânea.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-slate-300 block">
                Cole o conteúdo bruto da lista M3U:
              </label>
              <textarea
                rows={6}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-logo=&quot;...&quot; group-title=&quot;Canais&quot;,Canal Exemplo&#10;http://link-do-stream.m3u8"
                className="w-full bg-[#0A0F1D] border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 custom-scrollbar"
              />
              <button
                id="parse-pasted-btn"
                onClick={handleParsePaste}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20"
              >
                Fazer Parse do Texto
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
