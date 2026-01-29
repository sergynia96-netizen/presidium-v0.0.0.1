import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Icon from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { nanoEngine } from './services/ai/nano.engine';
import { nanoCensor } from './services/ai/nano.censor';
import { assistantService } from './services/ai/assistant.service';

// ============================================================================
// 🧠 ЛОКАЛЬНЫЕ ДВИЖКИ (интеграция с существующими)
// ============================================================================

class LocalAIEngine {
  async generateReply(context: string[]): Promise<string> {
    // Используем существующий NanoEngine
    const result = await nanoEngine.classifyText(context[context.length - 1]);
    const reply = nanoEngine.getBestReply(result.intent);
    return reply.text;
  }
  
  async moderate(text: string): Promise<{ isSpam: boolean; confidence: number; reason: string }> {
    const safety = nanoCensor.checkSafety(text);
    return {
      isSpam: !safety.safe,
      confidence: safety.confidence,
      reason: safety.reason
    };
  }
  
  async analyzeEmotion(text: string): Promise<'joy' | 'sadness' | 'anger' | 'fear' | 'neutral'> {
    const result = await nanoEngine.classifyText(text);
    return result.sentiment === 'positive' ? 'joy' : 
           result.sentiment === 'negative' ? 'sadness' : 'neutral';
  }
}

class PrivacyGuard {
  private static instance: PrivacyGuard;
  private auditLog: Array<{ timestamp: number; action: string; dataHash: string }> = [];
  
  static getInstance(): PrivacyGuard {
    if (!PrivacyGuard.instance) {
      PrivacyGuard.instance = new PrivacyGuard();
    }
    return PrivacyGuard.instance;
  }
  
  async scanContent(content: string): Promise<{ allowed: boolean; sanitized?: string; reason?: string }> {
    const hash = await this.hash(content);
    const safety = nanoCensor.checkSafety(content);
    
    this.auditLog.push({
      timestamp: Date.now(),
      action: safety.safe ? 'ALLOWED' : 'BLOCKED',
      dataHash: hash.slice(0, 16)
    });
    
    if (this.auditLog.length > 100) {
      this.auditLog = this.auditLog.slice(-100);
    }
    
    return {
      allowed: safety.safe,
      reason: safety.reason
    };
  }
  
  private async hash(data: string): Promise<string> {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  getAuditLog() {
    return this.auditLog;
  }
}

// ============================================================================
// 🎨 ТИПЫ И КОНСТАНТЫ
// ============================================================================

type ThemeMode = 'LUX' | 'CYBER' | 'PRIVACY';
interface Theme {
  id: string;
  bg: string;
  text: string;
  text2: string;
  accent: string;
  accentText: string;
  border: string;
  glass: string;
  glassHover: string;
  input: string;
  shadow: string;
  dock: string;
  bubbleMe: string;
  bubbleThem: string;
  aiBubble: string;
}

const THEMES: Record<ThemeMode, Theme> = {
  LUX: {
    id: 'lux',
    bg: 'bg-[#F2F2F7]',
    text: 'text-[#1D1D1F]',
    text2: 'text-[#86868b]',
    accent: 'bg-[#000000]',
    accentText: 'text-white',
    border: 'border-[#D2D2D7]',
    glass: 'bg-white/60 backdrop-blur-xl border-white/40',
    glassHover: 'hover:bg-white/80',
    input: 'bg-white/50 focus:bg-white',
    shadow: 'shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]',
    dock: 'bg-white/80 border-[#D2D2D7]',
    bubbleMe: 'bg-black text-white',
    bubbleThem: 'bg-white text-black shadow-sm',
    aiBubble: 'bg-gradient-to-br from-blue-600 to-blue-800 text-white',
  },
  CYBER: {
    id: 'cyber',
    bg: 'bg-[#050505]',
    text: 'text-[#E0E0E0]',
    text2: 'text-[#888888]',
    accent: 'bg-[#00FF9D]',
    accentText: 'text-black',
    border: 'border-white/10',
    glass: 'bg-[#111111]/80 backdrop-blur-xl border-white/10',
    glassHover: 'hover:bg-[#222222]/90',
    input: 'bg-black/40 focus:bg-black/60',
    shadow: 'shadow-[0_0_40px_-10px_rgba(0,255,157,0.1)]',
    dock: 'bg-[#0a0a0a]/90 border-white/10',
    bubbleMe: 'bg-[#00FF9D] text-black',
    bubbleThem: 'bg-[#222] text-[#eee] border border-white/10',
    aiBubble: 'bg-gradient-to-br from-[#00FF9D] to-emerald-700 text-black',
  },
  PRIVACY: {
    id: 'privacy',
    bg: 'bg-[#0A0A1A]',
    text: 'text-[#E0E0FF]',
    text2: 'text-[#A0A0C0]',
    accent: 'bg-[#7B68EE]',
    accentText: 'text-white',
    border: 'border-[#333366]',
    glass: 'bg-[#151530]/80 backdrop-blur-xl border-[#333366]',
    glassHover: 'hover:bg-[#252540]/90',
    input: 'bg-[#0F0F2A] focus:bg-[#1F1F4A]',
    shadow: 'shadow-[0_0_40px_-10px_rgba(123,104,238,0.15)]',
    dock: 'bg-[#101020]/90 border-[#333366]',
    bubbleMe: 'bg-[#7B68EE] text-white',
    bubbleThem: 'bg-[#222244] text-[#E0E0FF] border-[#333366]',
    aiBubble: 'bg-gradient-to-br from-[#7B68EE] to-[#9370DB] text-white',
  }
};

const TRANSLATIONS = {
  ru: {
    auth: { 
      title: "PRESIDIUM", 
      subtitle: "Локальный ИИ-Ядро", 
      btn_activate: "АКТИВИРОВАТЬ"
    },
    nav: { 
      chats: "Связь", 
      ai: "ИИ-Ядро", 
      economy: "Госплан", 
      profile: "Гражданин" 
    },
    chats: { 
      title: "ЛОКАЛЬНАЯ СЕТЬ", 
      search: "Поиск (локально)...", 
      typing: "ИИ обрабатывает...", 
      folders: { all: "Все", p2p: "Личные", secure: "Защищено", channels: "Эфир" } 
    },
    ai: { 
      title: "НЕЙРО-ЯДРО", 
      live: "ОНЛАЙН", 
      input: "Введите приказ...", 
      processing: "Обработка...", 
      models: "Модели", 
      privacy: "Приватность" 
    },
    privacy: { 
      level_max: "МАКС (100% локально)", 
      processed_locally: "Обработано на устройстве", 
      blocked: "Заблокировано ИИ" 
    }
  }
};

// ============================================================================
// 🎭 UI КОМПОНЕНТЫ
// ============================================================================

const MatrixRain = ({ color }: { color: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const columns = Math.floor(canvas.width / 20);
    const drops = Array(columns).fill(1);
    const chars = "01PRESIDIUMAI";
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;
      ctx.font = '10px monospace';
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * 20, drops[i] * 20);
        if (drops[i] * 20 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    const interval = setInterval(draw, 50);
    return () => clearInterval(interval);
  }, [color]);
  return <canvas ref={canvasRef} className="fixed inset-0 z-0 opacity-[0.15] pointer-events-none mix-blend-screen" />;
};

const LocalAIStatus = ({ status, theme }: { status: 'idle' | 'processing' | 'ready' | 'error', theme: Theme }) => {
  const colors = {
    idle: '#888888',
    processing: '#00FF9D',
    ready: '#00FF9D',
    error: '#FF4444'
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${theme.border} ${theme.glass}`}>
      <motion.div
        animate={{ opacity: status === 'processing' ? [0.3, 1, 0.3] : 1 }}
        transition={{ duration: 1.5, repeat: status === 'processing' ? Infinity : 0 }}
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: colors[status] }}
      />
      <span className={`text-[10px] font-mono ${theme.text}`}>
        {status === 'processing' ? 'ИИ: ОБРАБОТКА' : status === 'ready' ? 'ИИ: ГОТОВ' : 'ИИ: ОЖИДАНИЕ'}
      </span>
    </div>
  );
};

const ScamAlertOverlay = ({ onClose, theme }: { onClose: () => void; theme: Theme }) => (
  <motion.div 
    initial={{ y: -50, opacity: 0 }} 
    animate={{ y: 0, opacity: 1 }}
    className="fixed top-20 left-4 right-4 z-50 p-4 bg-red-900/90 border border-red-500 rounded-2xl shadow-[0_0_30px_rgba(255,0,0,0.3)] backdrop-blur-xl"
  >
    <div className="flex items-start gap-3">
      <div className="p-2 bg-red-500 rounded-full text-black"><Icon.ShieldAlert size={24} /></div>
      <div className="flex-1">
        <h4 className="text-white font-bold uppercase tracking-wider">Угроза Мошенничества</h4>
        <p className="text-xs text-red-200 mt-1">Локальный ИИ обнаружил паттерны социальной инженерии. Сообщение заблокировано на устройстве.</p>
      </div>
      <button onClick={onClose}><Icon.X size={20} className="text-white/50 hover:text-white"/></button>
    </div>
  </motion.div>
);

const Dock = ({ activeTab, onChange, theme }: { activeTab: string; onChange: (tab: string) => void; theme: Theme }) => {
  const items = [
    { id: 'chats', icon: Icon.MessageSquare }, 
    { id: 'ai', icon: Icon.Bot }, 
    { id: 'economy', icon: Icon.LayoutGrid }, 
    { id: 'profile', icon: Icon.User }
  ];
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-xs px-4">
      <div className={`flex justify-around items-center px-2 py-3 rounded-[32px] border shadow-2xl backdrop-blur-2xl ${theme.dock} ${theme.border}`}>
        {items.map(item => (
          <button 
            key={item.id} 
            onClick={() => onChange(item.id)} 
            className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              activeTab === item.id ? theme.accent : 'hover:bg-white/10'
            }`}
          >
            <item.icon 
              size={22} 
              strokeWidth={activeTab === item.id ? 2.5 : 2} 
              className={activeTab === item.id ? theme.accentText : theme.text2} 
            />
          </button>
        ))}
      </div>
    </div>
  );
};

// Simplified screens for integration
const AuthScreen = ({ 
  onLogin, 
  theme, 
  t, 
  toggleTheme 
}: { 
  onLogin: () => void; 
  theme: Theme; 
  t: (key: string) => string;
  toggleTheme: () => void;
}) => {
  const [stage, setStage] = useState<'idle' | 'touch' | 'done'>('idle');
  
  const start = async () => {
    setStage('touch');
    await assistantService.initialize();
    setStage('done');
    setTimeout(onLogin, 1500);
  };
  
  return (
    <div className={`flex flex-col items-center justify-center h-full p-8 relative overflow-hidden ${theme.bg}`}>
      <div className="relative z-10 flex flex-col items-center animate-enter">
        <div className={`w-32 h-32 rounded-[40px] grid place-items-center shadow-2xl mb-6 transition-transform duration-1000 ${
          stage !== 'idle' ? 'scale-110' : 'scale-100'
        } ${theme.id === 'lux' ? 'bg-white text-black' : 'bg-gradient-to-br from-[#7B68EE] to-[#9370DB] text-white'}`}>
          <Icon.Brain size={48} />
        </div>
        <h1 className={`text-5xl font-black tracking-tighter text-center mb-2 ${theme.text}`}>
          PRE<span className={theme.id === 'cyber' || theme.id === 'privacy' ? 'text-[#7B68EE]' : ''}>SID</span>IUM
        </h1>
        <p className={`text-xs font-mono tracking-[0.3em] uppercase mb-2 opacity-60 ${theme.text}`}>
          {t('auth.subtitle')}
        </p>
        
        <div className="flex gap-3 mb-8">
          <div className={`px-3 py-1 rounded-full border ${theme.border} ${theme.glass} text-[10px] font-mono opacity-70`}>
            <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block mr-2 animate-pulse"></span>
            {t('privacy.level_max')}
          </div>
        </div>
        
        <button 
          onClick={start} 
          disabled={stage !== 'idle'} 
          className={`w-full max-w-xs h-16 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 ${
            theme.accent
          } ${theme.accentText} ${theme.shadow}`}
        >
          {stage === 'idle' && <><Icon.Power size={20} strokeWidth={3} /> {t('auth.btn_activate')}</>}
          {stage === 'touch' && <Icon.Loader2 className="animate-spin" size={24} />}
          {stage === 'done' && <Icon.Check size={24} strokeWidth={4} />}
        </button>
        
        <button 
          onClick={toggleTheme} 
          className={`mt-4 text-[10px] font-mono opacity-50 ${theme.text} hover:opacity-100`}
        >
          СМЕНИТЬ РЕЖИМ
        </button>
      </div>
    </div>
  );
};

// Simplified main component
export default function PresidiumOS() {
  const [view, setView] = useState<'auth' | 'app'>('auth');
  const [tab, setTab] = useState('chats');
  const [themeMode, setThemeMode] = useState<ThemeMode>('PRIVACY');
  const theme = THEMES[themeMode];
  const t = useCallback((key: string) => {
    const keys = key.split('.');
    let val: any = TRANSLATIONS['ru'];
    for (const k of keys) { val = val?.[k]; if(!val) return key; }
    return val;
  }, []);
  
  const toggleTheme = useCallback(() => {
    setThemeMode(prev => {
      const order: ThemeMode[] = ['LUX', 'CYBER', 'PRIVACY'];
      return order[(order.indexOf(prev) + 1) % order.length];
    });
  }, []);
  
  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${theme.bg} overflow-hidden`}>
      {themeMode !== 'LUX' && <MatrixRain color={theme.id === 'cyber' ? '#00FF9D' : '#7B68EE'} />}
      
      <div className="w-full max-w-md mx-auto min-h-screen relative shadow-2xl flex flex-col">
        {view === 'auth' ? (
          <AuthScreen 
            onLogin={() => setView('app')} 
            theme={theme} 
            t={t} 
            toggleTheme={toggleTheme}
          />
        ) : (
          <>
            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100]">
              <div className={`px-4 py-2 rounded-full flex items-center gap-3 border backdrop-blur-xl ${theme.glass} ${theme.border}`}>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className={`text-[10px] font-mono font-bold ${theme.text}`}>NET: ONLINE</span>
                <LocalAIStatus status="ready" theme={theme} />
              </div>
            </div>

            <div className="flex-1 relative pt-24 pb-32">
              <div className="text-center p-8">
                <h2 className={`text-2xl font-bold ${theme.text} mb-4`}>Presidium OS</h2>
                <p className={`${theme.text2}`}>Интегрировано с Nano-AI Core</p>
              </div>
            </div>

            <Dock activeTab={tab} onChange={setTab} theme={theme} />
          </>
        )}
      </div>
    </div>
  );
}

