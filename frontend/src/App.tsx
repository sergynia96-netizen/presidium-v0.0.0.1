import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Icon from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";
import { fetchP2PStatus, fetchPQCStatus, fetchMetrics, fetchHealthStatus, fetchSystemStatus, type P2PStatus, type PQCStatus } from './api/status.api';
import { useP2P } from './hooks/useP2P';
import { DetailedMetricsPanel } from './components/DetailedMetricsPanel';
import { assistantService } from './services/ai/assistant.service';
import { VaultView, KeysView, NetworkView, ReputationView } from './views/SimpleViews';
import { SettingsView } from './views/SettingsView';
import { MiniAppsView } from './views/MiniAppsView';
import { EconomyView } from './views/EconomyView';
import { ProfileView } from './views/ProfileView';

// ============================================================================
// 🧠 ЛОКАЛЬНЫЕ ДВИЖКИ (WebGPU + WASM)
// ============================================================================

class LocalAIEngine {
  private engine: MLCEngine | null = null;
  private modelId = "Llama-3.2-1B-Instruct-q4f16_1-MLC"; // 1B Quantized Model (Low-end friendly)
  private status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private progressCallback: (text: string) => void = () => {};

  constructor(onProgress?: (text: string) => void) {
    if (onProgress) this.progressCallback = onProgress;
  }

  async init() {
    if (this.status === 'ready') {
      console.log("✅ ИИ уже инициализирован");
      return;
    }
    
    console.log("🚀 Начало инициализации локального ИИ Llama-3.2-1B...");
    this.progressCallback("🚀 Инициализация локального ИИ...");
    
    // 1. DEFINE PATHS
    // CRITICAL: web-llm AUTOMATICALLY appends "/resolve/main/" to the model URL!
    // Files are located in: /models/llama/resolve/main/
    // WASM is located in: /models/model.wasm
    const modelFolder = "/models/llama/resolve/main"; // Actual location of model files
    const modelLib = "/models/model.wasm"; // WASM in models root
    const configUrl = `${modelFolder}/mlc-chat-config.json`;

    this.status = 'loading';
    this.progressCallback("🔍 Diagnostic: Checking file access...");

    // NOTE (debug): web-llm uses Web Workers by default; network intercept in main thread won't see worker fetches.
    // Disable the worker to see network errors in the main console.
    const useWebWorker = false;

    // WebGPU feature detection (debug + adaptive config)
    // Some browsers/devices do NOT expose shader-f16; hard-requiring it causes ShaderF16SupportError.
    let shaderF16Supported: boolean | null = null;
    try {
      if ((navigator as any).gpu?.requestAdapter) {
        const adapter = await (navigator as any).gpu.requestAdapter();
        shaderF16Supported = !!adapter?.features?.has?.("shader-f16");
      }
    } catch {
      shaderF16Supported = null;
    }

    // AGGRESSIVE CACHE CLEARING: Delete ALL webllm caches to prevent stale HTML responses
    try {
      if (typeof caches !== 'undefined') {
        const cacheKeys = await caches.keys();
        console.log('🗑️ Found caches:', cacheKeys);
        // Delete ALL caches, not just webllm ones (to be safe)
        for (const cacheName of cacheKeys) {
          if (cacheName.includes('webllm') || cacheName.includes('mlc')) {
            const deleted = await caches.delete(cacheName);
            console.log(`🗑️ ${deleted ? 'Очищен' : 'Не удалось очистить'} кэш: ${cacheName}`);
          }
        }
      }
      
      // Also clear IndexedDB if available (web-llm may use it)
      if (typeof indexedDB !== 'undefined') {
        try {
          // Try to delete all webllm-related databases
          const databases = ['webllm-db', 'mlc-db', 'web-llm-db'];
          for (const dbName of databases) {
            try {
              const deleteReq = indexedDB.deleteDatabase(dbName);
              await new Promise((resolve, reject) => {
                deleteReq.onsuccess = () => resolve(undefined);
                deleteReq.onerror = () => reject(deleteReq.error);
                deleteReq.onblocked = () => {
                  console.warn(`⚠️ IndexedDB ${dbName} deletion blocked`);
                  resolve(undefined);
                };
              });
              console.log(`🗑️ Очищен IndexedDB: ${dbName}`);
            } catch (e) {
              // Ignore individual DB errors
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
    } catch (e: any) {
      console.warn('⚠️ Ошибка очистки кэша:', e.message);
    }

    // 2. PRE-FLIGHT CHECK (Crucial Step) - Check ALL required files
    // First, load ndarray-cache.json to see what files it references
    let ndarrayCache: any = null;
    try {
      const cacheResponse = await fetch(`${modelFolder}/ndarray-cache.json`);
      if (cacheResponse.ok) {
        const cacheText = await cacheResponse.text();
        if (!cacheText.trim().startsWith("<")) {
          ndarrayCache = JSON.parse(cacheText);
          
        }
      }
    } catch (e) {
      // Will check later
    }
    
    // Build list of required files from config + ndarray-cache
    const requiredFiles = [
      'mlc-chat-config.json',
      'ndarray-cache.json',
      'tokenizer.json',
      'tokenizer_config.json'
    ];
    
    // Add all shard files referenced in ndarray-cache.json
    if (ndarrayCache?.records) {
      const shardFiles = new Set<string>();
      ndarrayCache.records.forEach((record: any) => {
        if (record.dataPath) {
          shardFiles.add(record.dataPath);
        }
      });
      requiredFiles.push(...Array.from(shardFiles));
      
    } else {
      // Fallback to known shards
      requiredFiles.push('params_shard_0.bin', 'params_shard_1.bin');
    }
    
    // Also check WASM file
    const wasmUrl = modelLib;
    
    const missingFiles: string[] = [];
    const htmlFiles: string[] = [];
    const foundFiles: string[] = [];
    
    console.log(`🔍 Проверка файлов модели (всего: ${requiredFiles.length})...`);
    this.progressCallback(`🔍 Проверка ${requiredFiles.length} файлов...`);
    
    for (const file of requiredFiles) {
      const fileUrl = `${modelFolder}/${file}`;
      const fullUrl = window.location.origin + fileUrl;
      try {
        
        
        const testResponse = await fetch(fullUrl);
        const contentType = testResponse.headers.get('content-type') || 'unknown';
        
        
        
        if (!testResponse.ok) {
          missingFiles.push(file);
          console.error(`❌ Файл отсутствует: ${file} (${testResponse.status})`);
          
          continue;
        }
        
        // For binary files, check content-type instead of reading as text
        if (file.endsWith('.bin') || file.endsWith('.wasm')) {
          if (contentType.includes('text/html') || contentType.includes('text/plain')) {
            htmlFiles.push(file);
            console.error(`❌ Бинарный файл возвращает HTML: ${file}`);
            
          } else {
            foundFiles.push(file);
            console.log(`✅ Найден: ${file} (${contentType})`);
            
          }
        } else {
          // For JSON files, read and check content
          const text = await testResponse.text();
          if (text.trim().startsWith("<")) {
            htmlFiles.push(file);
            console.error(`❌ JSON файл возвращает HTML: ${file}`);
            
          } else {
            foundFiles.push(file);
            console.log(`✅ Найден: ${file}`);
            
          }
        }
      } catch (e: any) {
        missingFiles.push(file);
        console.error(`❌ Ошибка проверки файла ${file}:`, e.message);
        
      }
    }
    
    // Detailed logging of results
    console.log(`📊 Результаты проверки: Найдено ${foundFiles.length}, Отсутствует ${missingFiles.length}, HTML ${htmlFiles.length}`);
    if (missingFiles.length > 0) {
      console.error(`❌ ОТСУТСТВУЮТ КРИТИЧЕСКИЕ ФАЙЛЫ:`, missingFiles);
      
    }
    
    // Check WASM file with absolute URL
    const wasmFullUrl = window.location.origin + modelLib;
    try {
      
      const wasmResponse = await fetch(wasmFullUrl);
      if (!wasmResponse.ok) {
        missingFiles.push('model.wasm');
        console.error(`❌ WASM файл отсутствует: ${wasmFullUrl} (${wasmResponse.status})`);
        
      } else {
        const contentType = wasmResponse.headers.get('content-type') || 'unknown';
        if (contentType.includes('text/html')) {
          htmlFiles.push('model.wasm');
          console.error(`❌ WASM файл возвращает HTML: ${wasmFullUrl}`);
          
        } else {
          foundFiles.push('model.wasm');
          console.log(`✅ WASM файл найден: ${wasmFullUrl} (${contentType})`);
        }
      }
    } catch (e: any) {
      missingFiles.push('model.wasm');
      console.error(`❌ Ошибка проверки WASM:`, e.message);
      
    }
    
    // Check for missing critical files - especially .bin files
    const missingBinFiles = missingFiles.filter(f => f.endsWith('.bin'));
    const missingWasm = missingFiles.filter(f => f.endsWith('.wasm'));
    
    if (missingBinFiles.length > 0) {
      const errorMsg = `❌ КРИТИЧЕСКАЯ ОШИБКА: Отсутствуют файлы весов модели (${missingBinFiles.length} из ${requiredFiles.filter(f => f.endsWith('.bin')).length}):\n${missingBinFiles.slice(0, 5).join(', ')}${missingBinFiles.length > 5 ? '...' : ''}\n\nПожалуйста, скачайте файлы модели используя скрипт download_model.ps1 или поместите файлы params_shard_*.bin в папку frontend/public/models/llama/`;
      console.error(errorMsg);
      
      this.status = 'error';
      this.progressCallback(`❌ Отсутствуют файлы модели (${missingBinFiles.length} файлов)`);
      return;
    }
    
    if (missingWasm.length > 0) {
      const errorMsg = `❌ КРИТИЧЕСКАЯ ОШИБКА: Отсутствует файл WASM: ${missingWasm.join(', ')}`;
      console.error(errorMsg);
      this.status = 'error';
      this.progressCallback(`❌ Отсутствует файл WASM`);
      return;
    }
    
    if (htmlFiles.length > 0) {
      console.warn("⚠️ Некоторые файлы возвращают HTML (возможно кэш браузера):", htmlFiles);
      this.progressCallback("⚠️ Предупреждения диагностики, продолжаем...");
    } else {
      console.log("✅ [ДИАГНОСТИКА] Все необходимые файлы найдены.");
    }

    // 3. ACTUAL ENGINE LOAD
    // CRITICAL: web-llm appends "/resolve/main/" to the model URL automatically!
    // So we pass "/models/llama" (without trailing slash), and it will request:
    // "/models/llama/resolve/main/mlc-chat-config.json" - which is where our files are!
    const MODEL_URL = window.location.origin + "/models/llama"; // NO trailing slash!
    const MODEL_LIB_URL = window.location.origin + "/models/model.wasm"; // WASM is in /models/ root
    const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    
    const appConfig = {
      model_list: [
        {
          model: MODEL_URL, // web-llm will append /resolve/main/ to this
          model_id: MODEL_ID,
          model_lib: MODEL_LIB_URL,
          low_resource_required: true,
        }
      ],
      use_web_worker: false // Keep false for debugging
    };

    
    
    
    

    // Intercept fetch AND XMLHttpRequest to log all network requests
    const originalFetch = window.fetch;
    const fetchLogs: Array<{url: string, status: number, contentType: string, method: string, bodyPreview?: string, isHtml?: boolean}> = [];
    
    window.fetch = async function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      const urlStr = String(url);
      
      // Log ALL requests to /models/ for debugging
      if (urlStr.includes('/models/')) {
        console.log('🌐 FETCH REQUEST:', urlStr);
      }
      
      // Force bypass of HTTP cache for model assets
      if (urlStr.includes('/models/')) {
        const init: RequestInit = typeof args[1] === 'object' && args[1] !== null ? { ...(args[1] as RequestInit) } : {};
        init.cache = 'reload';
        args = [args[0], init];
      }
      
      const response = await originalFetch(...args);
      const contentType = response.headers.get('content-type') || 'unknown';
      const status = response.status;
      
      // Log response BEFORE cloning
      if (urlStr.includes('/models/')) {
        console.log('   ↳ Response:', status, contentType);
      }
      
      // CRITICAL: For model file requests, check if response is HTML BEFORE caching
      // Check content-type first (fast check)
      if (urlStr.includes('/models/') && contentType.includes('text/html')) {
        console.error('❌❌❌ CRITICAL: Server returned HTML content-type for', urlStr);
        console.error('   Status:', status);
        console.error('   Returning error response to prevent HTML from being used');
        
        // Return a proper error response instead of HTML
        // This will be caught by web-llm's error handling
        return new Response(null, {
          status: 404,
          statusText: 'File not found',
          headers: {
            'Content-Type': 'text/plain'
          }
        });
      }
      
      // Clone response to read body without consuming it
      let bodyPreview = '';
      let isHtml = false;
      let jsonParseError = false;
      try {
        const clonedResponse = response.clone();
        const text = await clonedResponse.text();
        bodyPreview = text.substring(0, 200);
        isHtml = text.trim().startsWith('<!') || text.trim().startsWith('<html');
        
        // Log body preview for /models/ requests
        if (urlStr.includes('/models/')) {
          console.log('   ↳ Body preview:', bodyPreview.substring(0, 80), isHtml ? '← IS HTML!' : '');
        }
        
        // CRITICAL: Double-check body content (in case content-type was wrong)
        if (isHtml && urlStr.includes('/models/')) {
          console.error('❌❌❌ CRITICAL: Server returned HTML body for', urlStr);
          console.error('   Status:', status);
          console.error('   Content-Type:', contentType);
          console.error('   Preview:', bodyPreview.substring(0, 150));
          console.error('   Converting to error response to prevent HTML from being used');
          
          // Return a proper error response instead of HTML
          return new Response(null, {
            status: 404,
            statusText: 'File not found',
            headers: {
              'Content-Type': 'text/plain'
            }
          });
        }
        
        // Try to parse as JSON to detect JSON parse errors
        if (!isHtml && contentType.includes('json')) {
          try {
            JSON.parse(text);
          } catch (jsonErr) {
            jsonParseError = true;
            console.error('❌ JSON PARSE ERROR for', urlStr, ':', String(jsonErr));
            console.error('   Body:', text.substring(0, 500));
          }
        }
      } catch (e) {
        bodyPreview = '(could not read body)';
      }
      
      const logEntry = {url: urlStr, status, contentType, method: 'fetch', bodyPreview, isHtml, jsonParseError};
      fetchLogs.push(logEntry);
      
      return response;
    };
    
    // Also intercept XMLHttpRequest
    const OriginalXHR = window.XMLHttpRequest;
    (window as any).XMLHttpRequest = function() {
      const xhr = new OriginalXHR();
      const originalOpen = xhr.open.bind(xhr);
      const originalSend = xhr.send.bind(xhr);
      let isModelRequest = false;
      
      xhr.open = function(method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null) {
        const urlStr = String(url);
        // Log ALL XHR requests to /models/ for debugging
        if (urlStr.includes('/models/')) {
          console.log('🌐 XHR OPEN:', method, urlStr);
          isModelRequest = true;
        }
        return originalOpen(method, url, async ?? true, user, password);
      };
      
      xhr.addEventListener('loadend', function() {
        // Log ALL XHR requests, not just model-related ones
        if (xhr.responseURL) {
          const responseText = typeof xhr.responseText === 'string' ? xhr.responseText.substring(0, 200) : 'non-string';
          const isHtml = typeof xhr.responseText === 'string' && (xhr.responseText.trim().startsWith('<!') || xhr.responseText.trim().startsWith('<html'));
          const contentType = xhr.getResponseHeader('content-type') || 'unknown';
          let jsonParseError = false;
          
          // Try to detect JSON parse errors
          if (!isHtml && contentType.includes('json') && typeof xhr.responseText === 'string') {
            try {
              JSON.parse(xhr.responseText);
            } catch (jsonErr) {
              jsonParseError = true;
              console.error('❌ XHR JSON PARSE ERROR for', xhr.responseURL, ':', String(jsonErr));
            }
          }
          
          const logEntry = {url: xhr.responseURL, status: xhr.status, contentType, method: 'xhr', bodyPreview: responseText, isHtml, jsonParseError};
          fetchLogs.push(logEntry);
          
          // Log HTML responses (path errors) - CRITICAL for debugging
          if (isHtml && xhr.responseURL.includes('/models/')) {
            console.error('❌❌❌ CRITICAL XHR: Server returned HTML for', xhr.responseURL);
            console.error('   Status:', xhr.status);
            console.error('   Content-Type:', contentType);
            console.error('   Preview:', typeof responseText === 'string' ? responseText.substring(0, 150) : 'non-string');
            console.error('   This means the file is missing or path is wrong!');
          }
        }
      });
      
      xhr.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
        // Attempt to bypass HTTP cache for XHR model requests
        try {
          if (isModelRequest) {
            xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, max-age=0');
            xhr.setRequestHeader('Pragma', 'no-cache');
            xhr.setRequestHeader('If-Modified-Since', 'Thu, 01 Jan 1970 00:00:00 GMT');
          }
        } catch (_) {
          // ignore header set errors
        }
        return originalSend(body);
      };
      
      return xhr;
    };

    try {
      this.progressCallback("🚀 Initializing Neural Core...");
      
      // Console log before CreateMLCEngine
      console.log("🚀 LUNCHING AI with paths:", appConfig.model_list[0]);
      
      // Aggressively clear Service Worker caches for any previous /models/ entries
      try {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          const c = await caches.open(key);
          const reqs = await c.keys();
          for (const req of reqs) {
            if (req.url.includes('/models/')) {
              await c.delete(req);
            }
          }
        }
        console.log('🧹 Cleared CacheStorage entries for /models/');
      } catch (clearErr) {
        console.warn('⚠️ Failed to clear CacheStorage entries for /models/:', clearErr);
      }
      
      // CRITICAL: Pre-load and verify critical JSON files to prevent HTML cache issues
      const criticalFiles = ['mlc-chat-config.json', 'ndarray-cache.json', 'tokenizer.json'];
      const modelBaseUrl = MODEL_URL + '/'; // Ensure trailing slash for concatenation
      
      console.log('🔍 Pre-loading critical JSON files...');
      for (const file of criticalFiles) {
        const fileUrl = modelBaseUrl + file;
        try {
          const testResponse = await fetch(fileUrl, { cache: 'no-store' });
          const contentType = testResponse.headers.get('content-type') || '';
          const text = await testResponse.text();
          
          if (contentType.includes('text/html') || text.trim().startsWith('<!')) {
            console.error(`❌ CRITICAL: ${file} returns HTML! URL: ${fileUrl}`);
            console.error(`   This file MUST be accessible at: ${fileUrl}`);
            throw new Error(`File ${file} returns HTML instead of JSON. Check file path: ${fileUrl}`);
          }
          
          // Try to parse as JSON to verify
          try {
            JSON.parse(text);
            console.log(`✅ Verified: ${file} is valid JSON`);
          } catch (e) {
            console.error(`❌ CRITICAL: ${file} is not valid JSON!`, e);
            throw new Error(`File ${file} is not valid JSON`);
          }
        } catch (e: any) {
          if (e.message.includes('HTML') || e.message.includes('JSON')) {
            throw e; // Re-throw our custom errors
          }
          console.error(`❌ Failed to pre-load ${file}:`, e.message);
          throw new Error(`Cannot access ${file} at ${modelBaseUrl}${file}: ${e.message}`);
        }
      }
      console.log('✅ All critical files verified before CreateMLCEngine');
      
      // CRITICAL: Intercept Cache.prototype to prevent HTML from being cached
      const CacheProto = (Cache as any).prototype;
      const originalCacheMatch = CacheProto.match;
      const originalCachePut = CacheProto.put;
      
      // Prevent HTML responses from being cached in the first place
      CacheProto.put = async function(request: any, response: Response) {
        const url = typeof request === 'string' ? request : request.url;
        if (url.includes('/models/')) {
          const contentType = response.headers.get('content-type') || '';
          // Check if response is HTML before caching
          if (contentType.includes('text/html')) {
            console.error('🚫 BLOCKING HTML from cache for:', url);
            return; // Don't cache HTML responses
          }
          // Also check body content
          try {
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            if (text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
              console.error('🚫 BLOCKING HTML body from cache for:', url);
              return; // Don't cache HTML responses
            }
          } catch (e) {
            // If we can't read the body, allow caching (might be binary)
          }
        }
        return originalCachePut.call(this, request, response);
      };
      
      CacheProto.match = async function(request: any, options?: any) {
        const url = typeof request === 'string' ? request : request.url;
        console.log('🔍 CACHE.match called for:', url);
        const result = await originalCacheMatch.call(this, request, options);
        if (result && url.includes('/models/')) {
          const contentType = result.headers.get('content-type') || 'unknown';
          console.log('   ↳ Cache hit:', contentType);
          // Check if cached response is HTML (double-check, should not happen now)
          try {
            const text = await result.clone().text();
            if (text.trim().startsWith('<!')) {
              console.error('❌❌❌ CACHE CONTAINS HTML for', url);
              console.error('   Deleting this cache entry and returning undefined to force re-fetch');
              await this.delete(request);
              return undefined; // Force re-fetch
            }
          } catch (e) {
            // Ignore
          }
        }
        return result;
      };
      
      console.log('🔧 Calling CreateMLCEngine with MODEL_ID:', MODEL_ID);
      console.log('🔧 appConfig:', JSON.stringify(appConfig, null, 2));
      console.log('🔧 Cache.match intercepted to detect HTML in cache');
      
      // CRITICAL FIX: Pass MODEL_ID (string) as first parameter, NOT from appConfig
      // CreateMLCEngine(modelId: string, config: {...})
      this.engine = await CreateMLCEngine(
        MODEL_ID, // Must be a string, not undefined
        { 
          appConfig: appConfig,
          initProgressCallback: (report) => {
            this.progressCallback(report.text);
            console.log('📊 Progress:', report.text);
          }
        }
      );
      
      // Restore original Cache methods
      CacheProto.match = originalCacheMatch;
      CacheProto.put = originalCachePut;
      
      console.log('✅✅✅ CreateMLCEngine SUCCESS! Engine created.');
      this.status = 'ready';
      this.progressCallback("Neural Core Online (Local)");
      
      
      
      // Restore original fetch and XHR
      window.fetch = originalFetch;
      (window as any).XMLHttpRequest = OriginalXHR;
    } catch (e: any) {
      
      console.error("❌ КРИТИЧЕСКАЯ ОШИБКА загрузки ИИ:", e);
      console.error("Детали ошибки:", {
        name: e.name,
        message: e.message,
        stack: e.stack?.substring(0, 200)
      });
      
      // Check if error is about missing files or HTML responses
      if (e.message.includes('Unexpected token') || e.message.includes('JSON') || e.message.includes('HTML') || e.message.includes('<!')) {
        console.error("💡 ВОЗМОЖНАЯ ПРИЧИНА: Файлы модели не найдены или возвращают HTML вместо данных.");
        console.error("💡 РЕШЕНИЕ: Убедитесь, что все файлы params_shard_*.bin находятся в frontend/public/models/llama/");
        console.error("💡 Запустите скрипт: node frontend/organize_model.js для проверки файлов");
        this.progressCallback("❌ Ошибка: файлы модели не найдены. Проверьте консоль.");
      } else {
        this.progressCallback("❌ Ошибка загрузки: " + e.message.substring(0, 50));
      }
      
      // Filter fetchLogs to only model-related requests for debugging
      const modelRequests = fetchLogs.filter(log => 
        log.url.includes('/models/') || 
        log.url.includes('mlc-chat-config') || 
        log.url.includes('tokenizer') || 
        log.url.includes('ndarray')
      );
      console.error("📊 Сетевые запросы к файлам модели:", modelRequests.length > 0 ? modelRequests : "Нет запросов");
      this.status = 'error';
      
      // Restore original fetch and XHR
      window.fetch = originalFetch;
      (window as any).XMLHttpRequest = OriginalXHR;
    }
  }

  async generateReply(context: string[]): Promise<string> {
    if (!this.engine || this.status !== 'ready') {
      // Auto-init if not ready
      try {
        await this.init();
      } catch (e) {
        return '⚠️ Модель ИИ не загружена. Проверьте поддержку WebGPU.';
      }
    }
    
    if (!this.engine) {
      return '⚠️ Движок ИИ не инициализирован.';
    }
    
    try {
      // Convert context array to chat history format
      const messages = [
        { role: "system", content: "You are Presidium AI, a secure assistant. Be concise and helpful. Respond in Russian when appropriate." },
        { role: "user", content: context.join("\n") }
      ];

      // Use streaming API for better UX
      let fullReply = '';
      const response = await this.engine.chat.completions.create({
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 128, // Keep it short for speed
        stream: false, // Non-streaming for simplicity
      });

      return response.choices[0]?.message?.content || "Не удалось сгенерировать ответ.";
    } catch (e) {
      console.error("Generation error:", e);
      return '⚠️ Ошибка генерации ответа. Попробуйте еще раз.';
    }
  }

  // Fallback heuristic methods for instant checks (to save battery)
  async moderate(text: string): Promise<{ isSpam: boolean; confidence: number; reason: string }> {
    // Simple heuristic for speed, can be upgraded to LLM check if needed
    const spamKeywords = ['bank', 'credit', 'urgent transfer', 'crypto', 'password', 'verify account', 'click here', 'buy now', 'winner', 'prize'];
    const isSpam = spamKeywords.some(k => text.toLowerCase().includes(k));
    return { 
      isSpam, 
      confidence: isSpam ? 0.9 : 0.1, 
      reason: isSpam ? 'keyword-match' : 'clean' 
    };
  }

  getStatus() { 
    return this.status; 
  }

  // Compatibility methods for existing code
  async loadModel(type: 'nlp' | 'moderation' | 'emotion' | 'embedding' | 'voice' | 'vision') {
    // For compatibility, just init the engine
    if (type === 'nlp') {
      await this.init();
    }
  }

  getModelStatus(type: string) {
    return this.status;
  }

  getLoadedModelsCount(): number {
    return this.status === 'ready' ? 1 : 0;
  }
}

class PrivacyGuard {
  private static instance: PrivacyGuard;
  private auditLog: Array<{ timestamp: number; action: 'ALLOWED' | 'BLOCKED'; dataHash: string; reason: string; type: 'message' | 'file' | 'call' }> = [];
  private blockedContent: Set<string> = new Set();
  
  static getInstance(): PrivacyGuard {
    if (!PrivacyGuard.instance) {
      PrivacyGuard.instance = new PrivacyGuard();
    }
    return PrivacyGuard.instance;
  }
  
  async scanContent(content: string, type: 'message' | 'file' | 'call' = 'message'): Promise<{ allowed: boolean; reason?: string }> {
    const hash = await this.hash(content);
    const ai = new LocalAIEngine();
    const moderation = await ai.moderate(content);
    
    this.auditLog.unshift({
      timestamp: Date.now(),
      action: moderation.isSpam ? 'BLOCKED' : 'ALLOWED',
      dataHash: hash.slice(0, 16),
      reason: moderation.reason,
      type
    });
    
    if (this.auditLog.length > 500) this.auditLog = this.auditLog.slice(0, 500);
    if (moderation.isSpam) this.blockedContent.add(hash);
    
    return { allowed: !moderation.isSpam, reason: moderation.reason };
  }
  
  private async hash(data: string): Promise<string> {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  getAuditLog(limit = 50) {
    return this.auditLog.slice(0, limit);
  }
  
  getStats() {
    return {
      total: this.auditLog.length,
      blocked: this.auditLog.filter(e => e.action === 'BLOCKED').length,
      allowed: this.auditLog.filter(e => e.action === 'ALLOWED').length,
      blockedContent: this.blockedContent.size
    };
  }
}

class VaultManager {
  private static instance: VaultManager;
  private db: any = null;
  
  static getInstance(): VaultManager {
    if (!VaultManager.instance) VaultManager.instance = new VaultManager();
    return VaultManager.instance;
  }
  
  async init() {
    return new Promise(resolve => {
      const request = indexedDB.open('PresidiumVault', 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e: any) => {
        this.db = e.target.result;
        resolve(this.db);
      };
    });
  }
}

// ============================================================================
// 🎨 ТИПЫ И КОНСТАНТЫ
// ============================================================================

type ThemeMode = 'LUX' | 'CYBER' | 'PRIVACY';
type ViewType = 'auth' | 'dashboard' | 'chats' | 'chat-detail' | 'ai-core' | 'economy' | 'profile' | 'vault' | 'keys' | 'network' | 'reputation' | 'mini-apps' | 'settings';

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
  buttonPrimary: string;
  buttonSecondary: string;
  gradientBg: string;
  statusOnline: string;
  statusOffline: string;
  statusProcessing: string;
}

const THEMES: Record<ThemeMode, Theme> = {
  LUX: {
    id: 'lux',
    bg: 'bg-gray-50',
    text: 'text-gray-900',
    text2: 'text-gray-600',
    accent: 'bg-black',
    accentText: 'text-white',
    border: 'border-gray-200',
    glass: 'bg-white/60 backdrop-blur-2xl backdrop-saturate-150 border-white/40',
    glassHover: 'hover:bg-white/80 transition-all duration-200',
    input: 'bg-white focus:bg-gray-50',
    shadow: 'shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]',
    dock: 'bg-white/90 border-gray-200',
    bubbleMe: 'bg-black text-white',
    bubbleThem: 'bg-white text-black shadow-sm border border-gray-200',
    aiBubble: 'bg-gradient-to-br from-blue-600 to-blue-800 text-white',
    buttonPrimary: 'bg-black text-white',
    buttonSecondary: 'bg-gray-200 text-gray-900',
    gradientBg: 'bg-gradient-to-br from-gray-100 to-gray-200',
    statusOnline: 'bg-green-500',
    statusOffline: 'bg-gray-400',
    statusProcessing: 'bg-blue-500'
  },
  CYBER: {
    id: 'cyber',
    bg: 'bg-black',
    text: 'text-green-400',
    text2: 'text-green-600',
    accent: 'bg-green-400',
    accentText: 'text-black',
    border: 'border-green-500/30',
    glass: 'bg-[#0a0a0a]/60 backdrop-blur-2xl backdrop-saturate-150 border-green-500/20',
    glassHover: 'hover:bg-[#0a0a0a]/80 transition-all duration-200',
    input: 'bg-[#0a0a0a] focus:bg-[#1a1a1a]',
    shadow: 'shadow-[0_0_40px_-10px_rgba(0,255,0,0.2)]',
    dock: 'bg-[#0a0a0a]/90 border-green-500/30',
    bubbleMe: 'bg-green-400 text-black',
    bubbleThem: 'bg-[#111] text-green-400 border border-green-500/20',
    aiBubble: 'bg-gradient-to-br from-green-400 to-emerald-700 text-black',
    buttonPrimary: 'bg-green-400 text-black',
    buttonSecondary: 'bg-[#222] text-green-400',
    gradientBg: 'bg-gradient-to-br from-[#050505] to-[#0a0a0a]',
    statusOnline: 'bg-green-400',
    statusOffline: 'bg-gray-700',
    statusProcessing: 'bg-yellow-400'
  },
  PRIVACY: {
    id: 'privacy',
    bg: 'bg-[#0A0A1A]',
    text: 'text-[#E0E0FF]',
    text2: 'text-[#A0A0C0]',
    accent: 'bg-[#7B68EE]',
    accentText: 'text-white',
    border: 'border-[#333366]',
    glass: 'bg-[#151530]/60 backdrop-blur-2xl backdrop-saturate-150 border-[#333366]',
    glassHover: 'hover:bg-[#151530]/80 transition-all duration-200',
    input: 'bg-[#0F0F2A] focus:bg-[#1F1F4A]',
    shadow: 'shadow-[0_0_40px_-10px_rgba(123,104,238,0.15)]',
    dock: 'bg-[#101020]/90 border-[#333366]',
    bubbleMe: 'bg-[#7B68EE] text-white',
    bubbleThem: 'bg-[#222244] text-[#E0E0FF] border-[#333366]',
    aiBubble: 'bg-gradient-to-br from-[#7B68EE] to-[#9370DB] text-white',
    buttonPrimary: 'bg-[#7B68EE] text-white',
    buttonSecondary: 'bg-[#222244] text-[#A0A0C0]',
    gradientBg: 'bg-gradient-to-br from-[#0A0A1A] to-[#151530]',
    statusOnline: 'bg-emerald-400',
    statusOffline: 'bg-gray-600',
    statusProcessing: 'bg-blue-400'
  }
};

const TRANSLATIONS: Record<string, any> = {
  ru: {
    app: { name: "PRESIDIUM", version: "v10.1-QUANTUM" },
    auth: { 
      title: "PRESIDIUM", 
      subtitle: "Локальное ИИ-Ядро", 
      node_ready: "УЗЕЛ ГОТОВ", 
      node_active: "УЗЕЛ АКТИВЕН",
      btn_activate: "АКТИВИРОВАТЬ", 
      privacy_guarantee: "100% обработка на устройстве" 
    },
    nav: { 
      dashboard: "ЦУП", 
      chats: "Связь", 
      ai: "ИИ-Ядро", 
      economy: "Госплан", 
      profile: "Гражданин"
    },
    dashboard: { 
      title: "ЦЕНТР УПРАВЛЕНИЯ", 
      active: "Активные потоки", 
      memory: "Память ИИ", 
      storage: "Хранилище", 
      network: "P2P узлы", 
      reputation: "Репутация", 
      sync: "Синхронизация", 
      quantum: "PQC ключ" 
    },
    chats: { 
      title: "КОММУТАТОР", 
      search: "Поиск (локально)...", 
      typing: "ИИ обрабатывает...", 
      folders: { all: "Все", p2p: "Личные", secure: "Секрет", channels: "Эфир" }
    },
    chat: { 
      input_placeholder: "Сообщение (обрабатывается локально)...", 
      moderation: "Модерация ИИ", 
      local: "Локально"
    },
    ai: { 
      title: "НЕЙРО-ЯДРО", 
      input: "Введите команду...", 
      processing: "Обработка...", 
      models: "Модели", 
      privacy: "Приватность", 
      chat: "Чат",
      bci: "BCI",
      holographic: "3D",
      generate: "Генерировать"
    },
    economy: { 
      title: "ЭКОНОМИКА", 
      total: "Капитал", 
      deposit: "Ввод", 
      swap: "Обмен", 
      store: "Депо", 
      kb: "КБ", 
      ipo: "Биржа", 
      tasks: "Миссии", 
      stake: "Стейкинг", 
      rewards: "Награды" 
    },
    profile: { 
      user: "Командир", 
      logout: "ОТКЛЮЧИТЬСЯ", 
      status: "ВЕТЕРАН", 
      uptime: "Аптайм", 
      reputation: "Доверие"
    },
    vault: { 
      title: "КРИПТОСЕЙФ", 
      files: "Файлы", 
      encrypted: "Зашифровано", 
      backup: "Резерв", 
      export: "Экспорт"
    },
    keys: { 
      title: "УПРАВЛЕНИЕ КЛЮЧАМИ", 
      verify: "Верифицировать", 
      backup: "Резерв", 
      create: "Создать"
    },
    network: { 
      title: "P2P СЕТЬ", 
      peers: "Пиры", 
      latency: "Задержка", 
      relays: "Релеи", 
      vpn: "VPN модуль", 
      sync: "Синхронизация"
    },
    reputation: { 
      title: "СИСТЕМА ДОВЕРИЯ", 
      trust_graph: "Граф доверия", 
      governance: "Управление", 
      proofs: "Доказательства"
    },
    mini_apps: { 
      title: "МИНИ-ПРИЛОЖЕНИЯ"
    },
    settings: { 
      title: "ПАРАМЕТРЫ СИСТЕМЫ", 
      notifications: "Уведомления", 
      haptic: "Вибрация", 
      backup: "Резерв", 
      reset: "Сброс"
    },
    privacy: { 
      level_max: "МАКС (100% локально)", 
      audit_log: "Аудит лог", 
      processed_locally: "Обработано на устройстве", 
      zero_access: "Zero-access архитектура"
    },
    status: {
      online: "NET: ONLINE",
      ai_ready: "ИИ: ГОТОВ",
      ai_processing: "ИИ: ОБРАБОТКА",
      ai_idle: "ИИ: ОЖИДАНИЕ"
    }
  }
};

const MOCK_CHATS = [
  { id: '1', name: 'Presidium AI', msg: 'Квантовое шифрование активно. Все сообщения обрабатываются на устройстве.', time: '10:42', type: 'ai', unread: 0, local: true, secure: true, avatar: 'AI' },
  { id: '2', name: '⚠️ МОШЕННИЧЕСТВО', msg: '[ЗАБЛОКИРОВАНО] Попытка фишинга обнаружена и заблокирована локальным ИИ.', time: '09:38', type: 'scam', unread: 1, local: false, secure: false, avatar: '!' },
  { id: '3', name: 'КБ "Горизонт-7"', msg: 'Протокол P2P синхронизации CRDT успешно применен.', time: 'Вчера', type: 'secure', unread: 3, local: true, secure: true, avatar: 'K' }
];

const MOCK_MINI_APPS = [
  { id: 'wallet', name: 'Кошелек', icon: '💰', permissions: ['payment', 'storage'], status: 'installed' },
  { id: 'scanner', name: 'QR Сканер', icon: '📷', permissions: ['camera'], status: 'running' },
  { id: 'torch', name: 'Фонарик', icon: '🔦', permissions: ['camera'], status: 'installed' }
];

const MOCK_REPUTATION = {
  score: 984,
  rank: 'ВЕТЕРАН',
  staked: 1500,
  rewards: 234.5,
  reports: 12,
  trusted: 89,
  blocked: 3,
  uptime: 99.9
};

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
        
        if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };
    
    const interval = setInterval(draw, 50);
    return () => clearInterval(interval);
  }, [color]);
  
  return <canvas ref={canvasRef} className="fixed inset-0 z-0 opacity-[0.15] pointer-events-none mix-blend-screen" />;
};

const StatusIndicator = ({ 
  status, 
  theme, 
  label 
}: { 
  status: 'online' | 'offline' | 'processing' | 'syncing'; 
  theme: Theme; 
  label?: string; 
}) => {
  const colors = {
    online: theme.statusOnline,
    offline: theme.statusOffline,
    processing: theme.statusProcessing,
    syncing: theme.statusProcessing
  };
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${theme.border} ${theme.glass}`}>
      <motion.div
        animate={{ opacity: status === 'processing' || status === 'syncing' ? [0.3, 1, 0.3] : 1 }}
        transition={{ duration: 1.5, repeat: status === 'processing' || status === 'syncing' ? Infinity : 0 }}
        className={`w-2 h-2 rounded-full ${colors[status]}`}
      />
      <span className={`text-[10px] font-mono ${theme.text}`}>
        {label || (status === 'online' ? 'ONLINE' : status === 'offline' ? 'OFFLINE' : 'PROC')}
      </span>
    </div>
  );
};

const ScamAlertOverlay = ({ onClose, theme }: { onClose: () => void; theme: Theme }) => (
  <motion.div 
    initial={{ y: -60, opacity: 0 }} 
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: -60, opacity: 0 }}
    className={`fixed top-20 left-4 right-4 z-50 p-4 border border-red-500/60 rounded-2xl shadow-[0_0_40px_rgba(255,0,0,0.4)] backdrop-blur-2xl ${
      theme.id === 'lux' ? 'bg-red-50 text-red-900' : 'bg-red-900/90 text-red-100'
    }`}
  >
    <div className="flex items-start gap-4">
      <div className={`p-2 rounded-full ${theme.accentText} ${theme.accent}`}>
        <Icon.ShieldAlert size={24} />
      </div>
      <div className="flex-1">
        <h4 className={`font-bold uppercase tracking-wider ${theme.id === 'lux' ? 'text-red-800' : 'text-red-200'}`}>
          🛡️ УГРОЗА МОШЕННИЧЕСТВА
        </h4>
        <p className={`text-xs mt-2 ${theme.id === 'lux' ? 'text-red-700' : 'text-red-300'}`}>
          Локальный ИИ обнаружил паттерны социальной инженерии. Сообщение заблокировано на устройстве.
        </p>
        <div className="mt-3 flex gap-2">
          <button onClick={onClose} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${theme.buttonPrimary}`}>
            ПОНЯТНО
          </button>
        </div>
      </div>
    </div>
  </motion.div>
);

const Dock = ({ activeTab, onChange, theme }: { activeTab: string; onChange: (tab: ViewType) => void; theme: Theme }) => {
  const items = [
    { id: 'dashboard', icon: Icon.LayoutDashboard }, 
    { id: 'chats', icon: Icon.MessageSquare }, 
    { id: 'ai-core', icon: Icon.Brain }, 
    { id: 'economy', icon: Icon.Coins }, 
    { id: 'profile', icon: Icon.User }
  ];
  
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-xs px-4">
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className={`flex justify-around items-center px-2 py-3 rounded-[32px] border shadow-2xl backdrop-blur-2xl ${theme.dock} ${theme.border}`}
      >
        {items.map(item => (
          <motion.button 
            key={item.id}
            onClick={() => onChange(item.id as ViewType)}
            whileTap={{ scale: 0.9 }}
            className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              activeTab === item.id ? theme.accent : 'hover:bg-white/10'
            }`}
          >
            <item.icon 
              size={22} 
              strokeWidth={activeTab === item.id ? 2.5 : 2} 
              className={activeTab === item.id ? theme.accentText : theme.text2} 
            />
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};

// ============================================================================
// 📱 ЭКРАНЫ
// ============================================================================

const AuthScreen = ({ onLogin, theme, t, toggleTheme, aiEngine, progressText }: any) => {
  const [stage, setStage] = useState<'idle' | 'loading' | 'done'>('idle');
  const [localProgress, setLocalProgress] = useState('Инициализация...');
  const [isLoading, setIsLoading] = useState(false);
  const [p2pStatus, setP2pStatus] = useState<P2PStatus | null>(null);
  const [p2pLoading, setP2pLoading] = useState(true);
  const [pqcStatus, setPqcStatus] = useState<PQCStatus | null>(null);
  const [pqcLoading, setPqcLoading] = useState(true);
  const [frontendPQCReady, setFrontendPQCReady] = useState(false);
  
  // P2P WebRTC client
  const p2pClient = useP2P();
  
  // Check frontend PQC status from P2P client
  useEffect(() => {
    if (p2pClient.peer) {
      // P2P client is initialized, which means PQC is also initialized
      setFrontendPQCReady(true);
      console.log('✅ Frontend PQC ready');
    } else {
      setFrontendPQCReady(false);
    }
  }, [p2pClient.peer]);
  
  // Debug logging for status
  useEffect(() => {
    console.log('📊 P2P Status:', {
      connected: p2pClient.connected,
      peers: p2pClient.peers.length,
      hasPeer: !!p2pClient.peer,
      backendStatus: p2pStatus?.connected,
    });
  }, [p2pClient.connected, p2pClient.peers.length, p2pClient.peer, p2pStatus?.connected]);
  
  useEffect(() => {
    console.log('🔐 PQC Status:', {
      backendInitialized: pqcStatus?.initialized,
      frontendReady: frontendPQCReady,
      algorithm: pqcStatus?.algorithm,
    });
  }, [pqcStatus?.initialized, frontendPQCReady, pqcStatus?.algorithm]);
  
  // Use progress from aiEngine callback if available, otherwise use local state
  const displayProgress = progressText || localProgress;
  
  // Fetch P2P status on mount and poll periodically
  // Also use WebRTC client status if available
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setP2pLoading(true);
        const status = await fetchP2PStatus();
        
        // Combine with WebRTC client status
        // If WebRTC client is connected to signaling server, P2P is active even without peers
        const webRTCConnected = p2pClient.connected ? (p2pClient.peers.length || 1) : 0; // 1 = connected to signaling
        const totalConnected = Math.max(status.connected || 0, webRTCConnected);
        
        setP2pStatus({
          ...status,
          connected: totalConnected > 0 ? totalConnected : (p2pClient.connected ? 1 : 0),
        });
      } catch (error) {
        console.error('Failed to fetch P2P status:', error);
        // Use WebRTC client status if available - connected to signaling = P2P active
        const webRTCStatus = p2pClient.connected ? 1 : 0; // 1 = connected to signaling server
        setP2pStatus({ 
          connected: webRTCStatus, 
          total: webRTCStatus, 
          list: [] 
        });
      } finally {
        setP2pLoading(false);
      }
    };

    // Small delay to allow P2P client to connect
    const timeout = setTimeout(() => {
      fetchStatus();
    }, 500);

    // Poll every 3 seconds
    const interval = setInterval(fetchStatus, 3000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [p2pClient.connected, p2pClient.peers.length]);

  // Fetch PQC status on mount and poll periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setPqcLoading(true);
        const status = await fetchPQCStatus();
        // Combine backend and frontend status
        setPqcStatus({
          ...status,
          // If frontend PQC is ready, mark as initialized
          initialized: status.initialized || frontendPQCReady,
        });
      } catch (error) {
        console.error('Failed to fetch PQC status:', error);
        // If frontend PQC is ready, don't mark as uninitialized
        if (frontendPQCReady) {
          setPqcStatus({
            initialized: true,
            algorithm: 'Kyber1024-Dilithium5',
            keyPairs: 1,
            kyberKeySize: 1568,
            dilithiumKeySize: 2544,
            production: false,
          });
        } else {
          setPqcStatus({
            initialized: false,
            algorithm: 'N/A',
            keyPairs: 0,
            kyberKeySize: 0,
            dilithiumKeySize: 0,
            production: false,
          });
        }
      } finally {
        setPqcLoading(false);
      }
    };

    // Small delay to allow frontend PQC to initialize
    const timeout = setTimeout(() => {
      fetchStatus();
    }, 1000);

    // Poll every 5 seconds (PQC status changes less frequently)
    const interval = setInterval(fetchStatus, 5000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [frontendPQCReady]);
  
  const start = async () => {
    // Prevent multiple clicks
    if (isLoading || stage === 'loading') {
      return;
    }
    
    try {
      // Set loading state at the start
      setIsLoading(true);
      setStage('loading');
      setLocalProgress('Инициализация WebGPU...');
      
      // Call the real engine.init() and WAIT for it to complete
      // The init() method already handles all the initialization and sets status to 'ready' when done
      await aiEngine.init();
      
      // Verify the engine is actually ready
      const status = aiEngine.getStatus();
      if (status === 'ready') {
        setLocalProgress('Neural Core Online');
        setStage('done');
        // Wait a moment for the checkmark animation, then login
        setTimeout(() => {
          setIsLoading(false);
          onLogin();
        }, 800);
      } else if (status === 'error') {
        throw new Error('Engine initialization failed');
      } else {
        // If status is still 'loading', wait a bit more (shouldn't happen, but safety check)
        throw new Error('Engine initialization did not complete');
      }
      
    } catch (e: any) {
      console.error("❌❌❌ ENGINE START ERROR:", e);
      console.error("Full error details:", {
        name: e.name,
        message: e.message,
        stack: e.stack
      });
      setLocalProgress('Ошибка загрузки. Продолжаем без ИИ...');
      setStage('done');
      setIsLoading(false);
      // Even if AI fails, let the user in after a delay
      setTimeout(() => {
        onLogin();
      }, 2000);
    }
  };
  
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden ${theme.gradientBg}`}>
      {theme.id === 'cyber' && <MatrixRain color="#00FF00" />}
      {theme.id === 'privacy' && <MatrixRain color="#7B68EE" />}
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 flex flex-col items-center"
      >
        <motion.div 
          animate={stage !== 'idle' ? { 
            scale: [1, 1.08, 1, 1.05, 1],
          } : {}}
          transition={{ 
            duration: 4.8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`w-32 h-32 rounded-[40px] grid place-items-center shadow-2xl mb-6 ${
            theme.id === 'lux' ? 'bg-white text-black' : 'bg-gradient-to-br from-purple-600 to-purple-800 text-white'
          }`}
          style={theme.id !== 'lux' ? {
            background: 'linear-gradient(135deg, rgba(74, 181, 126, 1) 0%, rgba(0, 153, 25, 1) 100%)',
            borderWidth: '1px',
            borderColor: 'rgba(0, 0, 0, 1)'
          } : {}}
        >
          <Icon.HandFist size={64} />
        </motion.div>
        
        <h1 className={`text-5xl font-black tracking-tighter text-center mb-2 ${theme.text} font-orbitron`}>
          PRE<span className={theme.id !== 'lux' ? 'text-purple-400' : ''} style={theme.id !== 'lux' ? { color: 'var(--tw-ring-offset-color)' } : {}}>SID</span>IUM
        </h1>
        
        <p className={`text-xs font-mono tracking-[0.3em] uppercase mb-4 opacity-60 ${theme.text2}`}>
          {t('auth.subtitle')}
        </p>
        
        {stage === 'loading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 text-center">
            <div className={`text-[11px] font-mono ${theme.text2} mb-2`}>
              {displayProgress}
            </div>
            <div className={`mt-4 ${theme.text} flex justify-center`}>
              <Icon.Loader2 size={32} className="animate-spin" />
            </div>
            <div className={`text-[9px] font-mono ${theme.text2} opacity-60 mt-2`}>
              Загрузка Llama-3.2-1B...
            </div>
          </motion.div>
        )}
        
        <div className="flex gap-3 mb-8">
          <StatusIndicator 
            status={
              p2pClient.connected 
                ? 'online' 
                : (p2pStatus?.connected && p2pStatus.connected > 0)
                  ? 'online'
                  : (p2pLoading || (p2pClient.peer && !p2pClient.connected))
                    ? 'processing'
                    : 'offline'
            } 
            theme={theme} 
            label={
              (p2pLoading || (p2pClient.peer && !p2pClient.connected)) && !p2pClient.connected && (!p2pStatus || p2pStatus.connected === 0)
                ? 'P2P:...' 
                : (p2pClient.connected || (p2pStatus?.connected && p2pStatus.connected > 0))
                  ? (p2pClient.peers.length > 0 
                      ? `P2P:${p2pClient.peers.length}` 
                      : 'P2P:ON')
                  : 'P2P:OFF'
            } 
          />
          <StatusIndicator 
            status={
              (pqcStatus?.initialized || frontendPQCReady)
                ? (pqcStatus?.production ? 'online' : 'processing')
                : (pqcLoading || (p2pClient.peer && !frontendPQCReady))
                  ? 'processing'
                  : 'offline'
            } 
            theme={theme} 
            label={
              (pqcLoading && !frontendPQCReady && !pqcStatus?.initialized && !p2pClient.peer)
                ? 'PQC:...' 
                : (pqcStatus?.initialized || frontendPQCReady || p2pClient.peer)
                  ? 'PQC:OK'
                  : 'PQC:OFF'
            } 
          />
        </div>
        
        <div className="flex flex-col gap-3">
        <motion.button 
          onClick={start} 
          disabled={isLoading || stage !== 'idle'} 
          whileHover={stage === 'idle' && !isLoading ? { scale: 1.05 } : {}}
          whileTap={stage === 'idle' && !isLoading ? { scale: 0.95 } : {}}
          className={`min-w-[280px] h-16 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
            stage === 'idle' ? theme.buttonPrimary : theme.accent
          } ${theme.accentText} ${stage === 'idle' ? theme.shadow : ''} disabled:opacity-60`}
        >
          {stage === 'idle' && <><Icon.Power size={20} /> {t('auth.btn_activate')}</>}
          {stage === 'loading' && <Icon.Loader2 className="animate-spin" size={24} />}
          {stage === 'done' && <><Icon.Check size={24} /> {t('auth.node_active')}</>}
        </motion.button>
          
          {/* Quick entry button - skip AI loading */}
          <motion.button 
            onClick={onLogin} 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`min-w-[280px] h-10 rounded-xl font-medium text-sm flex items-center justify-center gap-2 ${theme.glass} border ${theme.border} ${theme.text2} hover:${theme.text} transition-all`}
          >
            <Icon.Zap size={16} />
            Быстрый вход
          </motion.button>
        </div>
        
        <motion.button 
          onClick={toggleTheme} 
          whileHover={{ scale: 1.05 }}
          className={`mt-6 text-[10px] font-mono opacity-50 ${theme.text2} hover:opacity-100 transition-opacity`}
        >
          [{theme.id.toUpperCase()}] СМЕНИТЬ РЕЖИМ
        </motion.button>
      </motion.div>
    </div>
  );
};

const DashboardView = ({ theme, t, onNavigate }: any) => {
  // Real data from API
  const [metrics, setMetrics] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [p2pStatus, setP2pStatus] = useState<any>(null);
  const [pqcStatus, setPqcStatus] = useState<any>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [detailedPanel, setDetailedPanel] = useState<{ type: string; open: boolean }>({ type: '', open: false });
  const [detailedMetrics, setDetailedMetrics] = useState<any>(null);

  // P2P client
  const p2pClient = useP2P();

  // Fetch all system data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [metricsData, healthData, p2pData, pqcData, statusData, storageData, aiData] = await Promise.all([
        fetchMetrics().catch(() => null),
        fetchHealthStatus().catch(() => null),
        fetchP2PStatus().catch(() => null),
        fetchPQCStatus().catch(() => null),
        fetchSystemStatus().catch(() => null),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/storage/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/ai/status`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (metricsData) setMetrics(metricsData);
      if (healthData) setHealthStatus(healthData);
      if (p2pData) setP2pStatus(p2pData);
      if (pqcData) setPqcStatus(pqcData);
      if (statusData) setSystemStatus(statusData);
      if (storageData) setStorageStats(storageData);
      if (aiData) setAiStatus(aiData);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed metrics when panel is open
  const fetchDetailedMetrics = useCallback(async () => {
    if (!detailedPanel.open) {
      return;
    }
    
    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/metrics/detailed`;
      console.log('📡 Fetching detailed metrics from:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Detailed metrics received:', { 
          hasMemory: !!data.memory, 
          hasCpu: !!data.cpu,
          hasThreads: !!data.threads,
          timestamp: data.timestamp 
        });
        setDetailedMetrics(data);
      } else {
        console.error('❌ Failed to fetch detailed metrics:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Error fetching detailed metrics:', error);
    }
  }, [detailedPanel.open]);

  // Initial fetch and polling
  useEffect(() => {
    fetchDashboardData();
    
    // Poll every 3 seconds for real-time updates
    const interval = setInterval(fetchDashboardData, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Poll detailed metrics when panel is open
  useEffect(() => {
    if (detailedPanel.open) {
      console.log('Panel opened, fetching detailed metrics...', detailedPanel.type);
      // Fetch immediately
      fetchDetailedMetrics();
      // Then poll every second
      const interval = setInterval(() => {
        fetchDetailedMetrics();
      }, 1000); // Update every second for real-time
      return () => {
        console.log('Cleaning up detailed metrics interval');
        clearInterval(interval);
      };
    } else {
      // Clear metrics when panel closes
      setDetailedMetrics(null);
    }
  }, [detailedPanel.open, detailedPanel.type]);

  // Calculate real stats from API data
  const calculateStats = () => {
    // Active threads/sessions (from metrics)
    const activeThreads = metrics?.threads?.active || healthStatus?.components?.signaling?.connections || p2pClient.peers.length || 0;
    const maxThreads = metrics?.threads?.max || 10;
    
    // Memory usage (from metrics) - metrics.memory can be number or object
    const memoryUsage = typeof metrics?.memory === 'object' ? (metrics.memory.usage || 0) : (metrics?.memory || 0);
    const memoryTotalBytes = typeof metrics?.memory === 'object' ? (metrics.memory.total || 8 * 1024 * 1024 * 1024) : (8 * 1024 * 1024 * 1024);
    const memoryUsedBytes = typeof metrics?.memory === 'object' ? (metrics.memory.used || (memoryTotalBytes * memoryUsage / 100)) : (memoryTotalBytes * memoryUsage / 100);
    const memoryTotal = memoryTotalBytes / (1024 * 1024 * 1024); // Convert to GB
    const memoryUsed = memoryUsedBytes / (1024 * 1024 * 1024); // Convert to GB
    
    // Storage (from storage stats)
    const storageUsedGB = storageStats?.local?.used ? (storageStats.local.used / 1024 / 1024 / 1024).toFixed(1) : '0.0';
    const storageTotalGB = storageStats?.local?.total ? (storageStats.local.total / 1024 / 1024 / 1024).toFixed(0) : '64';
    const storageProgress = storageStats?.local?.used && storageStats?.local?.total 
      ? (storageStats.local.used / storageStats.local.total) * 100 
      : 0;
    
    // Network/P2P (from P2P status or health)
    const p2pPeers = p2pStatus?.connected || p2pClient.peers.length || healthStatus?.components?.signaling?.peers || 0;
    const p2pTotal = p2pStatus?.total || healthStatus?.components?.dht?.nodes || 0;
    const latency = '23ms'; // TODO: calculate from actual peer latency

    return [
      { 
        label: t('dashboard.active'), 
        value: activeThreads, 
        icon: Icon.Activity, 
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        trend: activeThreads > 5 ? '+12%' : '+3%',
        trendUp: true,
        subtitle: 'Активные потоки',
        detail: `${activeThreads} из ${maxThreads} слотов`
      },
      { 
        label: t('dashboard.memory'), 
        value: `${Math.round(memoryUsage)}%`, 
        icon: Icon.Brain, 
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        trend: memoryUsage > 70 ? '+2%' : '-3%',
        trendUp: memoryUsage > 70,
        subtitle: 'Использование RAM',
        detail: `${typeof memoryUsed === 'number' ? memoryUsed.toFixed(1) : '0.0'} / ${memoryTotal.toFixed(1)} GB`,
        progress: memoryUsage
      },
      { 
        label: t('dashboard.storage'), 
        value: `${storageUsedGB}GB`, 
        icon: Icon.Database, 
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        trend: '+0.2GB',
        trendUp: true,
        subtitle: 'Локальное хранилище',
        detail: `${storageUsedGB} / ${storageTotalGB} GB`,
        progress: storageProgress
      },
      { 
        label: t('dashboard.network'), 
        value: p2pPeers, 
        icon: Icon.Network, 
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        trend: `+${Math.max(0, p2pTotal - p2pPeers)}`,
        trendUp: true,
        subtitle: 'P2P узлы',
        detail: `${p2pPeers} подключено`,
        latency: latency
      }
    ];
  };

  const stats = calculateStats();
  
  return (
    <div className={`p-6 pt-24 h-full pb-32 overflow-y-auto no-scrollbar animate-enter ${theme.bg}`}>
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="mb-6"
      >
        <h1 className={`text-3xl font-black ${theme.text} font-orbitron mb-2`}>
          {t('dashboard.title')}
        </h1>
        <p className={`text-xs font-mono ${theme.text2} opacity-70`}>
          Последнее обновление: {lastUpdate.toLocaleTimeString('ru-RU')}
          {loading && <span className="ml-2 animate-pulse">⟳</span>}
        </p>
      </motion.div>
      
      <div className="flex gap-3 mb-6 flex-wrap">
        <StatusIndicator 
          status={systemStatus?.crdt?.synced ? 'online' : 'processing'} 
          theme={theme} 
          label={`CRDT:${systemStatus?.crdt?.synced ? 'ON' : 'SYNC'}`} 
        />
        <StatusIndicator 
          status={p2pClient.connected || (p2pStatus?.connected && p2pStatus.connected > 0) ? 'online' : 'offline'} 
          theme={theme} 
          label={`P2P:${p2pStatus?.connected || p2pClient.peers.length || 0}`} 
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`px-3 py-1.5 rounded-full border ${theme.glass} ${theme.border} flex items-center gap-2`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${systemStatus?.sync === 'SYNCED' ? 'bg-emerald-400' : 'bg-yellow-400'} animate-pulse`} />
          <span className={`text-[10px] font-mono font-bold ${theme.text}`}>
            SYNC:{systemStatus?.sync === 'SYNCED' ? 'OK' : systemStatus?.sync || 'SYNC'}
          </span>
        </motion.div>
      </div>
      
      {/* Единая системная панель - объединяет все 4 метрики */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className={`p-6 rounded-2xl border ${theme.glass} ${theme.border} mb-6 relative overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-emerald-500/20 text-emerald-400`}>
              <Icon.Activity size={24} />
            </div>
            <div>
              <h2 className={`text-lg font-black ${theme.text} font-orbitron`}>
                Системные метрики
              </h2>
              <p className={`text-xs font-mono ${theme.text2} opacity-70`}>
                Мониторинг производительности в реальном времени
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setDetailedPanel({ type: 'memory', open: true })}
            className={`px-4 py-2 rounded-xl border ${theme.border} ${theme.glass} hover:bg-white/5 transition-colors`}
          >
            <span className={`text-xs font-bold ${theme.text}`}>Подробнее</span>
          </motion.button>
        </div>

        {/* Grid с 4 метриками */}
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              role="button"
              tabIndex={0}
              aria-label={`${stat.label}: ${stat.value}. Нажмите для подробностей`}
              className={`p-4 rounded-xl border border-white/5 bg-black/20 relative overflow-hidden group cursor-pointer hover:border-white/10 transition-all`}
              onClick={() => {
                console.log('📊 Card clicked:', stat.label);
                if (stat.label === t('dashboard.network')) {
                  setDetailedPanel({ type: 'network', open: true });
                } else if (stat.label === t('dashboard.storage')) {
                  setDetailedPanel({ type: 'storage', open: true });
                } else if (stat.label === t('dashboard.memory')) {
                  setDetailedPanel({ type: 'memory', open: true });
                } else if (stat.label === t('dashboard.active')) {
                  setDetailedPanel({ type: 'threads', open: true });
                }
              }}
            >
              {/* Background gradient effect */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${stat.bgColor}`} />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-xl ${stat.bgColor} ${stat.color}`}>
                    <stat.icon size={18} />
                  </div>
                  {stat.trend && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className={`flex items-center gap-1 text-[10px] font-bold ${
                        stat.trendUp ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {stat.trendUp ? <Icon.ArrowUp size={12} /> : <Icon.ArrowDown size={12} />}
                      <span>{stat.trend}</span>
                    </motion.div>
                  )}
                </div>
                
                <div className={`text-2xl font-black ${theme.text} mb-1`}>
                  {stat.value}
                  {stat.latency && (
                    <span className={`text-xs font-normal ml-2 ${theme.text2}`}>
                      ({stat.latency})
                    </span>
                  )}
                </div>
                
                <div className={`text-[10px] font-mono ${theme.text2} mb-2`}>
                  {stat.label}
                </div>
                
                {stat.subtitle && (
                  <div className={`text-[9px] font-mono ${theme.text2} opacity-60 mb-2`}>
                    {stat.subtitle}
                  </div>
                )}
                
                {stat.detail && (
                  <div className={`text-[9px] font-mono ${theme.text2} opacity-50`}>
                    {stat.detail}
                  </div>
                )}
                
                {/* Progress bar for memory and storage */}
                {stat.progress !== undefined && (
                  <div className="mt-3 h-1 rounded-full overflow-hidden bg-black/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.progress}%` }}
                      transition={{ duration: 1.5, delay: i * 0.1 }}
                      className={`h-full rounded-full ${
                        stat.progress > 80 ? 'bg-red-400' : 
                        stat.progress > 60 ? 'bg-yellow-400' : 
                        stat.color.replace('text-', 'bg-')
                      }`}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* 3 карточки для доработки - оставляю пустые плейсхолдеры */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className={`p-6 rounded-2xl border border-dashed ${theme.border} ${theme.glass} relative overflow-hidden`}
          >
            <div className="flex flex-col items-center justify-center h-32">
              <div className={`p-3 rounded-xl bg-white/5 mb-3`}>
                <Icon.Plus size={24} className={theme.text2} />
              </div>
              <div className={`text-sm font-bold ${theme.text2} opacity-50`}>
                Карточка {i} - для доработки
              </div>
              <div className={`text-xs font-mono ${theme.text2} opacity-30 mt-1`}>
                Плейсхолдер
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Quick Actions Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-6"
      >
        <h2 className={`text-sm font-bold ${theme.text} mb-3 flex items-center gap-2`}>
          <Icon.Bolt size={16} />
          Быстрые действия
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { view: 'ai-core', name: t('nav.ai'), icon: Icon.Brain, desc: 'Локальный ИИ' },
            { view: 'economy', name: t('nav.economy'), icon: Icon.Coins, desc: 'Экономика' },
            { view: 'reputation', name: t('profile.reputation'), icon: Icon.ShieldCheck, desc: 'Репутация' },
            { view: 'mini-apps', name: t('mini_apps.title'), icon: Icon.Grid3x3, desc: 'Приложения' }
          ].map((item, i) => (
            <motion.button
              key={item.view}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.05 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate(item.view)}
              className={`p-4 rounded-2xl border ${theme.glass} ${theme.border} text-left group relative overflow-hidden`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <item.icon size={24} className={`mb-2 ${theme.text} group-hover:scale-110 transition-transform`} />
                <div className={`font-bold text-sm ${theme.text} mb-1`}>{item.name}</div>
                <div className={`text-[10px] font-mono ${theme.text2} opacity-70`}>{item.desc}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
      
      {/* System Health Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-bold ${theme.text} flex items-center gap-2`}>
            <Icon.Activity size={16} />
            Состояние системы
          </h3>
          <div className={`text-xs font-mono ${theme.text2} opacity-70`}>
            {healthStatus?.status === 'ok' ? 'Все системы в норме' : 'Проверка систем...'}
          </div>
        </div>
        
        <div className="space-y-2">
          {[
            { 
              label: 'Шифрование PQC', 
              status: pqcStatus?.initialized ? 'active' : 'inactive', 
              value: pqcStatus?.algorithm || 'N/A'
            },
            { 
              label: 'Локальный ИИ', 
              status: aiStatus?.loaded ? 'active' : 'inactive', 
              value: aiStatus?.models ? `${aiStatus.models} моделей загружено` : 'Не загружено'
            },
            { 
              label: 'P2P Сеть', 
              status: (p2pStatus?.connected && p2pStatus.connected > 0) || p2pClient.peers.length > 0 ? 'active' : 'inactive', 
              value: `${p2pStatus?.connected || p2pClient.peers.length || 0} узлов, ${healthStatus?.components?.dht?.nodes || 0} в DHT`
            },
            { 
              label: 'Хранилище', 
              status: storageStats ? 'active' : 'inactive', 
              value: storageStats ? 'Индексировано' : 'Не доступно'
            }
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.05 }}
              className="flex items-center justify-between py-1.5"
            >
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  item.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                }`} />
                <span className={`text-[10px] font-mono ${theme.text2}`}>{item.label}</span>
              </div>
              <span className={`text-[9px] font-mono ${theme.text2} opacity-60`}>
                {item.value}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Detailed Panel Modal - всегда рендерится, но условно видим */}
      {detailedPanel.open && (
        <DetailedMetricsPanel
          key={`panel-${detailedPanel.type}`}
          type={detailedPanel.type}
          data={detailedMetrics}
          theme={theme}
          onClose={() => {
            console.log('🔴 Closing panel...');
            setDetailedPanel({ type: '', open: false });
            setDetailedMetrics(null);
          }}
        />
      )}
    </div>
  );
};

const ChatsListView = ({ theme, t, onSelectChat }: any) => {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  type ApiResponse<T> = { success: boolean; data?: T; error?: string; timestamp: string };
  type ChatItem = {
    id: string;
    name: string;
    type: 'all' | 'personal' | 'secret' | 'ether' | 'ai';
    lastMessage?: string;
    lastMessageTime?: string;
    unread: number;
    encrypted: boolean;
    avatar?: string;
    online?: boolean;
    pinned?: boolean;
  };

  // Fallback чаты которые всегда доступны
  const FALLBACK_CHATS: ChatItem[] = [
    {
      id: 'presidium-ai',
      name: 'Presidium AI',
      type: 'ai',
      lastMessage: 'Привет, Командир. Системы в норме. Готов к работе.',
      lastMessageTime: new Date().toISOString(),
      unread: 1,
      encrypted: true,
      avatar: 'AI',
      online: true,
      pinned: true
    },
    {
      id: 'scam-warning',
      name: '⚠️ МОШЕННИЧЕСТВО',
      type: 'secret',
      lastMessage: '[ЗАБЛОКИРОВАНО] Попытка фишинга обнаружена и заблокирована локальным ИИ.',
      lastMessageTime: new Date(Date.now() - 3600000 * 3).toISOString(),
      unread: 1,
      encrypted: true,
      avatar: '!',
      online: false,
      pinned: false
    },
    {
      id: 'p2p-sync',
      name: 'КБ "Горизонт-7"',
      type: 'ether',
      lastMessage: 'Протокол P2P синхронизации CRDT успешно применен.',
      lastMessageTime: new Date(Date.now() - 86400000).toISOString(),
      unread: 0,
      encrypted: true,
      avatar: 'КБ',
      online: true,
      pinned: false
    },
    {
      id: 'alice-contact',
      name: 'Алиса Орлова',
      type: 'personal',
      lastMessage: 'Привет! Как дела с проектом?',
      lastMessageTime: new Date(Date.now() - 7200000).toISOString(),
      unread: 2,
      encrypted: true,
      avatar: 'АО',
      online: true,
      pinned: false
    },
    {
      id: 'team-channel',
      name: 'Команда разработки',
      type: 'ether',
      lastMessage: 'Деплой прошел успешно ✅',
      lastMessageTime: new Date(Date.now() - 1800000).toISOString(),
      unread: 5,
      encrypted: true,
      avatar: 'КР',
      online: true,
      pinned: true
    }
  ];

  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [chats, setChats] = useState<ChatItem[]>(FALLBACK_CHATS);
  const [loading, setLoading] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactMessage, setNewContactMessage] = useState('');
  const [newContactType, setNewContactType] = useState<'personal' | 'secret' | 'ether'>('personal');
  const [newContactEncrypted, setNewContactEncrypted] = useState(true);
  const [creating, setCreating] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);

  const fetchChats = useCallback(async (search?: string) => {
    try {
      const url = search
        ? `${API_BASE_URL}/api/chats/search?q=${encodeURIComponent(search)}`
        : `${API_BASE_URL}/api/chats${filter !== 'all' ? `?filter=${filter}` : ''}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error('Failed to fetch chats');
      const payload: ApiResponse<ChatItem[]> = await response.json();
      setApiOnline(true);
      return payload.data || [];
    } catch {
      setApiOnline(false);
      return null; // Return null to indicate failure
    }
  }, [API_BASE_URL, filter]);

  const createChat = useCallback(async (name: string): Promise<ChatItem> => {
    // Try API first
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: newContactType, encrypted: newContactEncrypted }),
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const payload: ApiResponse<ChatItem> = await response.json();
        if (payload.data) return payload.data;
      }
    } catch {
      // Fallback to local
    }
    // Create locally
    const newChat: ChatItem = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      type: newContactType,
      unread: 0,
      encrypted: newContactEncrypted,
      lastMessageTime: new Date().toISOString(),
      avatar: name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
      online: false,
      pinned: false
    };
    return newChat;
  }, [API_BASE_URL, newContactEncrypted, newContactType]);

  const sendInitialMessage = useCallback(async (chatId: string, text: string) => {
    if (!text.trim()) return;
    try {
      await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sender: 'user',
          senderType: 'user',
          encrypted: newContactEncrypted,
          filter: newContactType
        }),
        signal: AbortSignal.timeout(3000)
      });
    } catch {
      // Message will be stored locally
    }
  }, [API_BASE_URL, newContactEncrypted, newContactType]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchChats(query.trim() || undefined)
      .then((data) => {
        if (active) {
          if (data && data.length > 0) {
            setChats(data);
          } else if (!query.trim()) {
            // Use fallback if API returns empty or fails
            setChats(FALLBACK_CHATS);
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchChats, query]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchChats(query.trim() || undefined)
        .then((data) => {
          if (data && data.length > 0) {
            setChats(data);
          }
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchChats, query]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      const apiUrl = new URL(API_BASE_URL);
      const wsOrigin = apiUrl.origin.replace('https://', 'wss://').replace('http://', 'ws://');
      ws = new WebSocket(`${wsOrigin}/ws`);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type !== 'chat-message') return;
          const data = payload.data as { chatId: string; text: string; timestamp: string };
          setChats((prev) =>
            prev.map((chat) =>
              chat.id === data.chatId
                ? {
                    ...chat,
                    lastMessage: data.text,
                    lastMessageTime: data.timestamp,
                    unread: chat.unread + 1
                  }
                : chat
            )
          );
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
    return () => {
      if (ws) ws.close();
    };
  }, [API_BASE_URL]);

  const getChatAvatar = (chat: ChatItem) => {
    if (chat.avatar) return chat.avatar;
    if (chat.id === 'presidium-ai' || chat.type === 'ai') return 'AI';
    if (chat.id === 'scam-warning') return '!';
    return chat.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '•';
  };

  const getChatTime = (chat: ChatItem) => {
    if (!chat.lastMessageTime) return '';
    const date = new Date(chat.lastMessageTime);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 86400000 * 7) {
      return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const filteredChats = useMemo(() => {
    let result = [...chats];
    if (filter !== 'all') {
      result = result.filter(c => c.type === filter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.lastMessage?.toLowerCase().includes(q)
      );
    }
    // Sort: pinned first, then by time
    return result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });
  }, [chats, filter, query]);
  
  return (
    <div className={`flex-1 flex flex-col pt-4 h-full relative animate-enter ${theme.bg}`}>
      {/* Header */}
      <div className="px-4 mb-4 flex justify-between items-center">
        <h2 className={`text-xl font-bold ${theme.text}`}>{t('chats.title')}</h2>
        <div className="flex items-center gap-3">
{/* FAB moved to bottom right */}
          <div className="flex items-center gap-2">
            <StatusIndicator status={apiOnline ? "online" : "offline"} theme={theme} label={apiOnline ? "API" : "LOCAL"} />
        <StatusIndicator status="online" theme={theme} label="P2P:12" />
          </div>
        </div>
      </div>
      
      {/* Search */}
      <div className="px-4 mb-4">
        <div className={`rounded-2xl flex items-center px-4 py-3 gap-3 ${theme.input} border ${theme.border} focus-within:border-emerald-500/50 transition-colors`}>
          <Icon.Search size={18} className={theme.text2} />
          <input 
            placeholder={t('chats.search')} 
            className={`bg-transparent w-full text-sm outline-none ${theme.text}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className={theme.text2}>
              <Icon.X size={16} />
            </button>
          )}
        </div>
      </div>
      
      {/* Filters */}
      <div className="px-4 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
        {Object.keys(t('chats.folders')).map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)} 
            className={`whitespace-nowrap text-xs font-bold px-4 py-2 rounded-full transition-all ${
              filter === f 
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30' 
                : `${theme.glass} ${theme.text2} border ${theme.border}`
            }`}
          >
            {t(`chats.folders.${f}`)}
          </button>
        ))}
      </div>
      
      {/* Chats List */}
      <div className="flex-1 overflow-y-auto px-2 pb-24 no-scrollbar space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        )}
        {!loading && filteredChats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Icon.MessageSquare size={48} className={theme.text2} />
            <p className={`mt-4 text-sm ${theme.text2}`}>Нет чатов</p>
            <button 
              onClick={() => setShowNewContact(true)}
              className="mt-4 text-xs text-emerald-500 underline"
            >
              Начать новый чат
            </button>
          </div>
        )}
        {!loading && filteredChats.map((chat: ChatItem, i: number) => (
          <motion.div
            key={chat.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectChat(chat)}
            className={`p-4 rounded-[20px] flex items-center gap-4 cursor-pointer border relative overflow-hidden ${
              chat.id === 'scam-warning' ? 'border-red-500/40 bg-red-500/5' 
              : chat.encrypted ? 'border-emerald-500/30' 
              : theme.border
            } ${theme.glass} ${theme.glassHover} hover:border-emerald-500/50 transition-all`}
          >
            {/* Pinned indicator */}
            {chat.pinned && (
              <div className="absolute top-2 right-2">
                <Icon.Pin size={10} className="text-emerald-500" />
              </div>
            )}
            {/* Avatar */}
            <div className="relative">
              <div className={`w-12 h-12 rounded-full grid place-items-center font-bold text-sm ${
                chat.id === 'scam-warning' ? 'bg-gradient-to-br from-red-500 to-orange-600 text-white' 
                : chat.type === 'ai' ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                : chat.encrypted ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-black' 
                : theme.accent + ' ' + theme.accentText
              }`}>
                {getChatAvatar(chat)}
            </div>
              {/* Online indicator */}
              {chat.online && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
              )}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2 min-w-0">
                <span className={`font-bold text-sm ${theme.text} truncate`}>{chat.name}</span>
                  {chat.encrypted && <Icon.Lock size={10} className="text-emerald-500 flex-shrink-0" />}
              </div>
                <span className={`text-[10px] font-mono ${theme.text2} flex-shrink-0 ml-2`}>{getChatTime(chat)}</span>
            </div>
              <p className={`text-xs ${theme.text2} truncate`}>{chat.lastMessage || 'Нет сообщений'}</p>
              </div>
            {/* Unread badge */}
            {chat.unread > 0 && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
              >
                {chat.unread > 99 ? '99+' : chat.unread}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
      
      {/* Floating Action Button - positioned above dock */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowNewContact(true)}
        className="absolute bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black shadow-lg shadow-emerald-500/40 flex items-center justify-center"
      >
        <Icon.Plus size={20} strokeWidth={3} />
      </motion.button>

      {/* New Contact Modal */}
      <AnimatePresence>
        {showNewContact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowNewContact(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-3xl border ${theme.glass} ${theme.border} overflow-hidden shadow-2xl`}
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-bold ${theme.text}`}>Новое сообщение</h3>
                    <p className={`text-xs mt-1 ${theme.text2}`}>Создайте контакт и начните общение</p>
                  </div>
                  <button 
                    onClick={() => setShowNewContact(false)}
                    className={`p-2 rounded-full ${theme.glass} ${theme.border}`}
                  >
                    <Icon.X size={16} className={theme.text2} />
                  </button>
                </div>
              </div>
              
              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Contact Name */}
                <div>
                  <label className={`text-xs font-medium ${theme.text2} mb-2 block`}>Имя контакта</label>
                  <div className={`rounded-xl flex items-center px-4 py-3 gap-3 ${theme.input} border ${theme.border} focus-within:border-emerald-500/50 transition-colors`}>
                    <Icon.User size={16} className={theme.text2} />
                    <input
                      className={`bg-transparent w-full text-sm outline-none ${theme.text}`}
                      placeholder="Введите имя или никнейм"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                    />
                  </div>
                </div>
                
                {/* First Message */}
                <div>
                  <label className={`text-xs font-medium ${theme.text2} mb-2 block`}>Первое сообщение</label>
                  <div className={`rounded-xl ${theme.input} border ${theme.border} focus-within:border-emerald-500/50 transition-colors overflow-hidden`}>
                    <textarea
                      className={`bg-transparent w-full text-sm outline-none p-4 resize-none ${theme.text}`}
                      placeholder="Привет! Давай общаться..."
                      rows={3}
                      value={newContactMessage}
                      onChange={(e) => setNewContactMessage(e.target.value)}
                    />
                  </div>
                </div>
                
                {/* Chat Type */}
                <div>
                  <label className={`text-xs font-medium ${theme.text2} mb-2 block`}>Тип чата</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { type: 'personal', icon: Icon.User, label: 'Личный' },
                      { type: 'secret', icon: Icon.Lock, label: 'Секретный' },
                      { type: 'ether', icon: Icon.Globe, label: 'P2P' }
                    ].map(({ type, icon: TypeIcon, label }) => (
                      <button
                        key={type}
                        onClick={() => setNewContactType(type as 'personal' | 'secret' | 'ether')}
                        className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border transition-all ${
                          newContactType === type 
                            ? 'bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/30' 
                            : `${theme.glass} ${theme.border} ${theme.text2}`
                        }`}
                      >
                        <TypeIcon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Encryption Toggle */}
                <div className={`rounded-xl p-4 ${theme.glass} border ${theme.border}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${newContactEncrypted ? 'bg-emerald-500/20' : 'bg-gray-500/20'}`}>
                        {newContactEncrypted ? <Icon.Shield size={16} className="text-emerald-500" /> : <Icon.ShieldOff size={16} className={theme.text2} />}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${theme.text}`}>
                          {newContactEncrypted ? 'PQC Шифрование' : 'Без шифрования'}
                        </p>
                        <p className={`text-xs ${theme.text2}`}>
                          {newContactEncrypted ? 'Kyber-1024 + Dilithium-5' : 'Сообщения не защищены'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setNewContactEncrypted((prev) => !prev)}
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        newContactEncrypted ? 'bg-emerald-500' : 'bg-gray-600'
                      }`}
                    >
                      <motion.div
                        animate={{ x: newContactEncrypted ? 24 : 2 }}
                        className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow"
                      />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowNewContact(false);
                    setNewContactName('');
                    setNewContactMessage('');
                  }}
                  className={`text-sm px-6 py-2.5 rounded-xl border ${theme.border} ${theme.text2} hover:bg-white/5 transition-colors`}
                >
                  Отмена
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={creating || !newContactName.trim()}
                  onClick={async () => {
                    try {
                      setCreating(true);
                      const created = await createChat(newContactName.trim());
                      // Update with message if provided
                      if (newContactMessage.trim()) {
                        await sendInitialMessage(created.id, newContactMessage.trim());
                        created.lastMessage = newContactMessage.trim();
                        created.lastMessageTime = new Date().toISOString();
                      }
                      setChats((prev) => [{ ...created, online: false }, ...prev]);
                      setShowNewContact(false);
                      setNewContactName('');
                      setNewContactMessage('');
                      onSelectChat(created);
                    } catch (error) {
                      console.error('Failed to create chat', error);
                    } finally {
                      setCreating(false);
                    }
                  }}
                  className={`text-sm px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 ${
                    !newContactName.trim() 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-black shadow-lg shadow-emerald-500/30'
                  }`}
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Создание...
                    </>
                  ) : (
                    <>
                      <Icon.Send size={14} />
                      Начать чат
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ChatDetailView = ({ chat, onBack, theme, t }: any) => {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  type ApiResponse<T> = { success: boolean; data?: T; error?: string; timestamp: string };
  type ChatMessage = {
    id: string;
    chatId: string;
    text: string;
    sender: string;
    senderType: 'user' | 'ai' | 'system';
    timestamp: string;
    encrypted: boolean;
    filter: string;
  };
  type UiMessage = { id: string; sender: 'me' | 'ai' | 'them'; text: string; time: string };

  const [msgs, setMsgs] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [showScam, setShowScam] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [aiSummary, setAiSummary] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, 'SENT' | 'DELIVERED' | 'READ'>>({});
  const p2pClient = useP2P();
  const privacyGuard = useMemo(() => PrivacyGuard.getInstance(), []);

  const chatAvatar = useMemo(() => {
    if (chat.id === 'presidium-ai' || chat.type === 'ai') return 'AI';
    if (chat.id === 'scam-warning') return '!';
    return chat.name?.[0]?.toUpperCase() || '•';
  }, [chat.id, chat.name, chat.type]);

  const mapChatMessage = (message: ChatMessage): UiMessage => {
    const timestamp = new Date(message.timestamp);
    return {
      id: message.id,
      sender: message.senderType === 'user' ? 'me' : message.senderType === 'ai' ? 'ai' : 'them',
      text: message.text,
      time: timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      
    };
  };

  // Fallback messages for demo chats
  const FALLBACK_MESSAGES: Record<string, UiMessage[]> = useMemo(() => ({
    'presidium-ai': [
      { id: 'ai-1', sender: 'ai', text: '👋 Привет, Командир! Я Presidium AI — твой личный ассистент.', time: '09:00' },
      { id: 'ai-2', sender: 'ai', text: '🔒 Все системы работают в штатном режиме. PQC шифрование активно.', time: '09:01' },
      { id: 'ai-3', sender: 'ai', text: '📊 Сводка: 12 активных P2P узлов, 0 угроз обнаружено, синхронизация 100%.', time: '09:02' },
      { id: 'ai-4', sender: 'me', text: 'Проверь безопасность сети', time: '09:05' },
      { id: 'ai-5', sender: 'ai', text: '✅ Проверка завершена:\n• Firewall: Активен\n• PQC: Kyber-1024 + Dilithium-5\n• P2P: 12/12 узлов онлайн\n• Угрозы: Не обнаружено', time: '09:06' },
    ],
    'scam-warning': [
      { id: 'scam-1', sender: 'them', text: '🚨 ВНИМАНИЕ! Обнаружена попытка фишинга.', time: '14:22' },
      { id: 'scam-2', sender: 'ai', text: '⚠️ Локальный ИИ заблокировал подозрительное сообщение:\n\n"Срочно! Ваш аккаунт заблокирован. Перейдите по ссылке..."\n\nПричина: Фишинговая атака (99.7% уверенность)', time: '14:23' },
      { id: 'scam-3', sender: 'ai', text: '🛡️ Отправитель добавлен в черный список. IP заблокирован.', time: '14:23' },
    ],
    'p2p-sync': [
      { id: 'p2p-1', sender: 'them', text: '🔗 КБ "Горизонт-7" подключен к P2P сети', time: '10:30' },
      { id: 'p2p-2', sender: 'me', text: 'Привет! Проверка связи через P2P протокол', time: '10:32' },
      { id: 'p2p-3', sender: 'them', text: '✅ Связь установлена. CRDT синхронизация активна.\n\n📡 Latency: 45ms\n🔒 Шифрование: PQC Kyber-1024\n📶 Качество: Отличное', time: '10:33' },
      { id: 'p2p-4', sender: 'me', text: 'Отправь тестовые данные', time: '10:35' },
      { id: 'p2p-5', sender: 'them', text: '📦 Тестовый пакет отправлен (256 байт)\n⏱️ RTT: 89ms\n✅ Целостность: Проверена', time: '10:36' },
    ],
    'alice-contact': [
      { id: 'alice-1', sender: 'them', text: 'Привет! Как дела с проектом?', time: '15:20' },
      { id: 'alice-2', sender: 'me', text: 'Привет! Все отлично, заканчиваю интеграцию P2P модуля', time: '15:22' },
      { id: 'alice-3', sender: 'them', text: 'Круто! Когда можно будет протестировать?', time: '15:23' },
      { id: 'alice-4', sender: 'me', text: 'Думаю, к вечеру будет готово. Скину ссылку', time: '15:25' },
      { id: 'alice-5', sender: 'them', text: '👍 Жду!', time: '15:26' },
    ],
    'team-channel': [
      { id: 'team-1', sender: 'them', text: '🚀 @all Деплой v0.0.1 запущен', time: '16:00' },
      { id: 'team-2', sender: 'them', text: '⏳ Сборка frontend...', time: '16:01' },
      { id: 'team-3', sender: 'them', text: '⏳ Сборка backend...', time: '16:02' },
      { id: 'team-4', sender: 'them', text: '✅ Деплой прошел успешно', time: '16:05' },
      { id: 'team-5', sender: 'me', text: 'Отлично! Проверил — всё работает 🎉', time: '16:10' },
    ],
  }), []);

  const loadMessages = useCallback(async () => {
      setIsLoadingHistory(true);
      try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${chat.id}/messages?limit=100`, {
        signal: AbortSignal.timeout(3000)
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const payload: ApiResponse<ChatMessage[]> = await response.json();
      const list = payload.data || [];
      if (list.length > 0) {
        setMsgs(list.map(mapChatMessage));
        } else {
        // Use fallback if API returns empty
        setMsgs(FALLBACK_MESSAGES[chat.id] || []);
        }
      } catch (error) {
      console.error('Failed to load chat messages:', error);
      // Use fallback messages when API fails
      setMsgs(FALLBACK_MESSAGES[chat.id] || []);
      } finally {
        setIsLoadingHistory(false);
      }
  }, [API_BASE_URL, chat.id, FALLBACK_MESSAGES]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const updateAiAssist = useCallback(async (list: UiMessage[]) => {
    if (!list.length) {
      setAiSummary('Нет данных для анализа');
      setAiSuggestions([]);
      return;
    }

    const summarySource = list.slice(-3).map((msg) => `${msg.sender === 'me' ? 'Вы' : msg.sender === 'ai' ? 'AI' : 'Собеседник'}: ${msg.text}`).join(' | ');
    setAiSummary(summarySource.slice(0, 220));

    const lastMessage = list[list.length - 1]?.text || '';
    const suggestions = await assistantService.getSmartSuggestions(lastMessage);
    setAiSuggestions(suggestions);
  }, []);

  useEffect(() => {
    if (chat.type === 'ai') {
      updateAiAssist(msgs).catch(() => {
        setAiSummary('AI анализ недоступен');
        setAiSuggestions([]);
      });
    }
  }, [chat.type, msgs, updateAiAssist]);

  const buildWsUrl = () => {
    try {
      const apiUrl = new URL(API_BASE_URL);
      const wsOrigin = apiUrl.origin.replace('https://', 'wss://').replace('http://', 'ws://');
      return `${wsOrigin}/ws`;
    } catch {
      const fallback = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      return `${fallback}/ws`;
    }
  };

  useEffect(() => {
    const ws = new WebSocket(buildWsUrl());
    ws.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type !== 'chat-message') return;
        const data: ChatMessage = payload.data;
        if (!data?.text) return;
        const isSpam = await assistantService.shouldFilter(data.text);
        if (isSpam) {
          if (chat.id === 'scam-warning') {
            const flagged = { ...data, chatId: 'scam-warning' };
            setMsgs((prev) => [...prev, mapChatMessage(flagged)]);
    } else {
            setShowScam(true);
            setTimeout(() => setShowScam(false), 4000);
          }
          return;
        }
        if (data.chatId !== chat.id) return;
        setMsgs((prev) => [...prev, mapChatMessage(data)]);
      } catch {
        // ignore
      }
    };
    return () => {
      ws.close();
    };
  }, [API_BASE_URL, chat.id]);

  useEffect(() => {
    if (!p2pClient.peer) return;
    const unsubscribe = p2pClient.peer.onMessage(async (message) => {
      if (message.type !== 'message' || !message.payload?.text) return;
      const incoming: ChatMessage = {
        id: message.id,
        chatId: 'p2p-sync',
        text: message.payload.text,
        sender: message.from,
        senderType: 'system',
        timestamp: new Date(message.timestamp).toISOString(),
        encrypted: message.encrypted,
        filter: 'ether'
      };
      const isSpam = await assistantService.shouldFilter(incoming.text);
      if (isSpam) {
        if (chat.id === 'scam-warning') {
          setMsgs((prev) => [...prev, mapChatMessage({ ...incoming, chatId: 'scam-warning' })]);
        } else {
          setShowScam(true);
          setTimeout(() => setShowScam(false), 4000);
        }
        return;
      }
      if (incoming.chatId === chat.id) {
        setMsgs((prev) => [...prev, mapChatMessage(incoming)]);
      }
    });
    return () => unsubscribe();
  }, [p2pClient.peer, chat.id]);
  
  const postMessage = useCallback(async (text: string): Promise<ChatMessage | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${chat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sender: 'user',
          senderType: 'user',
          encrypted: true,
          filter: chat.type || 'all'
        }),
        signal: AbortSignal.timeout(3000)
      });
      if (!response.ok) return null;
      const payload: ApiResponse<ChatMessage> = await response.json();
      return payload.data || null;
    } catch {
      return null; // Local mode
    }
  }, [API_BASE_URL, chat.id, chat.type]);

  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText ?? input).trim();
    if (!textToSend) return;
    
    const scan = await privacyGuard.scanContent(textToSend);
    
    if (!scan.allowed) {
      setShowScam(true);
      setTimeout(() => setShowScam(false), 4000);
      setInput('');
      return;
    }
    
    const userMessageText = textToSend;
    const currentTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const tempId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    const optimisticUserMsg: UiMessage = {
      id: tempId,
      sender: 'me',
      text: userMessageText,
      time: currentTime
    };
    
    setMsgs(prev => [...prev, optimisticUserMsg]);
    setStatusMap(prev => ({ ...prev, [tempId]: 'SENT' }));
    setInput('');
    
    // Simulate typing for AI chat
    if (chat.type === 'ai' || chat.id === 'presidium-ai') {
      setIsTyping(true);
    }
    
    try {
      // P2P mode
      if ((chat.type === 'ether' || chat.id === 'p2p-sync') && p2pClient.connected && p2pClient.peers.length > 0) {
        await p2pClient.sendMessage(p2pClient.peers[0], 'message', { text: userMessageText });
        setStatusMap(prev => ({ ...prev, [tempId]: 'DELIVERED' }));
        setTimeout(() => setStatusMap(prev => ({ ...prev, [tempId]: 'READ' })), 1200);
        setIsTyping(false);
        return;
      }

      // Try API
      const saved = await postMessage(userMessageText);
      if (saved) {
        const mapped = mapChatMessage(saved);
        setMsgs(prev => prev.map(msg => (msg.id === tempId ? mapped : msg)));
        setStatusMap(prev => ({ ...prev, [saved.id]: 'DELIVERED' }));
        setTimeout(() => setStatusMap(prev => ({ ...prev, [saved.id]: 'READ' })), 1200);
      } else {
        // Local mode - just mark as delivered
        setStatusMap(prev => ({ ...prev, [tempId]: 'DELIVERED' }));
        setTimeout(() => setStatusMap(prev => ({ ...prev, [tempId]: 'READ' })), 800);
      }

      // Simulate AI response for AI chat
      if (chat.type === 'ai' || chat.id === 'presidium-ai') {
        setTimeout(async () => {
          const aiReply = await assistantService.getSmartSuggestions(userMessageText);
          const aiResponse: UiMessage = {
            id: `ai-reply-${Date.now()}`,
            sender: 'ai',
            text: aiReply.length > 0 
              ? `${aiReply[0]}\n\n💡 Также могу помочь с:\n${aiReply.slice(1).map(s => `• ${s}`).join('\n')}`
              : '✅ Понял. Если нужна помощь — спрашивай!',
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          };
          setMsgs(prev => [...prev, aiResponse]);
          setIsTyping(false);
        }, 1000 + Math.random() * 1000);
      }

      // Simulate response for demo chats
      if (chat.id === 'alice-contact' || chat.id === 'team-channel') {
        setTimeout(() => {
          const responses = chat.id === 'alice-contact' 
            ? ['Отлично! 👍', 'Понятно, жду!', 'Хорошо, пиши если что', 'Супер!', 'ОК 👌']
            : ['✅ Принято', '👍', 'Ок', 'Сделаем', '🚀'];
          const reply: UiMessage = {
            id: `reply-${Date.now()}`,
            sender: 'them',
            text: responses[Math.floor(Math.random() * responses.length)],
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          };
          setMsgs(prev => [...prev, reply]);
        }, 1500 + Math.random() * 2000);
      }

      } catch (error) {
        console.error('Failed to send message:', error);
      // Keep message but mark as failed
      setStatusMap(prev => ({ ...prev, [tempId]: 'SENT' }));
      } finally {
      if (chat.type !== 'ai' && chat.id !== 'presidium-ai') {
        setIsTyping(false);
      }
    }
  };
  
  const [showChatInfo, setShowChatInfo] = useState(false);
  
  return (
    <div className={`flex flex-col h-full ${theme.bg} relative z-20`}>
      <AnimatePresence>
        {showScam && <ScamAlertOverlay onClose={() => setShowScam(false)} theme={theme} />}
      </AnimatePresence>
      
      {/* Chat Header */}
      <div className={`h-16 flex items-center px-4 justify-between ${theme.glass} ${theme.border} border-b backdrop-blur-xl`}>
        <div className="flex items-center gap-3">
          <motion.button onClick={onBack} whileTap={{ scale: 0.9 }} className={`p-2 rounded-full ${theme.text} hover:bg-white/10 transition-colors`}>
            <Icon.ChevronLeft size={20} />
          </motion.button>
          <button onClick={() => setShowChatInfo(true)} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full grid place-items-center font-bold text-sm ${
                chat.id === 'scam-warning' ? 'bg-gradient-to-br from-red-500 to-orange-600 text-white' 
                : chat.type === 'ai' ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                : chat.encrypted ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-black' 
                : theme.accent + ' ' + theme.accentText
              }`}>
                {chatAvatar}
          </div>
              {chat.online && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black" />
              )}
            </div>
            <div className="text-left">
              <h3 className={`font-bold text-sm ${theme.text} flex items-center gap-2`}>
                {chat.name}
                {chat.encrypted && <Icon.Lock size={10} className="text-emerald-500" />}
              </h3>
              <div className={`text-[10px] font-mono ${chat.online ? 'text-emerald-500' : theme.text2}`}>
                {chat.online ? 'В сети' : chat.encrypted ? 'PQC защищен' : 'Офлайн'}
          </div>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            className={`p-2 rounded-full ${theme.text2} hover:bg-white/10 transition-colors`}
          >
            <Icon.Phone size={18} />
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            className={`p-2 rounded-full ${theme.text2} hover:bg-white/10 transition-colors`}
          >
            <Icon.Video size={18} />
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            onClick={() => setShowChatInfo(true)}
            className={`p-2 rounded-full ${theme.text2} hover:bg-white/10 transition-colors`}
          >
            <Icon.MoreVertical size={18} />
          </motion.button>
        </div>
      </div>
      
      {/* AI Summary Panel */}
      {chat.type === 'ai' && (
            <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className={`px-4 py-3 border-b ${theme.border} bg-gradient-to-r from-violet-500/10 to-purple-500/10`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon.Sparkles size={12} className="text-violet-400" />
            <div className={`text-[10px] font-mono uppercase ${theme.text2}`}>AI Сводка</div>
          </div>
          <div className={`text-xs ${theme.text}`}>{aiSummary || '⏳ Анализирую...'}</div>
          {aiSuggestions.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {aiSuggestions.map((suggestion) => (
                <motion.button
                  key={suggestion}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSend(suggestion)}
                  className="text-[10px] px-3 py-1.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-colors"
                >
                  {suggestion}
                </motion.button>
              ))}
            </div>
          )}
            </motion.div>
      )}
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
        {isLoadingHistory && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        )}
        {!isLoadingHistory && msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className={`w-16 h-16 rounded-full grid place-items-center mb-4 ${theme.glass} border ${theme.border}`}>
              <Icon.MessageSquare size={24} className={theme.text2} />
            </div>
            <p className={`text-sm ${theme.text2}`}>Начните общение</p>
            <p className={`text-xs ${theme.text2} mt-1`}>Сообщения защищены PQC шифрованием</p>
          </div>
        )}
        {!isLoadingHistory && msgs.map((msg: any, idx: number) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.02, 0.2) }}
            className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              msg.sender === 'me' 
                ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-black rounded-br-md' 
                : msg.sender === 'ai' 
                  ? 'bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-white rounded-bl-md' 
                  : `${theme.glass} border ${theme.border} ${theme.text} rounded-bl-md`
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <div className={`flex items-center justify-end gap-2 text-[9px] mt-1 ${msg.sender === 'me' ? 'text-black/60' : 'opacity-60'}`}>
                <span>{msg.time}</span>
                {msg.sender === 'me' && (
                  <span className="flex items-center gap-0.5">
                    {statusMap[msg.id] === 'READ' ? (
                      <Icon.CheckCheck size={12} className="text-black" />
                    ) : statusMap[msg.id] === 'DELIVERED' ? (
                      <Icon.CheckCheck size={12} className="text-black/50" />
                    ) : (
                      <Icon.Check size={12} className="text-black/50" />
                    )}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className={`rounded-2xl rounded-bl-md px-4 py-3 ${theme.glass} border ${theme.border} flex gap-1.5`}>
              <motion.div animate={{ y: [-3, 3, -3] }} transition={{ duration: 0.6, repeat: Infinity }} className="w-2 h-2 rounded-full bg-emerald-500" />
              <motion.div animate={{ y: [-3, 3, -3] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} className="w-2 h-2 rounded-full bg-emerald-500" />
              <motion.div animate={{ y: [-3, 3, -3] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          </motion.div>
        )}
      </div>
      
      {/* Input Area */}
      <div className={`p-3 ${theme.glass} border-t ${theme.border} backdrop-blur-xl`}>
        <div className={`rounded-[24px] flex items-center gap-2 px-2 py-1 border ${theme.input} ${theme.border} focus-within:border-emerald-500/50 transition-colors`}>
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            className={`p-2 rounded-full ${theme.text2} hover:bg-white/10 transition-colors`}
          >
            <Icon.Paperclip size={18} />
          </motion.button>
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Сообщение..." 
            className={`bg-transparent flex-1 ${theme.text} outline-none text-sm py-2`} 
          />
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            className={`p-2 rounded-full ${theme.text2} hover:bg-white/10 transition-colors`}
          >
            <Icon.Smile size={18} />
          </motion.button>
          <AnimatePresence>
            {input ? (
              <motion.button
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleSend()}
                className="w-10 h-10 rounded-full grid place-items-center bg-gradient-to-r from-emerald-500 to-cyan-500 text-black shadow-lg shadow-emerald-500/30"
              >
                <Icon.Send size={16} />
              </motion.button>
            ) : (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileTap={{ scale: 0.9 }}
                className={`p-2 rounded-full ${theme.text2} hover:bg-white/10 transition-colors`}
            >
                <Icon.Mic size={18} />
            </motion.button>
          )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chat Info Modal */}
      <AnimatePresence>
        {showChatInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowChatInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm rounded-3xl border ${theme.glass} ${theme.border} overflow-hidden`}
            >
              <div className="p-6 flex flex-col items-center border-b border-white/10">
                <div className={`w-20 h-20 rounded-full grid place-items-center font-bold text-xl mb-4 ${
                  chat.type === 'ai' ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                  : chat.encrypted ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-black' 
                  : theme.accent + ' ' + theme.accentText
                }`}>
                  {chatAvatar}
                </div>
                <h3 className={`text-lg font-bold ${theme.text}`}>{chat.name}</h3>
                <p className={`text-xs ${theme.text2} mt-1`}>{chat.online ? '🟢 В сети' : '⚫ Не в сети'}</p>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { icon: Icon.Bell, label: 'Уведомления', value: 'Вкл' },
                  { icon: Icon.Lock, label: 'Шифрование', value: chat.encrypted ? 'PQC' : 'Нет' },
                  { icon: Icon.Globe, label: 'Тип', value: chat.type?.toUpperCase() || 'PERSONAL' },
                ].map(({ icon: ItemIcon, label, value }) => (
                  <div key={label} className={`flex items-center justify-between p-3 rounded-xl ${theme.glass} border ${theme.border}`}>
                    <div className="flex items-center gap-3">
                      <ItemIcon size={16} className={theme.text2} />
                      <span className={`text-sm ${theme.text}`}>{label}</span>
                    </div>
                    <span className={`text-xs ${theme.text2}`}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-white/10">
                <button 
                  onClick={() => setShowChatInfo(false)}
                  className={`w-full py-3 rounded-xl text-sm font-medium ${theme.glass} border ${theme.border} ${theme.text}`}
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AI_CoreView = ({ theme, t }: any) => {
  const [subTab, setSubTab] = useState('chat');
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('Привет, Командир. Системы в норме.');
  const [status, setStatus] = useState<'idle' | 'processing' | 'ready'>('ready');
  const aiEngine = useMemo(() => new LocalAIEngine(), []);
  
  const handleCommand = async () => {
    if (!input.trim()) return;
    setStatus('processing');
    const reply = await aiEngine.generateReply([input]);
    setResponse(`[Команда: ${input}]\n\n${reply}`);
    setInput('');
    setStatus('ready');
  };
  
  return (
    <div className={`p-6 pt-24 h-full flex flex-col pb-32 animate-enter ${theme.bg}`}>
      <div className="flex justify-center mb-6">
        <div className={`flex p-1 rounded-xl ${theme.glass} ${theme.border}`}>
          {['chat', 'models', 'privacy'].map(tab => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg ${
                subTab === tab ? theme.buttonPrimary : theme.text2
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      
      {subTab === 'chat' && (
        <div className={`flex-1 rounded-[32px] border flex flex-col ${theme.glass} ${theme.border}`}>
          <div className="flex-1 p-4">
            <StatusIndicator status={status === 'processing' ? 'processing' : 'online'} theme={theme} />
            <div className={`p-3 rounded-xl ${theme.glass} ${theme.text} text-sm mt-4 whitespace-pre-wrap`}>
              {response}
            </div>
          </div>
          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCommand()}
                placeholder={t('ai.input')} 
                className={`w-full bg-transparent text-sm outline-none ${theme.text}`} 
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCommand}
                disabled={status === 'processing'}
                className={`px-4 py-2 rounded-lg ${theme.buttonPrimary} text-xs font-bold disabled:opacity-50`}
              >
                {status === 'processing' ? '...' : t('ai.generate')}
              </motion.button>
            </div>
          </div>
        </div>
      )}
      
      {subTab === 'models' && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {['NLP', 'Moderation', 'Emotion', 'Voice'].map((name, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}
            >
              <div className="flex justify-between mb-2">
                <span className={`font-bold ${theme.text}`}>{name}</span>
                <span className="text-emerald-400 text-xs">ГОТОВ</span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-full" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
      
      {subTab === 'privacy' && (
        <div className="flex-1 overflow-y-auto">
          <PrivacyDashboard theme={theme} t={t} />
        </div>
      )}
    </div>
  );
};

const PrivacyDashboard = ({ theme, t }: any) => {
  const privacyGuard = useMemo(() => PrivacyGuard.getInstance(), []);
  const stats = privacyGuard.getStats();
  const audit = privacyGuard.getAuditLog(20);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
          <div className="text-2xl font-black text-emerald-400">{stats.allowed}</div>
          <div className={`text-xs ${theme.text2}`}>Разрешено</div>
        </div>
        <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
          <div className="text-2xl font-black text-red-400">{stats.blocked}</div>
          <div className={`text-xs ${theme.text2}`}>Заблокировано</div>
        </div>
      </div>
      
      <div className={`p-4 rounded-2xl border ${theme.glass} ${theme.border}`}>
        <h4 className={`font-bold ${theme.text} mb-2`}>{t('privacy.audit_log')}</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {audit.map((log: any, i: number) => (
            <div key={i} className={`p-2 rounded-lg text-[10px] font-mono ${theme.glass}`}>
              <div className="flex justify-between">
                <span className={log.action === 'BLOCKED' ? 'text-red-400' : 'text-emerald-400'}>
                  {log.action}
                </span>
                <span className={theme.text2}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className={theme.text2}>Hash: {log.dataHash}...</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// EconomyView - импортирован из ./views/EconomyView
// ProfileView - импортирован из ./views/ProfileView

// VaultView, KeysView, NetworkView, ReputationView - импортированы из ./views/SimpleViews
// SettingsView - импортирован из ./views/SettingsView
// MiniAppsView - импортирован из ./views/MiniAppsView

// ============================================================================
// 🚀 ГЛАВНЫЙ КОМПОНЕНТ
// ============================================================================

// URL to View mapping
const URL_TO_VIEW: Record<string, ViewType> = {
  '/': 'auth',
  '/dashboard': 'dashboard',
  '/chats': 'chats',
  '/chat': 'chat-detail',
  '/ai': 'ai-core',
  '/economy': 'economy',
  '/profile': 'profile',
  '/vault': 'vault',
  '/keys': 'keys',
  '/network': 'network',
  '/reputation': 'reputation',
  '/apps': 'mini-apps',
  '/settings': 'settings',
};

const VIEW_TO_URL: Record<ViewType, string> = {
  'auth': '/',
  'dashboard': '/dashboard',
  'chats': '/chats',
  'chat-detail': '/chat',
  'ai-core': '/ai',
  'economy': '/economy',
  'profile': '/profile',
  'vault': '/vault',
  'keys': '/keys',
  'network': '/network',
  'reputation': '/reputation',
  'mini-apps': '/apps',
  'settings': '/settings',
};

export default function PresidiumOS_v10_1_Full() {
  const routerNavigate = useNavigate();
  const location = useLocation();
  
  // Sync view state with URL
  const getViewFromURL = useCallback((): ViewType => {
    return URL_TO_VIEW[location.pathname] || 'dashboard';
  }, [location.pathname]);
  
  const [view, setView] = useState<ViewType>(getViewFromURL);
  const [tab, setTab] = useState<ViewType>('dashboard');
  const [themeMode, setThemeMode] = useState<ThemeMode>('CYBER');
  const [aiProgress, setAiProgress] = useState<string>('');
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const theme = THEMES[themeMode];
  const t = useCallback((key: string) => {
    const keys = key.split('.');
    let val: any = TRANSLATIONS['ru'];
    for (const k of keys) { val = val?.[k]; if(!val) return key; }
    return val;
  }, []);
  
  const aiEngine = useMemo(() => new LocalAIEngine((text: string) => {
    setAiProgress(text);
  }), []);
  const vaultManager = useMemo(() => VaultManager.getInstance(), []);
  
  useEffect(() => {
    vaultManager.init();
  }, [vaultManager]);
  
  // Sync URL changes to view state
  useEffect(() => {
    const newView = getViewFromURL();
    if (newView !== view && newView !== 'auth') {
      setView(newView);
      setTab(newView);
    }
  }, [location.pathname, getViewFromURL, view]);
  
  const toggleTheme = useCallback(() => {
    setThemeMode(prev => {
      const order: ThemeMode[] = ['LUX', 'CYBER', 'PRIVACY'];
      return order[(order.indexOf(prev) + 1) % order.length];
    });
  }, []);
  
  // Navigate function that updates both URL and state
  const navigate = useCallback((nextView: ViewType) => {
    setTab(nextView);
    setView(nextView);
    const url = VIEW_TO_URL[nextView] || '/dashboard';
    routerNavigate(url);
  }, [routerNavigate]);
  
  const renderView = () => {
    switch (view) {
      case 'auth':
        return <AuthScreen onLogin={() => navigate('dashboard')} theme={theme} t={t} toggleTheme={toggleTheme} aiEngine={aiEngine} progressText={aiProgress} />;
      case 'dashboard':
        return <DashboardView theme={theme} t={t} onNavigate={navigate} />;
      case 'chats':
        return <ChatsListView theme={theme} t={t} onSelectChat={(chat: any) => { setSelectedChat(chat); navigate('chat-detail'); }} />;
      case 'chat-detail':
        return selectedChat
          ? <ChatDetailView chat={selectedChat} onBack={() => navigate('chats')} theme={theme} t={t} />
          : <ChatsListView theme={theme} t={t} onSelectChat={(chat: any) => { setSelectedChat(chat); navigate('chat-detail'); }} />;
      case 'ai-core':
        return <AI_CoreView theme={theme} t={t} />;
      case 'economy':
        return <EconomyView theme={theme} t={t} />;
      case 'profile':
        return <ProfileView theme={theme} t={t} onNavigate={navigate} />;
      case 'vault':
        return <VaultView theme={theme} t={t} />;
      case 'keys':
        return <KeysView theme={theme} t={t} />;
      case 'network':
        return <NetworkView theme={theme} t={t} />;
      case 'reputation':
        return <ReputationView theme={theme} t={t} />;
      case 'mini-apps':
        return <MiniAppsView theme={theme} t={t} />;
      case 'settings':
        return <SettingsView theme={theme} t={t} themeMode={themeMode} setThemeMode={setThemeMode} />;
      default:
        return <DashboardView theme={theme} t={t} onNavigate={navigate} />;
    }
  };
  
  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${theme.bg}`}>
      {themeMode !== 'LUX' && <MatrixRain color={themeMode === 'CYBER' ? '#00FF00' : '#7B68EE'} />}
      
      <div className="w-full max-w-md mx-auto min-h-screen relative shadow-2xl flex flex-col">
        <AnimatePresence>
          {view !== 'auth' && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-[100]"
            >
              <div className={`px-4 py-2 rounded-full flex items-center gap-3 border backdrop-blur-xl ${theme.glass} ${theme.border}`}>
                <div className={`w-2 h-2 rounded-full ${theme.statusOnline} animate-pulse`} />
                <span className={`text-[10px] font-mono font-bold ${theme.text}`}>{t('status.online')}</span>
                <StatusIndicator status="processing" theme={theme} label="PQC:OK" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3 }}
            className="flex-1 relative overflow-y-auto"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
        
        <AnimatePresence>
          {view !== 'auth' && view !== 'chat-detail' && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
            >
              <Dock activeTab={tab} onChange={navigate} theme={theme} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Export additional classes for external use
export {
  LocalAIEngine,
  PrivacyGuard,
  VaultManager
};
