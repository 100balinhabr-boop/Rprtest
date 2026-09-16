import React from 'react';
import { 
  FolderTree, 
  Cpu, 
  Layers, 
  PlayCircle, 
  FileCheck, 
  Tv, 
  Zap, 
  ShieldCheck, 
  Code,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const ArchitectureDoc: React.FC = () => {
  return (
    <div id="architecture-doc" className="p-6 max-w-5xl mx-auto space-y-8 text-slate-200">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#101935] to-[#1E293B] border border-blue-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 text-blue-400 mb-2">
          <Layers className="w-6 h-6" />
          <span className="text-xs uppercase font-bold tracking-wider">
            Arquitetura Android Nativa (100% Java)
          </span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Guia de Arquitetura Limpa para Player IPTV & M3U8
        </h1>
        <p className="text-sm text-slate-300 mt-2 leading-relaxed">
          Esta documentação técnica foi desenvolvida segundo os mais rigorosos padrões da engenharia
          Android sênior. O projeto foi desenhado para suportar <strong>listas com mais de 100.000 canais</strong>,
          garantindo reprodução fluida a 60 FPS, compatibilidade com TV Box / Android TV (D-Pad) e reprodução
          instantânea com <strong>AndroidX Media3 (ExoPlayer)</strong>.
        </p>
      </div>

      {/* 1. Estrutura de Pacotes */}
      <section className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-blue-400 font-bold text-lg">
          <FolderTree className="w-5 h-5" />
          <h2>1. Estrutura de Pacotes Recomendada no Android Studio</h2>
        </div>

        <p className="text-xs text-slate-300">
          A modularização segue os princípios da Clean Architecture adaptada para Java com padrão MVVM
          (Model-View-ViewModel), desacoplando totalmente a camada de dados da interface:
        </p>

        <div className="bg-[#090E1A] border border-slate-800/90 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
          <pre className="text-emerald-400 font-bold mb-2">com.iptv.player/</pre>
          <div className="space-y-1 text-slate-300 pl-4">
            <p>├── <span className="text-blue-400 font-bold">IPTVApplication.java</span> <span className="text-slate-500">// Inicialização global de caches e logging</span></p>
            <p>├── <span className="text-purple-400 font-bold">data/</span></p>
            <p>│   ├── <span className="text-amber-400">model/</span></p>
            <p>│   │   ├── <strong>Channel.java</strong> <span className="text-slate-500">// Entidade Parcelable do Canal (nome, logo, url, grupo)</span></p>
            <p>│   │   └── <strong>ChannelGroup.java</strong> <span className="text-slate-500">// Agrupamento de categorias com contador</span></p>
            <p>│   ├── <span className="text-amber-400">parser/</span></p>
            <p>│   │   └── <strong>M3UParser.java</strong> <span className="text-slate-500">// Parser streaming em O(N) com buffer e regex</span></p>
            <p>│   └── <span className="text-amber-400">repository/</span></p>
            <p>│       └── <strong>PlaylistRepository.java</strong> <span className="text-slate-500">// Conexão OkHttp, download e leitura de arquivos locais</span></p>
            <p>├── <span className="text-purple-400 font-bold">presentation/</span></p>
            <p>│   ├── <span className="text-amber-400">adapter/</span></p>
            <p>│   │   ├── <strong>ChannelAdapter.java</strong> <span className="text-slate-500">// ListAdapter + DiffUtil + Glide + TV Box focus</span></p>
            <p>│   │   └── <strong>GroupAdapter.java</strong> <span className="text-slate-500">// Chips horizontais de categorias</span></p>
            <p>│   ├── <span className="text-amber-400">viewmodel/</span></p>
            <p>│   │   └── <strong>MainViewModel.java</strong> <span className="text-slate-500">// LiveData, pesquisa rápida e estado da UI</span></p>
            <p>│   └── <span className="text-amber-400">ui/</span></p>
            <p>│       ├── <strong>MainActivity.java</strong> <span className="text-slate-500">// Grade de canais, busca e menu de importação</span></p>
            <p>│       └── <strong>PlayerActivity.java</strong> <span className="text-slate-500">// ExoPlayer Media3 Fullscreen com atalhos de controle remoto</span></p>
            <p>└── <span className="text-purple-400 font-bold">util/</span></p>
            <p>    ├── <strong>NetworkUtils.java</strong> <span className="text-slate-500">// Verificação de conectividade ativa</span></p>
            <p>    └── <strong>TvFocusUtils.java</strong> <span className="text-slate-500">// Otimizações visuais para controle remoto</span></p>
          </div>
        </div>
      </section>

      {/* 2. Parser M3U de Alta Performance */}
      <section className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-blue-400 font-bold text-lg">
          <Cpu className="w-5 h-5" />
          <h2>2. O Segredo do Parser M3U (Streaming Sem OutOfMemory)</h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Listas IPTV de operadoras frequentemente ultrapassam <strong>50 MB a 200 MB de texto bruto</strong>.
          Se um desenvolvedor carregar todo o arquivo para uma <code className="text-amber-400">String</code> na memória com <code className="text-amber-400">new String(bytes)</code>,
          o aplicativo sofrerá <strong>OutOfMemoryError (OOM)</strong> imediato no Android.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Nossa Implementação (Recomendada)
            </h3>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
              <li>Leitura linear com <strong>BufferedReader</strong> de 32 KB.</li>
              <li>Compilação estática de <strong>Pattern Regex</strong> (evita recompilação em loop).</li>
              <li>Extração de <code className="text-blue-300">tvg-logo</code>, <code className="text-blue-300">tvg-name</code>, <code className="text-blue-300">group-title</code> e <code className="text-blue-300">http-user-agent</code>.</li>
              <li>Notificação de progresso assíncrona a cada 500 canais processados.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Erros Comuns Evitados
            </h3>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
              <li>Não trava a UI Thread (processamento 100% em Thread secundária via ExecutorService).</li>
              <li>Não falha quando a lista contém linhas em branco ou comentários complexos.</li>
              <li>Suporta streams sem tags #EXTINF (listas simplificadas).</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. RecyclerView e Adapters */}
      <section className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-blue-400 font-bold text-lg">
          <Zap className="w-5 h-5" />
          <h2>3. Adapters e RecyclerView Otimizados para TV Box e Toque</h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Para garantir rolagem a 60 FPS e suporte fluido a <strong>controles remotos de TV Box</strong> (botões direcionais Cima/Baixo/Esquerda/Direita):
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800">
            <h4 className="font-semibold text-blue-300 mb-1">ListAdapter + DiffUtil</h4>
            <p className="text-slate-400 text-[11px]">
              Calcula a diferença entre listas em background com o <code className="text-slate-200">DiffUtil.ItemCallback</code>,
              atualizando apenas os itens modificados sem piscar a tela.
            </p>
          </div>

          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800">
            <h4 className="font-semibold text-blue-300 mb-1">Navegação por D-Pad</h4>
            <p className="text-slate-400 text-[11px]">
              Os cartões possuem <code className="text-slate-200">android:focusable="true"</code> com seletor
              drawable que cria uma borda luminosa ao passar o foco do controle remoto.
            </p>
          </div>

          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800">
            <h4 className="font-semibold text-blue-300 mb-1">Glide com Cache Total</h4>
            <p className="text-slate-400 text-[11px]">
              Configurado com <code className="text-slate-200">DiskCacheStrategy.ALL</code> para evitar
              requisições repetidas de logotipos de canais e economizar dados móveis.
            </p>
          </div>
        </div>
      </section>

      {/* 4. ExoPlayer Media3 */}
      <section className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-blue-400 font-bold text-lg">
          <PlayCircle className="w-5 h-5" />
          <h2>4. Reprodução Nativa com ExoPlayer (AndroidX Media3)</h2>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <p>
            O novo pacote oficial da Google é o <strong>AndroidX Media3</strong> (<code className="text-blue-300">androidx.media3:media3-exoplayer</code>).
            Nossa implementação na <code className="text-blue-300">PlayerActivity.java</code> conta com:
          </p>

          <div className="bg-[#090E1A] p-4 rounded-xl border border-slate-800 font-mono text-[11px] space-y-2">
            <p className="text-blue-400 font-semibold">// 1. Buffer Otimizado para Transmissões Ao Vivo (Live Streams):</p>
            <p className="text-slate-300">DefaultLoadControl.Builder().setBufferDurationsMs(1000, 5000, 500, 1000).build();</p>
            <p className="text-blue-400 font-semibold mt-2">// 2. Suporte a HLS com Inicialização Rápida:</p>
            <p className="text-slate-300">HlsMediaSource.Factory(dataSourceFactory).setAllowChunklessPreparation(true);</p>
            <p className="text-blue-400 font-semibold mt-2">// 3. WakeLock & Prevenção de Bloqueio de Tela:</p>
            <p className="text-slate-300">getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);</p>
          </div>
        </div>
      </section>

      {/* 5. Dicas de Deploy no Android Studio */}
      <section className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2.5 text-blue-400 font-bold text-lg">
          <FileCheck className="w-5 h-5" />
          <h2>5. Como Iniciar o Projeto no Android Studio</h2>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300 leading-relaxed">
          <li>Abra o Android Studio e crie um <strong>New Project</strong> selecionando o template <strong>"Empty Views Activity"</strong> (Linguagem: <strong>Java</strong>, Build Configuration: <strong>Groovy DSL</strong>).</li>
          <li>Copie e cole as dependências do arquivo <code className="text-blue-300 font-mono">build.gradle</code> que disponibilizamos na aba de código.</li>
          <li>No arquivo <code className="text-blue-300 font-mono">AndroidManifest.xml</code>, certifique-se de manter <code className="text-amber-400">android:usesCleartextTraffic="true"</code> (essencial para canais que transmitem em portas HTTP não criptografadas).</li>
          <li>Crie os pacotes <code className="text-blue-300 font-mono">data</code>, <code className="text-blue-300 font-mono">presentation</code> e cole as classes Java fornecidas.</li>
          <li>Sincronize o Gradle (botão <em>Sync Now</em>) e execute em um emulador ou aparelho físico Android / TV Box!</li>
        </ol>
      </section>
    </div>
  );
};
