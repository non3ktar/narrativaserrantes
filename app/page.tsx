'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, StopCircle, Download, Play, RefreshCw, BookOpen, Film, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type Genre = 'noir' | 'realismo' | 'pastoral' | 'cyberpunk' | 'vhs' | 'vanguarda' | 'manga' | 'anime';

interface GenreConfig {
  id: Genre;
  title: string;
  description: string;
  filter: string;
  musicUrl: string;
  color: string;
  textStyle: string;
  overlayEffect?: 'noise' | 'scanlines' | 'distort' | 'manga' | 'anime-lines';
}

const GENRES: Record<Genre, GenreConfig> = {
  noir: {
    id: 'noir',
    title: 'Noir',
    description: 'P&B cinematográfico. Dramaticidade e sombras profundas.',
    filter: 'grayscale(100%) contrast(150%) brightness(90%)',
    musicUrl: '/audio/noir.mp3',
    color: 'bg-zinc-900',
    textStyle: 'font-serif uppercase tracking-widest',
  },
  realismo: {
    id: 'realismo',
    title: 'Realismo',
    description: 'Cores cruas e dessaturadas. A realidade como ela é.',
    filter: 'saturate(40%) contrast(110%)',
    musicUrl: '/audio/realismo.mp3',
    color: 'bg-stone-800',
    textStyle: 'font-sans font-bold',
  },
  pastoral: {
    id: 'pastoral',
    title: 'Pastoral',
    description: 'Nostalgia sépia e tons quentes. O idílio da memória.',
    filter: 'sepia(70%) saturate(130%) brightness(95%) contrast(90%)',
    musicUrl: '/audio/pastoral.mp3',
    color: 'bg-amber-900',
    textStyle: 'font-serif italic',
  },
  cyberpunk: {
    id: 'cyberpunk',
    title: 'Cyberpunk',
    description: 'Futuro distópico. Neon, roxos vibrantes e tecnocracia.',
    filter: 'hue-rotate(280deg) saturate(250%) contrast(120%) brightness(110%)',
    musicUrl: '/audio/cyberpunk.mp3',
    color: 'bg-fuchsia-900',
    textStyle: 'font-mono uppercase tracking-[0.3em]',
    overlayEffect: 'scanlines',
  },
  vhs: {
    id: 'vhs',
    title: 'Horror VHS',
    description: 'Estética Found Footage. Ruído, tracking e tons frios.',
    filter: 'grayscale(30%) contrast(140%) hue-rotate(100deg) brightness(80%)',
    musicUrl: '/audio/vhs.mp3',
    color: 'bg-slate-900',
    textStyle: 'font-mono italic',
    overlayEffect: 'noise',
  },
  vanguarda: {
    id: 'vanguarda',
    title: 'Vanguarda',
    description: 'Cinema experimental. Inversão de luz e grão pesado.',
    filter: 'invert(100%) contrast(200%) grayscale(100%)',
    musicUrl: '/audio/vanguarda.mp3',
    color: 'bg-white',
    textStyle: 'font-serif font-black underline',
    overlayEffect: 'noise',
  },
  manga: {
    id: 'manga',
    title: 'Mangá',
    description: 'Estética Shonen. Alto contraste, retículas e linhas de ação.',
    filter: 'grayscale(100%) contrast(500%) brightness(120%)',
    musicUrl: '/audio/manga.mp3',
    color: 'bg-white',
    textStyle: 'font-sans font-black uppercase italic',
    overlayEffect: 'manga',
  },
  anime: {
    id: 'anime',
    title: 'Anime',
    description: 'Estética Shonen Moderna. Cores vibrantes, brilho e linhas de ação rápidas.',
    filter: 'saturate(200%) contrast(140%) brightness(110%)',
    musicUrl: '/audio/anime.mp3',
    color: 'bg-cyan-400',
    textStyle: 'font-sans font-black italic tracking-tighter',
    overlayEffect: 'anime-lines',
  }
};

// --- Web Speech API Types (Experimental/Vendor Prefixed) ---
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function NarrativasErrantes() {
  const [view, setView] = useState<'home' | 'recording' | 'preview'>('home');
  const [selectedGenre, setSelectedGenre] = useState<Genre>('noir');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDucked, setIsDucked] = useState(false);
  const [fileSize, setFileSize] = useState<number>(0);
  const [sessionUid, setSessionUid] = useState('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const requestRef = useRef<number>(0);

  // --- Reset/Initialization ---
  const stopAllMedia = React.useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsDucked(false);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null; // Remove listener para evitar loop ao parar
        recognitionRef.current.stop();
      } catch (e) {}
    }
    cancelAnimationFrame(requestRef.current);
  }, []);

  useEffect(() => {
    if (view === 'home') {
      stopAllMedia();
    }
    return () => stopAllMedia(); // Cleanup on unmount
  }, [view, stopAllMedia]);

  // --- Media Logic ---
  const setupAudio = () => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(e => console.warn("Audio play failed, needs user interaction", e));
    }
  };

  const startCanvasLoop = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Set canvas dimensions to match video
    const updateDimensions = () => {
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
    };
    updateDimensions();

    const render = () => {
      if (video.paused || video.ended) return;

      const config = GENRES[selectedGenre];

      // 1. Base Filter (Burned into canvas)
      ctx.filter = config.filter;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // 2. Clear filter for overlay logic to prevent blurring the overlays
      ctx.filter = 'none';

      // 3. ADVANCED PROCESSING: Grain / Noise
      if (config.overlayEffect === 'noise' || config.id === 'vanguarda' || config.id === 'vhs') {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.05})`;
        for (let i = 0; i < 1000; i++) {
          ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
        }
      }

      // 4. ADVANCED PROCESSING: Scanlines (Cyberpunk)
      if (config.overlayEffect === 'scanlines') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let i = 0; i < canvas.height; i += 4) {
          ctx.fillRect(0, i, canvas.width, 1);
        }
      }

      // 5. ADVANCED PROCESSING: MANGA EFFECTS
      if (config.id === 'manga') {
        // Screentone logic (dot pattern)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        for (let x = 0; x < canvas.width; x += 6) {
          for (let y = 0; y < canvas.height; y += 6) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Action Lines (Speed Lines)
        if (isRecording) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.lineWidth = 1;
          for (let i = 0; i < 20; i++) {
             const angle = Math.random() * Math.PI * 2;
             const length = 100 + Math.random() * 200;
             ctx.beginPath();
             ctx.moveTo(canvas.width/2 + Math.cos(angle) * (canvas.width * 0.4), canvas.height/2 + Math.sin(angle) * (canvas.height * 0.4));
             ctx.lineTo(canvas.width/2 + Math.cos(angle) * (canvas.width * 0.4 + length), canvas.height/2 + Math.sin(angle) * (canvas.height * 0.4 + length));
             ctx.stroke();
          }
        }
      }

      // 5.1. ADVANCED PROCESSING: ANIME LINES
      if (config.overlayEffect === 'anime-lines' && isRecording) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        for (let i = 0; i < 30; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radiusStart = Math.min(canvas.width, canvas.height) * 0.35;
          const radiusEnd = Math.min(canvas.width, canvas.height) * 0.6;
          ctx.beginPath();
          ctx.moveTo(centerX + Math.cos(angle) * radiusStart, centerY + Math.sin(angle) * radiusStart);
          ctx.lineTo(centerX + Math.cos(angle) * radiusEnd, centerY + Math.sin(angle) * radiusEnd);
          ctx.stroke();
        }
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0, 255, 255, 0.5)';
      }

      // 5.2. Reset de Efeitos Temporários
      ctx.shadowBlur = 0;

      // 6. ADVANCED PROCESSING: Vignette (Burned)
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.width * 0.2,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.8
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 6. Draw Subtitles
      if (transcript) {
        const padding = 60;
        const fontSize = Math.floor(canvas.height * 0.05);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        
        // Text wrap logic
        const maxWidth = canvas.width * 0.85;
        const words = transcript.split(' ');
        let line = '';
        const lines = [];

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
          } else {
            line = testLine;
          }
        }
        lines.push(line);

        // Keep last 2 lines
        const visibleLines = lines.slice(-2);
        
        visibleLines.forEach((l, i) => {
          const y = canvas.height - padding - (visibleLines.length - 1 - i) * (fontSize + 15);
          
          // Background box
          const textMetrics = ctx.measureText(l);
          const currentGenre = GENRES[selectedGenre];
          const isManga = currentGenre.id === 'manga';
          const isAnime = currentGenre.id === 'anime';

          if (isManga) {
            // Manga "Bubble" Style
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            const bx = canvas.width/2 - textMetrics.width/2 - 20;
            const by = y - fontSize - 5;
            const bw = textMetrics.width + 40;
            const bh = fontSize + 20;
            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeRect(bx, by, bw, bh);
            ctx.fillStyle = 'black';
          } else if (isAnime) {
            // Anime "Impact" Style
            ctx.fillStyle = 'rgba(255, 255, 0, 0.9)'; // Vibrant Yellow
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 4;
            const bx = canvas.width/2 - textMetrics.width/2 - 15;
            const by = y - fontSize - 5;
            const bw = textMetrics.width + 30;
            const bh = fontSize + 20;
            ctx.strokeRect(bx, by, bw, bh);
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = 'black';
          } else {
            // Classic semi-transparent black for other genres
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(
               canvas.width/2 - textMetrics.width/2 - 15,
               y - fontSize,
               textMetrics.width + 30,
               fontSize + 15
            );
            ctx.fillStyle = 'white';
          }

          // Text
          ctx.fillText(l.trim(), canvas.width / 2, y);
        });
      }

      requestRef.current = requestAnimationFrame(render);
    };

    render();
  };

  const setupRecognition = () => {
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition não suportado neste navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let currentResult = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentResult += event.results[i][0].transcript;
      }
      setTranscript(currentResult);
      
      // Simple Ducking Logic
      if (audioRef.current) {
        audioRef.current.volume = 0.1;
        setIsDucked(true);
        // O debounce do ducking é melhor via timer resetável
        const timer = (window as any).duckingTimer;
        if (timer) clearTimeout(timer);
        (window as any).duckingTimer = setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.volume = 0.5;
            setIsDucked(false);
          }
        }, 1500);
      }
    };

    recognition.onend = () => {
      // Reinicia automaticamente se ainda estiver na view de gravação
      if (view === 'recording' && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error", event.error);
      if (event.error === 'not-allowed') {
        setError("Permissão de microfone negada.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // --- Start Recording Flow ---
  const startRecordingSetup = React.useCallback(async () => {
    try {
      setError(null);
      const uid = Date.now().toString(36).toUpperCase();
      setSessionUid(uid);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1920, max: 1920 }, 
          height: { ideal: 1080, max: 1080 } 
        },
        audio: true, 
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
           videoRef.current?.play().then(() => {
             startCanvasLoop();
           });
        };
      }

      setView('recording');
      setupRecognition();
      setupAudio();
    } catch (err: any) {
      setError("Erro ao acessar câmera/microfone: " + err.message);
    }
  }, [selectedGenre, view]); // Adicionado view às dependências

  const handleToggleRecording = () => {
    if (!isRecording) {
      startMediaRecorder();
    } else {
      stopMediaRecorder();
    }
  };

  const startMediaRecorder = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capture canvas stream
    const stream = canvas.captureStream(30); 
    
    // Merge mic audio
    if (videoRef.current?.srcObject) {
      const micStream = videoRef.current.srcObject as MediaStream;
      micStream.getAudioTracks().forEach(track => stream.addTrack(track));
    }

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setFileSize(blob.size);
      const url = URL.createObjectURL(blob);
      setVideoBlobUrl(url);
      setView('preview');
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopMediaRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const downloadVideo = () => {
    if (!videoBlobUrl) return;
    const a = document.createElement('a');
    a.href = videoBlobUrl;
    a.download = `narrativa-${selectedGenre}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink font-sans overflow-x-hidden selection:bg-brand-accent selection:text-white">
      {/* Hidden Video Feed for Canvas Processing */}
      <video ref={videoRef} className="hidden" playsInline muted />
      
      {/* Hidden Background Music */}
      <audio ref={audioRef} loop src={GENRES[selectedGenre].musicUrl} />

      <AnimatePresence mode="wait">
        {/* VIEW: HOME */}
        {view === 'home' && (
          <motion.main
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col lg:grid lg:grid-cols-[320px_1fr] gap-[1px] bg-brand-line min-h-screen"
          >
            <aside className="bg-brand-bg p-8 flex flex-col justify-between border-b lg:border-b-0 border-brand-line">
              <div>
                <header className="mb-12">
                  <div className="flex items-center gap-4 mb-6">
                    <img 
                      src="/icons/icon-192x192.png" 
                      alt="Logo Narrativas Errantes" 
                      className="w-16 h-16 rounded-2xl shadow-2xl border border-brand-line"
                    />
                    <div className="inline-block bg-brand-accent text-white px-2 py-0.5 text-[10px] font-bold tracking-[0.2em] uppercase">
                      Unidade de Campo v1.0
                    </div>
                  </div>
                  <h1 className="text-4xl font-black tracking-tighter leading-none mb-2">
                    NARRATIVAS<br/>ERRANTES
                  </h1>
                  <span className="text-[10px] opacity-40 uppercase tracking-widest">Motor de Narrativa Mobile-First</span>
                </header>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest opacity-40 mb-3 block">Instruções</label>
                    <p className="text-sm opacity-60 leading-relaxed">
                      Selecione uma atmosfera literária. Ao iniciar, narre sua história enquanto caminha. O sistema transcreverá sua voz e aplicará a estética escolhida em tempo real.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 lg:mt-0">
                <button
                  id="btn-iniciar"
                  onClick={startRecordingSetup}
                  className="w-full bg-brand-accent text-white py-6 text-lg font-black tracking-tight flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] transition-all shadow-2xl rounded-sm"
                >
                  <Camera size={24} /> INICIAR UNIT
                </button>
              </div>
            </aside>

            <section className="bg-brand-bg p-6 lg:p-12 overflow-y-auto">
              <label className="text-[10px] uppercase tracking-widest opacity-40 mb-8 block lg:mb-12">Atmosferas Disponíveis</label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {(Object.values(GENRES) as GenreConfig[]).map((genre) => (
                  <button
                    key={genre.id}
                    id={`genre-${genre.id}`}
                    onClick={() => setSelectedGenre(genre.id)}
                    className={`bento-card group flex flex-col text-left h-full min-h-[240px] justify-between
                      ${selectedGenre === genre.id ? 'bento-card-active ring-1 ring-brand-accent' : 'hover:border-brand-ink/30'}
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <div className={`w-8 h-8 rounded-full ${genre.color} border border-white/20`} />
                      {selectedGenre === genre.id && <div className="text-brand-accent font-mono text-[10px]">SELECIONADO</div>}
                    </div>
                    
                    <div>
                      <h3 className="text-3xl font-black mb-2 tracking-tighter">{genre.title}</h3>
                      <p className="text-xs opacity-50 font-medium leading-relaxed max-w-[200px]">{genre.description}</p>
                    </div>

                    <div className="mt-6 pt-6 border-t border-brand-line flex items-center justify-between">
                      <span className="text-[10px] opacity-40 font-mono">CANAL: {genre.id.toUpperCase()}</span>
                      <Play size={14} className="opacity-40" />
                    </div>
                  </button>
                ))}
              </div>

              {error && (
                <div className="mt-8 p-4 bg-brand-accent/20 border border-brand-accent text-brand-accent text-xs font-bold uppercase tracking-widest">
                  {error}
                </div>
              )}
            </section>
          </motion.main>
        )}

        {/* VIEW: RECORDING */}
        {view === 'recording' && (
          <motion.div
            key="recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-brand-bg flex flex-col lg:grid lg:grid-cols-[300px_1fr] gap-[1px] bg-brand-line"
          >
            <aside className="bg-brand-bg p-6 lg:p-8 flex flex-col lg:h-full z-10">
              <div className="mb-8 hidden lg:block">
                <h2 className="text-xl font-black tracking-tighter">NARRATIVAS</h2>
                <span className="text-[10px] opacity-40 uppercase tracking-widest">Sessão de Gravação</span>
              </div>

              <div className="space-y-4 flex-1">
                <div className="bento-card bg-brand-bg/50">
                  <label className="text-[10px] uppercase tracking-widest opacity-40 mb-3 block">Atmosfera Ativa</label>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${GENRES[selectedGenre].color}`} />
                    <span className="font-bold tracking-tight">{GENRES[selectedGenre].title}</span>
                  </div>
                </div>

                <div className="bento-card bg-brand-bg/50">
                  <label className="text-[10px] uppercase tracking-widest opacity-40 mb-3 block">Monitor de Áudio</label>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-[9px] mb-1 opacity-60">
                        <span>VOZ (TRANSCRIÇÃO)</span>
                        <span>-12dB</span>
                      </div>
                      <div className="h-1 bg-brand-line overflow-hidden rounded-full">
                        <motion.div 
                          className="h-full bg-green-400"
                          animate={{ width: transcript ? ['60%', '80%', '65%'] : '5%' }}
                          transition={{ repeat: Infinity, duration: 0.5 }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] mb-1 opacity-60">
                        <span>MÁSCARA DE ÁUDIO</span>
                        <span>{isDucked ? '-24dB (ATENUADO)' : '-12dB'}</span>
                      </div>
                      <div className="h-1 bg-brand-line overflow-hidden rounded-full">
                        <div 
                          className="h-full bg-blue-400 transition-all duration-300" 
                          style={{ width: isDucked ? '20%' : '60%' }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8 flex flex-col items-center">
                <button
                  id="btn-record-toggle"
                  onClick={handleToggleRecording}
                  className="group relative flex items-center justify-center w-20 h-20 bg-transparent border-4 border-brand-ink rounded-full transition-all active:scale-90"
                >
                  <div className={`transition-all duration-300 ${isRecording ? 'w-8 h-8 rounded-sm' : 'w-10 h-10 rounded-full'} bg-brand-accent`} />
                  {isRecording && <div className="absolute inset-[-8px] border-2 border-brand-accent rounded-full animate-ping opacity-20" />}
                </button>
                <span className="text-[10px] font-black tracking-widest uppercase mt-4 text-brand-accent">
                  {isRecording ? 'GRAVANDO' : 'PRONTO'}
                </span>
              </div>
            </aside>

            <main className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
              {/* Grid Lines Overlay */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="border-[0.5px] border-white/5" />
                ))}
              </div>

              <canvas 
                ref={canvasRef} 
                className="w-full h-full object-contain"
              />
              
              {/* Viewfinder HUD */}
              <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-20">
                <div className="flex justify-between items-start font-mono text-[10px] opacity-70">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-brand-accent animate-pulse' : 'bg-white/40'}`} />
                    GRAVANDO ● AO VIVO
                  </div>
                  <div>ISO 800 | 1/60 | f2.8</div>
                </div>

                <div className="flex justify-between items-end font-mono text-[10px] opacity-70">
                  <div>4K 24FPS</div>
                  <div>BAT 88% | {selectedGenre.toUpperCase()}</div>
                </div>
              </div>

              <button 
                id="btn-cancelar"
                onClick={() => setView('home')}
                className="absolute top-6 right-6 p-4 lg:hidden bg-black/60 backdrop-blur-md rounded-full text-white z-30"
              >
                <RefreshCw size={20} />
              </button>
            </main>
          </motion.div>
        )}

        {/* VIEW: PREVIEW */}
        {view === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-5xl">
              <div className="flex justify-between items-end mb-8 border-b border-brand-line pb-6">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-1">OBRA FINALIZADA</h2>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest font-mono">STATUS_EXPORTAÇÃO: PRONTO_PARA_DOWNLOAD</p>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] opacity-40 uppercase tracking-widest block mb-1">ATMOSFERA</span>
                  <span className="font-mono text-xs">{selectedGenre.toUpperCase()}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-1 bg-brand-line border border-brand-line">
                <div className="lg:col-span-3 bg-black aspect-video flex items-center justify-center overflow-hidden">
                  {videoBlobUrl && (
                    <video src={videoBlobUrl} controls className="w-full h-full" autoPlay />
                  )}
                </div>
                <div className="lg:col-span-1 bg-brand-bg p-8 flex flex-col gap-4">
                  <button
                    id="btn-download"
                    onClick={downloadVideo}
                    className="w-full bg-brand-ink text-brand-bg py-6 text-lg font-black flex items-center justify-center gap-3 hover:bg-brand-ink/90 transition-all rounded-sm"
                  >
                    <Download size={20} /> SALVAR
                  </button>
                  <button
                    id="btn-novo"
                    onClick={() => setView('home')}
                    className="w-full border border-brand-line bg-brand-card py-6 text-lg font-black flex items-center justify-center gap-3 hover:bg-brand-line transition-all rounded-sm"
                  >
                    <RefreshCw size={20} /> NOVO
                  </button>

                  <div className="mt-auto pt-8">
                    <label className="text-[9px] uppercase tracking-widest opacity-30 mb-2 block">Metadados</label>
                    <div className="space-y-2 font-mono text-[9px] opacity-40">
                      <div>TAMANHO: ~{(fileSize / 1024 / 1024).toFixed(2)} MB</div>
                      <div>FORMATO: WEBM/VP9</div>
                      <div>ID_ÚNICO: {sessionUid}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        body {
          background: black;
          user-select: none;
        }
        .safe-bottom {
          padding-bottom: max(2.5rem, env(safe-area-inset-bottom));
        }
      `}</style>
    </div>
  );
}
