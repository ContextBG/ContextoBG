/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { 
  Send, 
  Mic, 
  MicOff, 
  History, 
  Info, 
  Trophy, 
  AlertCircle,
  Loader2,
  ChevronRight,
  MoreVertical,
  Lightbulb,
  Flag,
  Settings,
  HelpCircle,
  MessageSquare,
  Calendar,
  User,
  X,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  validateWord, 
  getSimilarityRank, 
  getDailySecretWord, 
  transcribeAudio,
  getHint,
  type GuessResult 
} from './services/geminiService';

import confetti from 'canvas-confetti';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Modal = ({ isOpen, onClose, title, children, darkMode }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, darkMode: boolean }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className={cn("absolute inset-0 backdrop-blur-md", darkMode ? "bg-black/90" : "bg-slate-900/40")}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 30, stiffness: 400 }}
          className={cn(
            "relative w-full max-w-lg rounded-[2rem] md:rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] p-6 md:p-10 overflow-hidden border backdrop-blur-3xl",
            darkMode ? "bg-slate-900/95 border-white/10" : "bg-white/98 border-black/5"
          )}
        >
          <div className="flex items-center justify-between mb-6 md:mb-10">
            <h2 className={cn("text-2xl md:text-3xl font-black tracking-tighter", darkMode ? "text-white" : "text-slate-950")}>{title}</h2>
            <button onClick={onClose} className={cn("p-2 md:p-3 rounded-full transition-all active:scale-75", darkMode ? "hover:bg-white/10" : "hover:bg-black/5")}>
              <X size={20} className={darkMode ? "text-slate-500" : "text-slate-400"} />
            </button>
          </div>
          <div className={cn("leading-relaxed text-sm md:text-base font-medium max-h-[70vh] overflow-y-auto custom-scrollbar pr-2", darkMode ? "text-slate-400" : "text-slate-600")}>
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default function App() {
  const [secretWord, setSecretWord] = useState<string>('');
  const [guess, setGuess] = useState('');
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWon, setIsWon] = useState(false);
  const [isGivenUp, setIsGivenUp] = useState(false);
  const [streak, setStreak] = useState(0);
  const [lastWinDate, setLastWinDate] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastPlayedDate = localStorage.getItem('contexto_bg_date');
    const savedGuesses = localStorage.getItem('contexto_bg_guesses');
    const savedDarkMode = localStorage.getItem('contexto_bg_dark') === 'true';
    const savedStreak = parseInt(localStorage.getItem('contexto_bg_streak') || '0');
    const savedLastWinDate = localStorage.getItem('contexto_bg_last_win');
    
    setDarkMode(savedDarkMode);
    
    // Streak reset logic
    if (savedLastWinDate) {
      const todayDate = new Date();
      const lastWin = new Date(savedLastWinDate);
      const diffTime = Math.abs(todayDate.getTime() - lastWin.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1 && savedLastWinDate !== today) {
        setStreak(0);
        localStorage.setItem('contexto_bg_streak', '0');
      } else {
        setStreak(savedStreak);
      }
    } else {
      setStreak(0);
    }
    
    setLastWinDate(savedLastWinDate);

    if (lastPlayedDate !== today) {
      const newWord = getDailySecretWord();
      setSecretWord(newWord);
      setGuesses([]);
      setIsWon(false);
      setIsGivenUp(false);
      localStorage.setItem('contexto_bg_secret', newWord);
      localStorage.setItem('contexto_bg_date', today);
      localStorage.removeItem('contexto_bg_guesses');
      localStorage.removeItem('contexto_bg_given_up');
    } else {
      const savedWord = localStorage.getItem('contexto_bg_secret') || getDailySecretWord();
      const savedGivenUp = localStorage.getItem('contexto_bg_given_up') === 'true';
      setSecretWord(savedWord);
      setIsGivenUp(savedGivenUp);
      if (savedGuesses) {
        const parsed = JSON.parse(savedGuesses);
        setGuesses(parsed);
        if (parsed.some((g: GuessResult) => g.rank === 1)) {
          setIsWon(true);
        }
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('contexto_bg_dark', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('contexto_bg_guesses', JSON.stringify(guesses));
  }, [guesses]);

  useEffect(() => {
    localStorage.setItem('contexto_bg_given_up', isGivenUp.toString());
  }, [isGivenUp]);

  useEffect(() => {
    localStorage.setItem('contexto_bg_streak', streak.toString());
    if (lastWinDate) localStorage.setItem('contexto_bg_last_win', lastWinDate);
  }, [streak, lastWinDate]);

  const updateStreak = () => {
    const today = new Date().toISOString().split('T')[0];
    if (lastWinDate === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastWinDate === yesterdayStr) {
      setStreak(prev => prev + 1);
    } else {
      setStreak(1);
    }
    setLastWinDate(today);
  };

  const handleGuess = async (wordToGuess?: string) => {
    const targetWord = (wordToGuess || guess).trim().toLowerCase();
    if (!targetWord) return;
    if (isWon) return;

    setError(null);

    if (targetWord.split(/\s+/).length > 1) {
      setError('Можете да въвеждате само по една дума.');
      return;
    }

    if (guesses.some(g => g.word === targetWord)) {
      setError('Вече сте пробвали тази дума.');
      return;
    }

    setIsLoading(true);

    try {
      const validation = await validateWord(targetWord);
      if (!validation.isValid) {
        setError(validation.error || 'Невалидна дума.');
        setIsLoading(false);
        return;
      }

      const result = await getSimilarityRank(targetWord, secretWord);
      const newGuesses = [result, ...guesses].sort((a, b) => a.rank - b.rank);
      setGuesses(newGuesses);
      setGuess('');

      if (result.rank === 1) {
        setIsWon(true);
        updateStreak();
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#34d399', '#059669']
        });
      }
    } catch (err) {
      setError('Възникна грешка. Моля, опитайте пак.');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsLoading(true);
          try {
            const transcribed = await transcribeAudio(base64Audio);
            if (transcribed) {
              setGuess(transcribed);
              handleGuess(transcribed);
            }
          } catch (err) {
            setError('Грешка при транскрипцията.');
          } finally {
            setIsLoading(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Няма достъп до микрофона.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const resetGame = () => {
    // No longer allowing manual reset for daily word
  };

  const handleHint = async () => {
    if (guesses.length === 0) return;
    setIsHintLoading(true);
    try {
      const hint = await getHint(guesses, secretWord);
      setHintText(hint);
      setActiveModal('hint');
    } catch (e) {
      setError('Неуспешно генериране на подсказка.');
    } finally {
      setIsHintLoading(false);
    }
  };

  const handleGiveUp = () => {
    setActiveModal('give-up-confirm');
  };

  const confirmGiveUp = () => {
    setActiveModal(null);
    setShowMenu(false);
    
    if (!secretWord) return;

    const result: GuessResult = {
      word: secretWord,
      rank: 1,
      score: 100
    };
    
    setGuesses(prev => {
      if (prev.some(g => g.word === secretWord)) return prev;
      return [result, ...prev].sort((a, b) => a.rank - b.rank);
    });
    setIsWon(true);
    setIsGivenUp(true);
    
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#059669']
    });
  };

  const getRankFeedback = (rank: number) => {
    if (rank === 1) return {
      bg: 'bg-emerald-500',
      lightBg: darkMode ? 'bg-emerald-500/10' : 'bg-emerald-50/80',
      border: darkMode ? 'border-emerald-500/20' : 'border-emerald-200',
      text: darkMode ? 'text-emerald-400' : 'text-emerald-950',
      rankText: 'text-emerald-600',
      shadow: darkMode ? 'shadow-[0_20px_40px_-15px_rgba(16,185,129,0.4)]' : 'shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)]'
    };
    if (rank <= 300) return {
      bg: 'bg-emerald-400',
      lightBg: darkMode ? 'bg-emerald-400/5' : 'bg-emerald-50/40',
      border: darkMode ? 'border-emerald-400/10' : 'border-emerald-100',
      text: darkMode ? 'text-emerald-400' : 'text-emerald-900',
      rankText: 'text-emerald-600',
      shadow: 'shadow-none'
    };
    if (rank <= 1500) return {
      bg: 'bg-amber-400',
      lightBg: darkMode ? 'bg-amber-400/5' : 'bg-amber-50/40',
      border: darkMode ? 'border-amber-400/10' : 'border-amber-100',
      text: darkMode ? 'text-amber-400' : 'text-amber-900',
      rankText: 'text-amber-600',
      shadow: 'shadow-none'
    };
    if (rank <= 5000) return {
      bg: 'bg-orange-400',
      lightBg: darkMode ? 'bg-orange-400/5' : 'bg-orange-50/40',
      border: darkMode ? 'border-orange-400/10' : 'border-orange-100',
      text: darkMode ? 'text-orange-400' : 'text-orange-900',
      rankText: 'text-orange-600',
      shadow: 'shadow-none'
    };
    return {
      bg: darkMode ? 'bg-slate-700' : 'bg-slate-300',
      lightBg: darkMode ? 'bg-white/[0.02]' : 'bg-white',
      border: darkMode ? 'border-white/5' : 'border-black/5',
      text: darkMode ? 'text-slate-400' : 'text-slate-800',
      rankText: darkMode ? 'text-slate-600' : 'text-slate-400',
      shadow: darkMode ? 'shadow-none' : 'shadow-sm shadow-slate-100'
    };
  };

  const menuItems = [
    { icon: <HelpCircle size={18} />, label: 'Как се играе', onClick: () => setActiveModal('how-to-play') },
    { icon: <Lightbulb size={18} />, label: 'Подсказка', onClick: handleHint, disabled: guesses.length === 0 || isWon, loading: isHintLoading },
    { icon: <Flag size={18} />, label: 'Предавам се', onClick: handleGiveUp, disabled: isWon },
    { icon: <Calendar size={18} />, label: 'Предишни игри', onClick: () => setActiveModal('history') },
    { icon: <Settings size={18} />, label: 'Настройки', onClick: () => setActiveModal('settings') },
    { icon: <MessageSquare size={18} />, label: 'Обратна връзка', onClick: () => setActiveModal('feedback') },
    { icon: <HelpCircle size={18} />, label: 'Често задавани въпроси', onClick: () => setActiveModal('faq') },
  ];

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-emerald-100 overflow-x-hidden transition-colors duration-700 relative",
      darkMode ? "bg-[#050505] text-slate-100" : "bg-[#FDFDFD] text-slate-900"
    )}>
      {/* Atmospheric Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div 
          animate={{ 
            opacity: darkMode ? [0.05, 0.1, 0.05] : [0.05, 0.1, 0.05],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "absolute -top-[10%] -right-[5%] w-[60%] h-[60%] rounded-full blur-[100px] transition-colors duration-1000",
            guesses.length > 0 && guesses[0].rank <= 300 ? "bg-emerald-500/30" : "bg-blue-500/20"
          )}
        />
        <motion.div 
          animate={{ 
            opacity: darkMode ? [0.03, 0.08, 0.03] : [0.03, 0.08, 0.03],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "absolute -bottom-[5%] -left-[5%] w-[50%] h-[50%] rounded-full blur-[80px] transition-colors duration-1000",
            guesses.length > 0 && guesses[0].rank <= 1500 ? "bg-amber-500/30" : "bg-purple-500/20"
          )}
        />
      </div>

      {/* Premium Header */}
      <header className={cn(
        "fixed top-0 left-0 right-0 h-20 md:h-24 border-b z-50 flex items-center justify-between px-6 md:px-10 transition-all duration-500",
        darkMode ? "bg-black/60 backdrop-blur-3xl border-white/5" : "bg-white/60 backdrop-blur-3xl border-black/5"
      )}>
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 md:gap-4"
        >
          <div className={cn(
            "w-10 h-10 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center text-white font-black shadow-2xl transform transition-all duration-500 hover:scale-110 active:scale-95 cursor-pointer",
            darkMode ? "bg-emerald-600 shadow-emerald-500/20" : "bg-slate-950 shadow-slate-900/20"
          )}>К</div>
          <div>
            <h1 className={cn("text-xl md:text-2xl font-black tracking-tighter leading-none mb-1", darkMode ? "text-white" : "text-slate-950")}>Контексто</h1>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">България</p>
            </div>
          </div>
        </motion.div>
        
        <div className="relative flex items-center gap-2">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={cn(
              "p-3 md:p-4 rounded-xl md:rounded-2xl transition-all active:scale-75",
              darkMode ? "hover:bg-white/5 text-slate-500" : "hover:bg-black/5 text-slate-400"
            )}
            title={darkMode ? "Превключи към светъл режим" : "Превключи към тъмен режим"}
          >
            {darkMode ? <Sun size={20} className="md:w-6 md:h-6" /> : <Moon size={20} className="md:w-6 md:h-6" />}
          </button>

          <button 
            onClick={() => setShowMenu(!showMenu)}
            className={cn(
              "p-3 md:p-4 rounded-xl md:rounded-2xl transition-all active:scale-75",
              showMenu 
                ? (darkMode ? "bg-white/10 text-white" : "bg-black/5 text-slate-950") 
                : (darkMode ? "hover:bg-white/5 text-slate-500" : "hover:bg-black/5 text-slate-400")
            )}
          >
            <MoreVertical size={20} className="md:w-6 md:h-6" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowMenu(false)}
                  className="fixed inset-0 z-40"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10, x: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10, x: 10 }}
                  transition={{ type: "spring", damping: 25, stiffness: 400 }}
                  className={cn(
                    "absolute right-0 top-full mt-4 w-64 md:w-80 rounded-[1.5rem] md:rounded-[2rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)] border p-2 md:p-3 z-50 overflow-hidden backdrop-blur-3xl",
                    darkMode ? "bg-slate-900/95 border-white/10" : "bg-white/98 border-black/5"
                  )}
                >
                  <div className="grid grid-cols-1 gap-0.5">
                    {menuItems.map((item, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => { item.onClick(); if(!item.loading) setShowMenu(false); }}
                        disabled={item.disabled || item.loading}
                        className={cn(
                          "w-full flex items-center justify-between px-4 md:px-6 py-3 md:py-3.5 rounded-xl md:rounded-[1.25rem] transition-all text-sm md:text-base font-bold",
                          item.disabled 
                            ? "opacity-20 cursor-not-allowed" 
                            : (darkMode ? "hover:bg-white/5 text-slate-200" : "hover:bg-black/5 text-slate-800 active:scale-[0.98]")
                        )}
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <span className={cn("transition-colors", item.disabled ? (darkMode ? "text-slate-700" : "text-slate-200") : "text-slate-400 group-hover:text-slate-900")}>
                            {item.loading ? <Loader2 size={18} className="animate-spin md:w-5 md:h-5" /> : item.icon}
                          </span>
                          {item.label}
                        </div>
                        {item.loading && <span className="text-[10px] md:text-[11px] text-emerald-500 font-black animate-pulse uppercase">AI</span>}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="max-w-2xl mx-auto pt-28 md:pt-40 pb-40 px-5 md:px-8 relative z-10">
        {/* Win State */}
        <AnimatePresence>
          {isWon && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={cn(
                "mb-10 md:mb-16 p-8 md:p-12 border rounded-[2.5rem] md:rounded-[3rem] text-center relative overflow-hidden group transition-all duration-700",
                darkMode ? "bg-emerald-500/5 border-emerald-500/20 shadow-[0_40px_100px_-20px_rgba(16,185,129,0.2)]" : "bg-emerald-50/50 border-emerald-100 shadow-[0_40px_100px_-20px_rgba(16,185,129,0.1)]"
              )}
            >
              <Trophy className={cn("mx-auto mb-6 md:mb-8 drop-shadow-2xl", darkMode ? "text-emerald-400" : "text-emerald-600")} size={64} />
              <h2 className={cn("text-4xl md:text-5xl font-black mb-2 md:mb-3 tracking-tighter", darkMode ? "text-white" : "text-slate-950")}>
                {isGivenUp ? "Играта приключи" : "Браво!"}
              </h2>
              <p className={cn("mb-3 md:mb-4 text-lg md:text-xl font-medium", darkMode ? "text-emerald-400/80" : "text-emerald-700/80")}>
                Тайната дума беше: <span className={cn("font-black uppercase tracking-[0.2em]", darkMode ? "text-emerald-300" : "text-emerald-900")}>{secretWord}</span>
              </p>
              <div className={cn("inline-flex items-center gap-2 md:gap-3 px-5 md:px-6 py-2 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-widest", darkMode ? "bg-emerald-500/10 text-emerald-500" : "bg-emerald-100 text-emerald-700")}>
                Елате пак утре за нова дума
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="relative mb-16 md:mb-24">
          <motion.div 
            layout
            animate={error ? { 
              x: [0, -10, 10, -10, 10, 0],
              transition: { duration: 0.4 }
            } : { x: 0 }}
            className={cn(
              "flex items-center gap-2 md:gap-4 p-2 md:p-4 rounded-[2rem] md:rounded-[2.5rem] border transition-all duration-700 shadow-xl overflow-hidden",
              darkMode ? "bg-white/[0.04] border-white/10 shadow-black/20" : "bg-white border-black/5 shadow-slate-200/50",
              isLoading 
                ? (darkMode ? "ring-[10px] md:ring-[15px] ring-emerald-500/10 border-emerald-500/30" : "border-emerald-200 ring-[10px] md:ring-[15px] ring-emerald-50/50") 
                : (darkMode ? "focus-within:border-white/20 focus-within:ring-[10px] md:focus-within:ring-[15px] focus-within:ring-white/[0.02]" : "focus-within:border-black/10 focus-within:ring-[10px] md:focus-within:ring-[15px] focus-within:ring-black/[0.02]")
            )}
          >
            <input 
              type="text"
              value={guess}
              onChange={(e) => {
                setGuess(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
              placeholder="Напишете дума..."
              disabled={isLoading || isWon}
              className={cn(
                "flex-1 min-w-0 bg-transparent px-4 md:px-8 py-3 md:py-6 outline-none text-lg md:text-3xl font-black tracking-tighter",
                darkMode ? "text-white placeholder:text-slate-700" : "text-slate-950 placeholder:text-slate-200"
              )}
            />
            
            <div className="flex items-center gap-1.5 md:gap-3 pr-1 md:pr-2">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || isWon}
                className={cn(
                  "p-3 md:p-5 rounded-xl md:rounded-[1.75rem] transition-all active:scale-75 shrink-0",
                  isRecording 
                    ? "bg-red-500 text-white shadow-2xl shadow-red-500/40 animate-pulse" 
                    : (darkMode ? "hover:bg-white/5 text-slate-600" : "hover:bg-black/5 text-slate-400")
                )}
              >
                {isRecording ? <MicOff size={20} className="md:w-8 md:h-8" /> : <Mic size={20} className="md:w-8 md:h-8" />}
              </button>
              
              <button
                onClick={() => handleGuess()}
                disabled={isLoading || isWon || !guess.trim()}
                className={cn(
                  "p-3 md:p-5 rounded-xl md:rounded-[1.75rem] transition-all active:scale-75 shrink-0",
                  guess.trim() && !isLoading 
                    ? (darkMode ? "bg-emerald-600 text-white shadow-2xl shadow-emerald-500/40" : "bg-slate-950 text-white shadow-[0_30px_60px_-10px_rgba(0,0,0,0.4)]") 
                    : (darkMode ? "bg-white/5 text-slate-800" : "bg-black/5 text-slate-100")
                )}
              >
                {isLoading ? <Loader2 size={20} className="animate-spin md:w-8 md:h-8" /> : <Send size={20} className="md:w-8 md:h-8" />}
              </button>
            </div>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute -bottom-8 left-4 md:left-8 flex items-center gap-2 text-red-500 text-[10px] md:text-xs font-bold uppercase tracking-wider z-20"
              >
                <AlertCircle size={14} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Buttons & Stats Under Input */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 mb-20"
        >
          {/* Stats Block - Only show if there are guesses */}
          {guesses.length > 0 && (
            <div className={cn(
              "flex items-center gap-4 md:gap-6 px-6 md:px-8 py-4 rounded-3xl border text-[10px] font-black uppercase tracking-[0.2em]",
              darkMode ? "bg-white/5 border-white/10 text-slate-400" : "bg-black/5 border-black/5 text-slate-500"
            )}>
              <div className="flex flex-col items-center">
                <span className="opacity-40 mb-1">Опити</span>
                <span className={cn("text-base md:text-lg tracking-tighter", darkMode ? "text-white" : "text-slate-900")}>{guesses.length}</span>
              </div>
              <div className="w-px h-8 bg-current opacity-10" />
              <div className="flex flex-col items-center">
                <span className="opacity-40 mb-1">Най-добър</span>
                <span className={cn("text-base md:text-lg tracking-tighter", darkMode ? "text-emerald-400" : "text-emerald-600")}>#{guesses[0].rank.toLocaleString()}</span>
              </div>
              <div className="w-px h-8 bg-current opacity-10" />
              <div className="flex flex-col items-center">
                <span className="opacity-40 mb-1">Серия</span>
                <span className={cn("text-base md:text-lg tracking-tighter", darkMode ? "text-orange-400" : "text-orange-600")}>{streak}</span>
              </div>
            </div>
          )}

          {/* Buttons Row */}
          {!isWon && (
            <div className="flex items-center gap-4">
              {guesses.length > 0 && (
                <button
                  onClick={handleHint}
                  disabled={isHintLoading}
                  className={cn(
                    "flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all active:scale-95",
                    darkMode ? "bg-white/5 hover:bg-white/10 text-slate-400" : "bg-black/5 hover:bg-black/10 text-slate-500"
                  )}
                >
                  {isHintLoading ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
                  Подсказка
                </button>
              )}
              <button
                onClick={handleGiveUp}
                className={cn(
                  "flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all active:scale-95",
                  darkMode ? "bg-red-500/10 hover:bg-red-500/20 text-red-400" : "bg-red-50 hover:bg-red-100 text-red-600"
                )}
              >
                <Flag size={16} />
                Предавам се
              </button>
            </div>
          )}
        </motion.div>

        {/* Guesses List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className={cn(
              "text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3",
              darkMode ? "text-slate-600" : "text-slate-300"
            )}>
              <History size={16} />
              История ({guesses.length})
            </h3>
          </div>

          <div className="space-y-6 pr-1 custom-scrollbar" ref={scrollRef}>
            <LayoutGroup>
              <AnimatePresence initial={false}>
                {guesses.map((g, i) => {
                  const feedback = getRankFeedback(g.rank);
                  return (
                    <motion.div
                      layout
                      key={g.word}
                      initial={{ opacity: 0, y: 40, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 500, 
                        damping: 50,
                        delay: i === 0 ? 0 : 0.05 
                      }}
                      className={cn(
                        "group relative p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border transition-all duration-700 overflow-hidden",
                        feedback.lightBg,
                        feedback.border,
                        feedback.shadow
                      )}
                    >
                      {/* Subtle background number */}
                      <span className={cn(
                        "absolute -right-2 -bottom-4 md:-right-4 md:-bottom-8 text-8xl md:text-[12rem] font-black opacity-[0.03] select-none pointer-events-none transition-all duration-700 group-hover:opacity-[0.05] group-hover:-translate-y-2 md:group-hover:-translate-y-4",
                        feedback.text
                      )}>
                        {guesses.length - i}
                      </span>

                      <div className="flex items-center justify-between mb-4 md:mb-6 relative z-10">
                        <span className={cn("font-black text-xl md:text-4xl uppercase tracking-[0.1em]", feedback.text)}>{g.word}</span>
                        <div className="flex flex-col items-end">
                          <span className={cn("text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] opacity-30 mb-0.5 md:mb-1", feedback.rankText)}>Ранг</span>
                          <span className={cn("font-mono font-black text-lg md:text-3xl tracking-tighter", feedback.text)}>#{g.rank.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className={cn(
                        "h-3 md:h-5 w-full rounded-full overflow-hidden p-0.5 md:p-1 relative z-10",
                        darkMode ? "bg-white/[0.03]" : "bg-black/5"
                      )}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ 
                            width: `${Math.max(5, 100 - (Math.log10(g.rank) / Math.log10(50000)) * 100)}%` 
                          }}
                          transition={{ duration: 2.5, ease: [0.16, 1, 0.3, 1] }}
                          className={cn("h-full rounded-full transition-all shadow-[0_0_20px_rgba(0,0,0,0.1)]", feedback.bg)}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </LayoutGroup>
            
            {guesses.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "text-center py-16 md:py-24 rounded-[2rem] md:rounded-[3rem] border border-dashed",
                  darkMode ? "bg-white/[0.02] border-white/5 text-slate-800" : "bg-white border-black/5 text-slate-200"
                )}
              >
                <Sparkles className={cn("mx-auto mb-4 opacity-20", "md:w-10 md:h-10")} size={32} />
                <p className="font-black text-[10px] md:text-sm uppercase tracking-[0.3em]">Направете първия си опит</p>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <Modal isOpen={activeModal === 'how-to-play'} onClose={() => setActiveModal(null)} title="Как се играе?" darkMode={darkMode}>
        <div className={cn("space-y-8", darkMode ? "text-slate-300" : "text-slate-600")}>
          <section>
            <h3 className={cn("font-black mb-3 flex items-center gap-3 uppercase text-xs tracking-widest", darkMode ? "text-white" : "text-slate-900")}>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Цел
            </h3>
            <p className="text-lg">Трябва да откриете тайната дума. Тя е съществително име на български език.</p>
          </section>
          <section>
            <h3 className={cn("font-black mb-3 flex items-center gap-3 uppercase text-xs tracking-widest", darkMode ? "text-white" : "text-slate-900")}>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Алгоритъм
            </h3>
            <p className="text-lg">Използваме изкуствен интелект, за да изчислим колко близо е вашето предположение до тайната дума по смисъл.</p>
          </section>
          <section>
            <h3 className={cn("font-black mb-3 flex items-center gap-3 uppercase text-xs tracking-widest", darkMode ? "text-white" : "text-slate-900")}>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Ранг
            </h3>
            <p className="text-lg">Ранг #1 е тайната дума. Колкото по-малък е номерът, толкова по-близо сте!</p>
          </section>
        </div>
      </Modal>

      <Modal isOpen={activeModal === 'hint'} onClose={() => setActiveModal(null)} title="Подсказка" darkMode={darkMode}>
        <div className={cn("p-8 rounded-[2rem] border", darkMode ? "bg-emerald-950/20 border-emerald-900/30" : "bg-emerald-50 border-emerald-100")}>
          <p className={cn("text-xl font-medium italic leading-relaxed", darkMode ? "text-emerald-400" : "text-emerald-900")}>"{hintText}"</p>
        </div>
        <p className="mt-6 text-sm text-slate-400 text-center">Подсказката е генерирана от AI на база вашите досегашни опити.</p>
      </Modal>

      <Modal isOpen={activeModal === 'give-up-confirm'} onClose={() => setActiveModal(null)} title="Предаване" darkMode={darkMode}>
        <div className="text-center space-y-8 py-4">
          <div className={cn("p-8 rounded-[2.5rem] border", darkMode ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-100")}>
            <p className={cn("text-xl font-bold leading-relaxed", darkMode ? "text-red-400" : "text-red-900")}>
              Сигурни ли сте, че искате да се предадете и да видите тайната дума?
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setActiveModal(null)}
              className={cn(
                "w-full sm:w-auto px-10 py-5 rounded-3xl font-black uppercase tracking-widest text-xs transition-all active:scale-95",
                darkMode ? "bg-white/5 hover:bg-white/10 text-slate-400" : "bg-black/5 hover:bg-black/10 text-slate-500"
              )}
            >
              Отказ
            </button>
            <button 
              onClick={confirmGiveUp}
              className="w-full sm:w-auto px-10 py-5 rounded-3xl font-black uppercase tracking-widest text-xs bg-red-500 text-white shadow-2xl shadow-red-500/20 transition-all active:scale-95"
            >
              Предавам се
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={activeModal === 'history'} onClose={() => setActiveModal(null)} title="Предишни игри" darkMode={darkMode}>
        <div className="text-center py-12">
          <Calendar className={cn("mx-auto mb-4", darkMode ? "text-slate-800" : "text-slate-200")} size={48} />
          <p className="text-lg font-medium">Очаквайте скоро!</p>
          <p className="text-sm text-slate-400">Статистиката за вашите игри ще бъде достъпна тук.</p>
        </div>
      </Modal>

      <Modal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} title="Настройки" darkMode={darkMode}>
        <div className="space-y-4">
          <div className={cn("flex items-center justify-between p-6 rounded-2xl", darkMode ? "bg-slate-800" : "bg-slate-50")}>
            <span className="font-bold">Звукови ефекти</span>
            <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={activeModal === 'feedback'} onClose={() => setActiveModal(null)} title="Обратна връзка" darkMode={darkMode}>
        <p className="mb-6">Вашето мнение е важно за нас! Изпратете ни съобщение:</p>
        <textarea className={cn("w-full h-32 rounded-2xl p-4 outline-none border transition-colors", darkMode ? "bg-slate-800 border-slate-700 focus:border-emerald-500" : "bg-slate-50 border-slate-100 focus:border-emerald-400")} placeholder="Напишете вашето съобщение тук..." />
        <button className={cn("mt-4 w-full py-4 rounded-2xl font-black transition-all", darkMode ? "bg-emerald-600 text-white" : "bg-slate-950 text-white")}>Изпрати</button>
      </Modal>

      <Modal isOpen={activeModal === 'faq'} onClose={() => setActiveModal(null)} title="Често задавани въпроси" darkMode={darkMode}>
        <div className="space-y-6">
          <div>
            <h4 className={cn("font-bold mb-1", darkMode ? "text-white" : "text-slate-900")}>Защо думата ми не се приема?</h4>
            <p>Приемаме само съществителни имена на български език в основна форма.</p>
          </div>
          <div>
            <h4 className={cn("font-bold mb-1", darkMode ? "text-white" : "text-slate-900")}>Колко често се сменя думата?</h4>
            <p>Думата се сменя автоматично всеки ден в полунощ.</p>
          </div>
        </div>
      </Modal>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${darkMode ? '#1E293B' : '#F1F5F9'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${darkMode ? '#334155' : '#E2E8F0'};
        }
      `}</style>
    </div>
  );
}
