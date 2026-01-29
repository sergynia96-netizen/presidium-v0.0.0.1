// ============================================================================
// 📱 MINI APPS VIEW (вынесен из App.tsx)
// ============================================================================

import React from 'react';
import { motion } from 'framer-motion';

// Моковые данные для мини-приложений
const MOCK_MINI_APPS = [
  { id: 'wallet', name: 'Кошелек', icon: '💰', permissions: ['payment', 'storage'], status: 'installed' },
  { id: 'scanner', name: 'QR Сканер', icon: '📷', permissions: ['camera'], status: 'running' },
  { id: 'torch', name: 'Фонарик', icon: '🔦', permissions: ['camera'], status: 'installed' }
];

interface MiniAppsViewProps {
  theme: any;
  t: (key: string) => string;
}

export const MiniAppsView = ({ theme, t }: MiniAppsViewProps) => (
  <div className={`p-6 pt-24 h-full pb-32 ${theme.bg}`}>
    <h1 className={`text-2xl font-black ${theme.text} mb-6`}>{t('mini_apps.title')}</h1>
    <div className="space-y-3">
      {MOCK_MINI_APPS.map((app, i) => (
        <motion.div
          key={app.id}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.1 }}
          className={`p-4 rounded-2xl border ${theme.glass} ${theme.border} flex items-center gap-4`}
        >
          <div className="text-2xl">{app.icon}</div>
          <div className="flex-1">
            <div className={`font-bold ${theme.text}`}>{app.name}</div>
            <div className={`text-xs ${theme.text2}`}>{app.permissions.join(', ')}</div>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);
