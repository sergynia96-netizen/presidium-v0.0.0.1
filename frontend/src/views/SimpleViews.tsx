// ============================================================================
// 📄 ПРОСТЫЕ VIEWS (вынесены из App.tsx)
// ============================================================================

import React from 'react';

// Типы пропсов
interface ViewProps {
  theme: any;
  t: (key: string) => string;
}

// ============================================================================
// 🔐 VAULT VIEW
// ============================================================================

export const VaultView = ({ theme, t }: ViewProps) => (
  <div className={`p-6 pt-24 h-full pb-32 ${theme.bg}`}>
    <h1 className={`text-2xl font-black ${theme.text} mb-6`}>{t('vault.title')}</h1>
    <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
      <div className="text-2xl font-black text-emerald-400">3</div>
      <div className={`text-xs ${theme.text2}`}>{t('vault.files')}</div>
    </div>
  </div>
);

// ============================================================================
// 🔑 KEYS VIEW
// ============================================================================

export const KeysView = ({ theme, t }: ViewProps) => (
  <div className={`p-6 pt-24 h-full pb-32 ${theme.bg}`}>
    <h1 className={`text-2xl font-black ${theme.text} mb-6`}>{t('keys.title')}</h1>
    <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
      <div className={`font-bold ${theme.text}`}>Kyber1024-Dilithium5</div>
      <div className={`text-xs ${theme.text2}`}>PQC • Активен</div>
    </div>
  </div>
);

// ============================================================================
// 🌐 NETWORK VIEW
// ============================================================================

export const NetworkView = ({ theme, t }: ViewProps) => (
  <div className={`p-6 pt-24 h-full pb-32 ${theme.bg}`}>
    <h1 className={`text-2xl font-black ${theme.text} mb-6`}>{t('network.title')}</h1>
    <div className="grid grid-cols-2 gap-3">
      <div className={`p-3 rounded-xl border ${theme.glass} ${theme.border} text-center`}>
        <div className="text-lg font-black text-emerald-400">12</div>
        <div className={`text-xs ${theme.text2}`}>{t('network.peers')}</div>
      </div>
      <div className={`p-3 rounded-xl border ${theme.glass} ${theme.border} text-center`}>
        <div className="text-lg font-black text-blue-400">23ms</div>
        <div className={`text-xs ${theme.text2}`}>{t('network.latency')}</div>
      </div>
    </div>
  </div>
);

// ============================================================================
// ⭐ REPUTATION VIEW
// ============================================================================

export const ReputationView = ({ theme, t }: ViewProps) => (
  <div className={`p-6 pt-24 h-full pb-32 ${theme.bg}`}>
    <h1 className={`text-2xl font-black ${theme.text} mb-6`}>{t('reputation.title')}</h1>
    <div className={`p-6 rounded-2xl border ${theme.glass} ${theme.border} text-center`}>
      <div className="text-5xl font-black text-emerald-400 mb-2">984</div>
      <div className={`text-lg font-bold ${theme.text}`}>ВЕТЕРАН</div>
    </div>
  </div>
);
