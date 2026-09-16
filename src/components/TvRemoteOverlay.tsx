import React from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  ArrowLeft, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Tv, 
  X
} from 'lucide-react';

interface TvRemoteOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSelect: () => void;
  onBack: () => void;
  onTogglePlay: () => void;
  isPlaying: boolean;
  onToggleMute: () => void;
  isMuted: boolean;
  onNextChannel: () => void;
  onPrevChannel: () => void;
  onToggleAspectRatio: () => void;
}

export const TvRemoteOverlay: React.FC<TvRemoteOverlayProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelect,
  onBack,
  onTogglePlay,
  isPlaying,
  onToggleMute,
  isMuted,
  onNextChannel,
  onPrevChannel,
  onToggleAspectRatio
}) => {
  if (!isOpen) return null;

  return (
    <div 
      id="tv-remote-modal"
      className="fixed bottom-6 right-6 z-50 bg-[#151D30]/95 backdrop-blur-md border border-blue-500/40 rounded-3xl p-5 shadow-2xl shadow-blue-950/60 w-72 flex flex-col items-center select-none animate-in fade-in slide-in-from-bottom-5"
    >
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs tracking-wider uppercase">
          <Tv className="w-4 h-4" />
          <span>Controle TV Box</span>
        </div>
        <button 
          id="close-remote-btn"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition"
          aria-label="Fechar controle"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 text-center my-3">
        Simulador de botões KeyEvent (DPAD, Enter, Back) do Android TV.
      </p>

      {/* D-PAD Navigation Controller */}
      <div className="relative w-44 h-44 my-2 flex items-center justify-center">
        {/* Outer Circular Base */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-700 shadow-inner" />

        {/* Up Button */}
        <button
          id="remote-up-btn"
          onClick={() => onNavigate('up')}
          className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-t-full active:scale-95 transition"
          title="DPAD_UP"
        >
          <ChevronUp className="w-6 h-6" />
        </button>

        {/* Down Button */}
        <button
          id="remote-down-btn"
          onClick={() => onNavigate('down')}
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-12 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-b-full active:scale-95 transition"
          title="DPAD_DOWN"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Left Button */}
        <button
          id="remote-left-btn"
          onClick={() => onNavigate('left')}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-10 h-12 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-l-full active:scale-95 transition"
          title="DPAD_LEFT"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Right Button */}
        <button
          id="remote-right-btn"
          onClick={() => onNavigate('right')}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-12 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-r-full active:scale-95 transition"
          title="DPAD_RIGHT"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Center OK Button */}
        <button
          id="remote-ok-btn"
          onClick={onSelect}
          className="z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center active:scale-90 transition"
          title="DPAD_CENTER / ENTER"
        >
          OK
        </button>
      </div>

      {/* Control Buttons Grid */}
      <div className="grid grid-cols-3 gap-2 w-full mt-3">
        {/* Back Button */}
        <button
          id="remote-back-btn"
          onClick={onBack}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
          title="KEYCODE_BACK"
        >
          <ArrowLeft className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Voltar</span>
        </button>

        {/* Play/Pause Button */}
        <button
          id="remote-playpause-btn"
          onClick={onTogglePlay}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
          title="KEYCODE_MEDIA_PLAY_PAUSE"
        >
          {isPlaying ? <Pause className="w-4 h-4 mb-0.5" /> : <Play className="w-4 h-4 mb-0.5" />}
          <span className="text-[10px]">{isPlaying ? 'Pausar' : 'Tocar'}</span>
        </button>

        {/* Aspect Ratio Button */}
        <button
          id="remote-aspect-btn"
          onClick={onToggleAspectRatio}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 active:scale-95 transition"
          title="Proporção de Tela"
        >
          <Maximize2 className="w-4 h-4 mb-0.5" />
          <span className="text-[10px]">Aspecto</span>
        </button>
      </div>

      {/* Channel +/- & Mute */}
      <div className="flex items-center justify-between w-full mt-2 gap-2">
        <button
          id="remote-ch-prev-btn"
          onClick={onPrevChannel}
          className="flex-1 py-1.5 px-2 bg-slate-800/60 hover:bg-slate-700 rounded-lg text-slate-300 text-xs font-mono active:scale-95 transition"
        >
          CH -
        </button>
        <button
          id="remote-mute-btn"
          onClick={onToggleMute}
          className="py-1.5 px-3 bg-slate-800/60 hover:bg-slate-700 rounded-lg text-slate-300 active:scale-95 transition"
          title="Mute"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          id="remote-ch-next-btn"
          onClick={onNextChannel}
          className="flex-1 py-1.5 px-2 bg-slate-800/60 hover:bg-slate-700 rounded-lg text-slate-300 text-xs font-mono active:scale-95 transition"
        >
          CH +
        </button>
      </div>
    </div>
  );
};
