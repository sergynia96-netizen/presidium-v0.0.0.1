// ============================================================================
// 💰 ECONOMY VIEW (вынесен из App.tsx)
// ============================================================================

import React, { useState } from 'react';
import { motion } from 'framer-motion';

// Моковые данные магазина
const MARKET_DATA = {
  store: [
    { id: 1, name: 'Mesh-Роутер "Спутник"', price: 5000, desc: 'Автономная связь до 5км', seller: 'Завод №1' },
    { id: 2, name: 'Дозиметр "Луч"', price: 2500, desc: 'Карманный детектор', seller: 'КБ "Атом"' }
  ],
  kb: [
    { id: 1, name: 'Проект "Квант-Связь"', current: 45000, goal: 100000, roi: '+23%' },
    { id: 2, name: 'Mesh-Сеть "Горизонт"', current: 78000, goal: 150000, roi: '+18%' }
  ],
  ipo: [
    { id: 1, ticker: 'PRES', name: 'Presidium Network', price: 125, change: '+12.5%' },
    { id: 2, ticker: 'MESH', name: 'Mesh Infrastructure', price: 89, change: '-3.2%' }
  ]
};

interface EconomyViewProps {
  theme: any;
  t: (key: string) => string;
}

export const EconomyView = ({ theme, t }: EconomyViewProps) => {
  const [tab, setTab] = useState('store');
  const [balance] = useState(1450.0);
  
  return (
    <div className={`p-6 pt-24 h-full pb-32 overflow-y-auto no-scrollbar animate-enter ${theme.bg}`}>
      <motion.h1 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`text-4xl font-black ${theme.text} font-orbitron mb-6`}
      >
        {t('economy.title')}
      </motion.h1>
      
      <motion.div 
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className={`p-6 rounded-[32px] relative overflow-hidden shadow-xl ${theme.accent} ${theme.accentText} mb-6`}
      >
        <div className="text-xs opacity-70 font-mono uppercase mb-1">{t('economy.total')}</div>
        <div className="text-4xl font-black">{balance.toFixed(2)}</div>
        <div className="flex gap-3 mt-6">
          <motion.button whileTap={{ scale: 0.95 }} className="flex-1 py-3 rounded-xl bg-white/20 text-xs font-bold">
            {t('economy.deposit')}
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} className="flex-1 py-3 rounded-xl bg-white/20 text-xs font-bold">
            {t('economy.swap')}
          </motion.button>
        </div>
      </motion.div>
      
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6">
        {['store', 'kb', 'ipo', 'stake'].map(k => (
          <motion.button
            key={k}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase ${
              tab === k ? theme.buttonPrimary : theme.buttonSecondary
            }`}
          >
            {t(`economy.${k}`)}
          </motion.button>
        ))}
      </div>
      
      {tab === 'store' && (
        <div className="space-y-4">
          {MARKET_DATA.store.map(item => (
            <div key={item.id} className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
              <div className="flex justify-between mb-2">
                <h4 className={`font-bold ${theme.text}`}>{item.name}</h4>
                <span className="font-mono font-bold text-emerald-400">{item.price} ₵</span>
              </div>
              <p className={`text-xs ${theme.text2}`}>{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
