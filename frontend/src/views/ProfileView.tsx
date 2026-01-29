// ============================================================================
// 👤 PROFILE VIEW (вынесен из App.tsx)
// ============================================================================

import React from 'react';
import { motion } from 'framer-motion';
import * as Icon from 'lucide-react';

interface ProfileViewProps {
  theme: any;
  t: (key: string) => string;
  onNavigate: (view: string) => void;
}

export const ProfileView = ({ theme, t, onNavigate }: ProfileViewProps) => {
  return (
    <div className={`p-6 pt-24 h-full flex flex-col pb-32 animate-enter ${theme.bg}`}>
      <div className="flex flex-col items-center mb-8">
        <div className={`w-24 h-24 rounded-full border-4 ${theme.border} p-1 mb-4`}>
          <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-black grid place-items-center">
            <Icon.User size={40} className={theme.text} />
          </div>
        </div>
        <h2 className={`text-2xl font-black ${theme.text}`}>{t('profile.user')}</h2>
        <div className={`px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold mt-2`}>
          {t('profile.status')}
        </div>
      </div>
      
      <div className="flex gap-3 mb-6">
        <div className={`flex-1 p-3 rounded-xl border ${theme.glass} ${theme.border} text-center`}>
          <div className="text-lg font-black text-emerald-400">984</div>
          <div className={`text-[10px] ${theme.text2}`}>{t('profile.reputation')}</div>
        </div>
        <div className={`flex-1 p-3 rounded-xl border ${theme.glass} ${theme.border} text-center`}>
          <div className="text-lg font-black text-blue-400">99.9%</div>
          <div className={`text-[10px] ${theme.text2}`}>{t('profile.uptime')}</div>
        </div>
      </div>
      
      <div className="space-y-2 flex-1">
        {[
          { view: 'vault', icon: Icon.Shield, label: t('vault.title') },
          { view: 'keys', icon: Icon.Key, label: t('keys.title') },
          { view: 'network', icon: Icon.Globe, label: t('network.title') },
          { view: 'settings', icon: Icon.Settings, label: t('settings.title') }
        ].map((item, i) => (
          <motion.button
            key={item.view}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate(item.view)}
            className={`w-full p-4 rounded-2xl border ${theme.glass} ${theme.border} flex items-center gap-4 hover:bg-white/5`}
          >
            <item.icon size={20} className={theme.text} />
            <span className={`font-bold text-sm ${theme.text}`}>{item.label}</span>
            <Icon.ChevronRight size={16} className={`ml-auto opacity-30 ${theme.text}`} />
          </motion.button>
        ))}
      </div>
      
      <motion.button
        whileTap={{ scale: 0.95 }}
        className="w-full mt-4 py-4 rounded-2xl border border-red-500/30 text-red-400 font-bold flex items-center justify-center gap-2"
      >
        <Icon.LogOut size={18} />
        {t('profile.logout')}
      </motion.button>
    </div>
  );
};
