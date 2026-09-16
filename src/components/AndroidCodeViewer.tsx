import React, { useState } from 'react';
import { ANDROID_FILES } from '../data/androidProjectFiles';
import { AndroidFile } from '../types';
import { Copy, Check, FileCode, Folder, Download, Terminal, Sparkles } from 'lucide-react';

export const AndroidCodeViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<AndroidFile>(ANDROID_FILES[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const element = document.createElement('a');
    const file = new Blob([selectedFile.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = selectedFile.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const categories = [
    { key: 'gradle', label: 'Gradle & Config', badge: 'Build' },
    { key: 'manifest', label: 'Manifest & Permissões', badge: 'Config' },
    { key: 'model', label: 'Entidades de Domínio', badge: 'Model' },
    { key: 'parser', label: 'Parser M3U / M3U8', badge: 'Core' },
    { key: 'repository', label: 'Repositório & Rede', badge: 'Data' },
    { key: 'viewmodel', label: 'ViewModel & LiveData', badge: 'MVVM' },
    { key: 'adapter', label: 'Adapters & ListAdapter', badge: 'UI' },
    { key: 'ui', label: 'Activities & ExoPlayer', badge: 'Media3' },
    { key: 'layout', label: 'Layouts XML', badge: 'XML' },
    { key: 'drawable', label: 'Seletores & Recursos', badge: 'Res' },
  ];

  return (
    <div id="android-code-viewer" className="flex flex-col lg:flex-row h-[85vh] bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Sidebar: Arquivos e Estrutura do Android Studio */}
      <div className="w-full lg:w-80 bg-[#131C31] border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 bg-[#0B132B]">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <Folder className="w-4 h-4" />
            <span>Estrutura de Pacotes (Android Studio)</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Projeto nativo Java com Clean Architecture e AndroidX Media3.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-3 custom-scrollbar">
          {categories.map((cat) => {
            const filesInCat = ANDROID_FILES.filter((f) => f.category === cat.key);
            if (filesInCat.length === 0) return null;

            return (
              <div key={cat.key} className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                  <span>{cat.label}</span>
                  <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-300">
                    {cat.badge}
                  </span>
                </div>
                {filesInCat.map((file) => {
                  const isSelected = selectedFile.path === file.path;
                  return (
                    <button
                      key={file.path}
                      id={`file-btn-${file.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center gap-2.5 transition-all ${
                        isSelected
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-medium'
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`}
                    >
                      <FileCode
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-blue-400' : 'text-slate-500'
                        }`}
                      />
                      <span className="truncate">{file.name}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main: Visualizador de Código */}
      <div className="flex-1 flex flex-col bg-[#0B1120] overflow-hidden">
        {/* Header do Arquivo */}
        <div className="p-4 bg-[#11192C] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white font-mono">
                {selectedFile.name}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {selectedFile.path}
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">{selectedFile.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="copy-code-btn"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition"
              title="Copiar código para colar no Android Studio"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar Código</span>
                </>
              )}
            </button>

            <button
              id="download-file-btn"
              onClick={handleDownloadFile}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-500/20 transition"
              title="Baixar arquivo individual"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Arquivo</span>
            </button>
          </div>
        </div>

        {/* Linha de status */}
        <div className="px-4 py-1.5 bg-[#0e172a] border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>Linguagem: <strong className="text-slate-200 uppercase">{selectedFile.language}</strong></span>
            <span>•</span>
            <span>Linhas: <strong className="text-slate-200">{selectedFile.content.split('\n').length}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Sparkles className="w-3 h-3" />
            <span>100% Java / Media3 Compatível</span>
          </div>
        </div>

        {/* Bloco de Código com Scroll */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-[#090E1A]">
          <pre className="text-xs font-mono text-slate-200 leading-relaxed tab-4 select-text">
            <code>
              {selectedFile.content.split('\n').map((line, idx) => (
                <div key={idx} className="table-row hover:bg-slate-800/30 rounded px-1">
                  <span className="table-cell pr-4 select-none text-slate-600 text-right w-10 font-mono text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="table-cell whitespace-pre">{line || ' '}</span>
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};
