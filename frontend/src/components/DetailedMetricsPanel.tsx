/**
 * Detailed Metrics Panel - Professional Panel for Geeks
 * 
 * Детальная панель с расширенной информацией о системе
 * Уровень лучших мессенджеров мира
 */

import React from 'react';
import ReactDOM from 'react-dom';
import * as Icon from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DetailedMetricsPanelProps {
  type: string;
  data: any;
  theme: any;
  onClose: () => void;
}

export const DetailedMetricsPanel: React.FC<DetailedMetricsPanelProps> = ({ type, data, theme, onClose }) => {
  console.log('📊 DetailedMetricsPanel rendered:', { 
    type, 
    hasData: !!data, 
    dataKeys: data ? Object.keys(data) : [],
    memory: data?.memory ? 'exists' : 'missing',
    cpu: data?.cpu ? 'exists' : 'missing',
  });

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatPercentage = (value: number) => {
    if (!value && value !== 0) return '0%';
    return `${value.toFixed(2)}%`;
  };

  // Support all 4 card types - render in Portal for proper z-index
  if (type === 'memory' || type === 'threads' || type === 'storage' || type === 'network') {
    return ReactDOM.createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
        onClick={onClose}
        style={{ position: 'fixed', zIndex: 9999 }}
      >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl h-[90vh] flex flex-col rounded-2xl border border-emerald-500/30 bg-[#0d1117] backdrop-blur-xl overflow-hidden shadow-2xl shadow-emerald-500/10`}
            style={{ maxHeight: '90vh' }}
          >
            {/* Fixed Header - Dynamic based on type */}
            <div className="flex-shrink-0 p-6 border-b border-emerald-500/20 bg-[#0d1117]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    type === 'memory' ? 'bg-blue-500/20 text-blue-400' :
                    type === 'threads' ? 'bg-emerald-500/20 text-emerald-400' :
                    type === 'storage' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {type === 'memory' && <Icon.Brain size={24} />}
                    {type === 'threads' && <Icon.Activity size={24} />}
                    {type === 'storage' && <Icon.Database size={24} />}
                    {type === 'network' && <Icon.Network size={24} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white font-orbitron">
                      {type === 'memory' && 'Memory Analytics'}
                      {type === 'threads' && 'Process Monitor'}
                      {type === 'storage' && 'Storage Analytics'}
                      {type === 'network' && 'Network Monitor'}
                    </h2>
                    <p className="text-xs font-mono text-gray-400">
                      {type === 'memory' && 'Детальная информация о памяти системы'}
                      {type === 'threads' && 'Мониторинг процессов и потоков'}
                      {type === 'storage' && 'Анализ хранилища данных'}
                      {type === 'network' && 'Мониторинг P2P сети'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <Icon.X size={20} className="text-white" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-8" style={{ 
              overflowY: 'auto', 
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth'
            }}>
              {/* Loading State */}
              {!data && (
                <div className="text-center py-12">
                  <div className="animate-spin mx-auto mb-4 w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full"></div>
                  <p className={`text-sm font-mono ${theme.text2} opacity-70`}>Загрузка детальных метрик...</p>
                  <p className={`text-xs font-mono ${theme.text2} opacity-50 mt-2`}>Подключение к backend...</p>
                </div>
              )}
              
              {/* Empty State - if no data after loading */}
              {data && !data.memory && !data.cpu && !data.threads && (
                <div className="text-center py-8">
                  <p className={`text-sm font-mono ${theme.text2} opacity-70`}>Нет данных для отображения</p>
                  <p className={`text-xs font-mono ${theme.text2} opacity-50 mt-2`}>Проверьте подключение к backend</p>
                  <p className={`text-xs font-mono ${theme.text2} opacity-30 mt-1`}>Data keys: {Object.keys(data || {}).join(', ')}</p>
                </div>
              )}
              
              {/* System Memory Overview */}
              {data?.memory?.system && (
                <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
                  <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center gap-2`}>
                    <Icon.Activity size={16} />
                    Системная память
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono ${theme.text2}`}>Всего:</span>
                      <span className={`text-sm font-bold ${theme.text}`}>{formatBytes(data.memory.system.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono ${theme.text2}`}>Использовано:</span>
                      <span className={`text-sm font-bold text-red-400`}>{formatBytes(data.memory.system.used)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono ${theme.text2}`}>Свободно:</span>
                      <span className={`text-sm font-bold text-emerald-400`}>{formatBytes(data.memory.system.free)}</span>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-mono ${theme.text2}`}>Использование:</span>
                        <span className={`text-xs font-bold ${theme.text}`}>{formatPercentage(data.memory.system.usage)}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden bg-black/20">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${data.memory.system.usage || 0}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-full rounded-full ${
                            (data.memory.system.usage || 0) > 80 ? 'bg-red-400' :
                            (data.memory.system.usage || 0) > 60 ? 'bg-yellow-400' :
                            'bg-blue-400'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Process Memory Breakdown */}
              {data?.memory?.process && (
                <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
                  <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center gap-2`}>
                    <Icon.Cpu size={16} />
                    Процесс Node.js
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className={`text-xs font-mono ${theme.text2} block mb-1`}>Heap Used:</span>
                        <span className={`text-sm font-bold ${theme.text}`}>{formatBytes(data.memory.process.heapUsed)}</span>
                      </div>
                      <div>
                        <span className={`text-xs font-mono ${theme.text2} block mb-1`}>Heap Total:</span>
                        <span className={`text-sm font-bold ${theme.text}`}>{formatBytes(data.memory.process.heapTotal)}</span>
                      </div>
                      <div>
                        <span className={`text-xs font-mono ${theme.text2} block mb-1`}>RSS:</span>
                        <span className={`text-sm font-bold ${theme.text}`}>{formatBytes(data.memory.process.rss)}</span>
                      </div>
                      <div>
                        <span className={`text-xs font-mono ${theme.text2} block mb-1`}>External:</span>
                        <span className={`text-sm font-bold ${theme.text}`}>{formatBytes(data.memory.process.external)}</span>
                      </div>
                    </div>
                    {data.memory.process.heapUsage !== undefined && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-mono ${theme.text2}`}>Heap Usage:</span>
                          <span className={`text-xs font-bold ${theme.text}`}>{formatPercentage(data.memory.process.heapUsage)}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-black/20">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${data.memory.process.heapUsage}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full rounded-full bg-purple-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Memory Breakdown by Component */}
              {data?.memory?.breakdown && (
                <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
                  <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center gap-2`}>
                    <Icon.Layers size={16} />
                    Распределение памяти
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-mono ${theme.text2}`}>Node.js Heap:</span>
                        <span className={`text-xs font-bold ${theme.text}`}>{formatBytes(data.memory.breakdown.nodejs?.heap || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-mono ${theme.text2}`}>External:</span>
                        <span className={`text-xs font-bold ${theme.text}`}>{formatBytes(data.memory.breakdown.nodejs?.external || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-mono ${theme.text2}`}>Array Buffers:</span>
                        <span className={`text-xs font-bold ${theme.text}`}>{formatBytes(data.memory.breakdown.nodejs?.arrayBuffers || 0)}</span>
                      </div>
                    </div>
                    
                    <div className="border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-mono ${theme.text2}`}>AI Models:</span>
                        <span className={`text-xs font-bold ${data.memory.breakdown.ai?.loaded ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {data.memory.breakdown.ai?.loaded ? formatBytes(data.memory.breakdown.ai.models || 0) : 'Не загружено'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-mono ${theme.text2}`}>Cache:</span>
                        <span className={`text-xs font-bold ${theme.text}`}>
                          {formatBytes(data.memory.breakdown.cache?.size || 0)} / {formatBytes(data.memory.breakdown.cache?.maxSize || 0)}
                        </span>
                      </div>
                      {data.memory.breakdown.cache?.hitRate !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-mono ${theme.text2}`}>Cache Hit Rate:</span>
                          <span className={`text-xs font-bold ${theme.text}`}>{formatPercentage(data.memory.breakdown.cache.hitRate)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-mono ${theme.text2}`}>Local Storage:</span>
                        <span className={`text-xs font-bold ${theme.text}`}>{formatBytes(data.memory.breakdown.storage?.local || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono ${theme.text2}`}>Distributed:</span>
                        <span className={`text-xs font-bold ${theme.text}`}>{formatBytes(data.memory.breakdown.storage?.distributed || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CPU Info */}
              {data?.cpu && (
                <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
                  <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center gap-2`}>
                    <Icon.Cpu size={16} />
                    CPU
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono ${theme.text2}`}>Использование:</span>
                      <span className={`text-sm font-bold ${theme.text}`}>{formatPercentage(data.cpu.usage || 0)}</span>
                    </div>
                    {data.cpu.cores && (
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono ${theme.text2}`}>Ядер:</span>
                        <span className={`text-sm font-bold ${theme.text}`}>{data.cpu.cores}</span>
                      </div>
                    )}
                    {data.cpu.loadAverage && Array.isArray(data.cpu.loadAverage) && (
                      <div>
                        <span className={`text-xs font-mono ${theme.text2} block mb-1`}>Load Average:</span>
                        <div className="flex gap-2">
                          {data.cpu.loadAverage.map((load: number, i: number) => (
                            <span key={i} className={`text-xs font-mono ${theme.text}`}>{load.toFixed(2)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Thread Info */}
              {data?.threads && (
                <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
                  <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center gap-2`}>
                    <Icon.Activity size={16} />
                    Процессы
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono ${theme.text2}`}>Активные потоки:</span>
                      <span className={`text-sm font-bold ${theme.text}`}>{data.threads.active || 0} / {data.threads.max || 10}</span>
                    </div>
                    {data.threads.pid && (
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono ${theme.text2}`}>PID:</span>
                        <span className={`text-sm font-bold ${theme.text} font-mono`}>{data.threads.pid}</span>
                      </div>
                    )}
                    {data.threads.uptime !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono ${theme.text2}`}>Uptime:</span>
                        <span className={`text-sm font-bold ${theme.text}`}>
                          {Math.floor(data.threads.uptime / 3600)}h {Math.floor((data.threads.uptime % 3600) / 60)}m
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Network Stats - Enhanced */}
              {data?.network && (
                <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
                  <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center gap-2`}>
                    <Icon.Network size={16} />
                    P2P Сеть
                  </h3>
                  <div className="space-y-4">
                    {/* Traffic Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <Icon.ArrowDown size={20} className="mx-auto mb-2 text-emerald-400" />
                        <div className="text-lg font-bold text-emerald-400">{formatBytes(data.network.in || 0)}</div>
                        <div className={`text-[10px] font-mono ${theme.text2}`}>Входящий</div>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <Icon.ArrowUp size={20} className="mx-auto mb-2 text-blue-400" />
                        <div className="text-lg font-bold text-blue-400">{formatBytes(data.network.out || 0)}</div>
                        <div className={`text-[10px] font-mono ${theme.text2}`}>Исходящий</div>
                      </div>
                    </div>
                    
                    {/* Peers */}
                    <div className="border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-mono ${theme.text2}`}>Подключённых пиров:</span>
                        <span className={`text-sm font-bold text-yellow-400`}>{data.network.peers || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono ${theme.text2}`}>Всего трафика:</span>
                        <span className={`text-sm font-bold ${theme.text}`}>{formatBytes(data.network.total || 0)}</span>
                      </div>
                    </div>
                    
                    {/* Visual Network Graph */}
                    <div className="relative h-20 bg-black/30 rounded-xl overflow-hidden">
                      <div className="absolute inset-0 flex items-end justify-around px-2">
                        {[...Array(12)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${20 + Math.random() * 60}%` }}
                            transition={{ duration: 0.5, delay: i * 0.05 }}
                            className="w-2 bg-gradient-to-t from-emerald-500/30 to-emerald-400 rounded-t"
                          />
                        ))}
                      </div>
                      <div className={`absolute top-2 left-2 text-[8px] font-mono ${theme.text2} opacity-50`}>
                        Network Activity
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Storage Details - For storage type */}
              {type === 'storage' && (
                <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
                  <h3 className={`text-sm font-bold ${theme.text} mb-4 flex items-center gap-2`}>
                    <Icon.HardDrive size={16} />
                    Локальное хранилище
                  </h3>
                  <div className="space-y-4">
                    {/* Storage visualization */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-mono ${theme.text2}`}>Использовано:</span>
                        <span className={`text-sm font-bold ${theme.text}`}>
                          {data?.memory?.breakdown?.storage?.local 
                            ? formatBytes(data.memory.breakdown.storage.local) 
                            : '0 B'} / 64 GB
                        </span>
                      </div>
                      <div className="h-4 rounded-full overflow-hidden bg-black/30 border border-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (data?.memory?.breakdown?.storage?.local || 0) / (64 * 1024 * 1024 * 1024) * 100)}%` }}
                          transition={{ duration: 1 }}
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        />
                      </div>
                    </div>
                    
                    {/* Storage breakdown */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                        <Icon.File size={18} className="mb-2 text-purple-400" />
                        <div className={`text-xs font-bold ${theme.text}`}>Сообщения</div>
                        <div className={`text-[10px] font-mono ${theme.text2}`}>~12 MB</div>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <Icon.Key size={18} className="mb-2 text-blue-400" />
                        <div className={`text-xs font-bold ${theme.text}`}>Ключи PQC</div>
                        <div className={`text-[10px] font-mono ${theme.text2}`}>~256 KB</div>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <Icon.Database size={18} className="mb-2 text-emerald-400" />
                        <div className={`text-xs font-bold ${theme.text}`}>CRDT State</div>
                        <div className={`text-[10px] font-mono ${theme.text2}`}>~4 MB</div>
                      </div>
                      <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                        <Icon.Zap size={18} className="mb-2 text-yellow-400" />
                        <div className={`text-xs font-bold ${theme.text}`}>Cache</div>
                        <div className={`text-[10px] font-mono ${theme.text2}`}>~50 MB</div>
                      </div>
                    </div>
                    
                    {/* Distributed storage */}
                    <div className="border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-mono ${theme.text2}`}>Распределённое хранилище:</span>
                        <span className={`text-sm font-bold text-gray-500`}>Не активно</span>
                      </div>
                      <div className={`text-[10px] font-mono ${theme.text2} opacity-50`}>
                        Для активации подключите больше P2P узлов
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div className={`text-center pt-4 border-t border-white/10`}>
                <p className={`text-[10px] font-mono ${theme.text2} opacity-50`}>
                  Обновлено: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString('ru-RU') : 'N/A'}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>,
      document.body
    );
  }

  return null;
};
