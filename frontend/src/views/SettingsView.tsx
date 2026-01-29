// ============================================================================
// ⚙️ SETTINGS VIEW (вынесен из App.tsx)
// ============================================================================

import React from 'react';
import { motion } from 'framer-motion';
import * as Icon from 'lucide-react';

// Тип темы (должен соответствовать App.tsx)
type ThemeMode = 'LUX' | 'CYBER' | 'PRIVACY';

interface SettingsViewProps {
  theme: any;
  t: (key: string) => string;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const SettingsView = ({ theme, t, themeMode, setThemeMode }: SettingsViewProps) => {
  const themeOptions: Array<{ mode: ThemeMode; label: string; icon: any; description: string }> = [
    { mode: 'LUX', label: 'Светлый режим', icon: Icon.Sun, description: 'Светлая тема' },
    { mode: 'CYBER', label: 'Кибер', icon: Icon.Zap, description: 'Темная кибер-тема' },
    { mode: 'PRIVACY', label: 'Приватность', icon: Icon.Shield, description: 'Темная приватная тема' }
  ];

  return (
    <div className={`p-6 pt-24 h-full pb-32 overflow-y-auto no-scrollbar animate-enter ${theme.bg}`}>
      <motion.h1 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`text-3xl font-black ${theme.text} font-orbitron mb-6`}
      >
        {t('settings.title')}
      </motion.h1>
      
      {/* Theme Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className={`text-sm font-bold ${theme.text} mb-4 flex items-center gap-2`}>
          <Icon.Palette size={18} />
          Внешний вид
        </h2>
        <div className="space-y-3">
          {themeOptions.map((option, i) => (
            <motion.button
              key={option.mode}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setThemeMode(option.mode)}
              className={`w-full p-4 rounded-2xl border transition-all ${
                themeMode === option.mode 
                  ? `${theme.accent} ${theme.accentText} border-opacity-100` 
                  : `${theme.glass} ${theme.border} hover:bg-white/5`
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    themeMode === option.mode 
                      ? 'bg-white/20' 
                      : 'bg-black/20'
                  }`}>
                    <option.icon 
                      size={20} 
                      className={themeMode === option.mode ? theme.accentText : theme.text} 
                    />
                  </div>
                  <div className="text-left">
                    <div className={`font-bold text-sm ${
                      themeMode === option.mode ? theme.accentText : theme.text
                    }`}>
                      {option.label}
                    </div>
                    <div className={`text-[10px] font-mono ${
                      themeMode === option.mode ? 'opacity-80' : theme.text2
                    }`}>
                      {option.description}
                    </div>
                  </div>
                </div>
                {themeMode === option.mode && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"
                  >
                    <Icon.Check size={16} />
                  </motion.div>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Other Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className={`text-sm font-bold ${theme.text} mb-4 flex items-center gap-2`}>
          <Icon.Settings size={18} />
          Другие настройки
        </h2>
        <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
          <div className={`font-bold text-sm ${theme.text} mb-2`}>Системные параметры</div>
          <div className={`text-xs ${theme.text2} opacity-70`}>Дополнительные настройки будут добавлены позже</div>
        </div>
      </motion.div>
    </div>
  );
};
