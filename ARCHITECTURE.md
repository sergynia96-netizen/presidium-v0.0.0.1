## Presidium — Архитектурный гайд

Этот документ даёт **целостное представление об архитектуре** проекта Presidium: как устроены backend, frontend, P2P-сеть, локальный AI и системы безопасности, и как они связаны между собой.

- **Назначение продукта**: унифицированная платформа сообщений (Email + SMS + P2P) с квантово‑устойчивым шифрованием, CRDT‑синхронизацией и локальным AI.
- **Технологический стек**:
  - **Backend**: Node.js, Express, TypeScript
  - **Frontend**: React, TypeScript, Vite, Tailwind, Framer Motion
  - **AI**:
    - Browser: `@mlc-ai/web-llm` / Nano‑core (эвристики + ONNX Runtime WASM)
    - Server: `@xenova/transformers` (Phi‑2, MiniLM, DistilBERT) — опционально
  - **P2P**: WebRTC + Kademlia DHT + PQC (Kyber1024/Dilithium5 — готовность)

---

## 1. Общая архитектура

Высокоуровневая схема:

```text
┌────────────────────────────────────────────────────────────┐
│                         FRONTEND                           │
│  React + Vite                                              │
│  - Classic UI (App.tsx)                                   │
│  - Presidium OS (PresidiumOS.tsx)                         │
│  - Nano-AI Core (assistant.service / nano.engine / censor)│
│  - P2P WebRTC клиент + PQC шифрование                     │
└───────────────▲───────────────────────────────┬───────────┘
                │ HTTP/WS API                  │ WebRTC+PQC
┌───────────────┴───────────────────────────────▼───────────┐
│                         BACKEND                           │
│  Express + TS (порт 3000)                                 │
│  - /api/* REST + WebSocket (realtime + signaling)         │
│  - Сервисы доменов: auth, chat, economy, vault, p2p, ... │
│  - Ядра: AI Engine, CRDT, P2P Network, PQC Crypto         │
│  - Системы: cache-layer, storage-manager, sync-engine     │
└───────────────▲───────────────────────────────┬───────────┘
                │                              │
                │                              │ (roadmap)
          Еmail/SMS шлюзы                 Внешние хранилища
          (adapters)                      и федеративные узлы
```

Ключевые особенности:
- **Offline‑first**: состояние чатов и экономики синхронизируется через CRDT и P2P‑сеть.
- **Локальный AI**: обработка сообщений, модерация и быстрые ответы выполняются на устройстве.
- **Квантово‑устойчивая криптография**: P2P‑сообщения шифруются с использованием PQC‑подхода.
- **Многофакторная аутентификация**: SMS‑OTP + device fingerprint + поведенческая аналитика.

---

## 2. Структура репозитория

Основные директории:

```text
presidium/
├── backend/                 # Серверная часть (Express + TS)
│   ├── src/
│   │   ├── core/            # Ядра: AI, P2P, CRDT, PQC
│   │   ├── services/        # Бизнес‑логика доменов
│   │   ├── systems/         # Системные подсистемы (storage, cache, sync)
│   │   ├── api/ routes/     # V2/WS маршруты
│   │   ├── routes/          # Основные REST эндпоинты
│   │   ├── adapters/        # Интеграции (email, sms)
│   │   ├── models/ types/   # Типы данных
│   │   ├── realtime.ts      # WebSocket / realtime слой
│   │   └── server.ts        # Точка входа (Express + signaling)
│   └── API.md, AUTH_ARCHITECTURE.md, ...  # Детальные доки
│
├── frontend/                # Клиент (React + Vite)
│   ├── src/
│   │   ├── App.tsx          # Classic UI
│   │   ├── PresidiumOS.tsx  # Новый Presidium OS UI
│   │   ├── api/             # HTTP‑клиенты к backend
│   │   ├── services/
│   │   │   └── ai/          # Nano‑AI Core (assistant, nano.engine, censor)
│   │   ├── p2p/             # WebRTC peer‑клиент
│   │   ├── crypto/          # PQC криптография в браузере
│   │   ├── hooks/           # P2P hooks (useP2P)
│   │   ├── pages/ views/    # Экраны и layout‑ы
│   │   └── components/      # UI‑компоненты (чаты, маркетплейс, метрики)
│   └── public/models/       # LLM‑модель для локального AI
│
├── k8s/                     # Манифесты для Kubernetes
├── .github/workflows/       # CI/CD (деплой Heroku + Vercel)
└── *.md                     # Тематические доки (см. ссылки ниже)
```

Рекомендуемые входные точки для чтения:
- `README.md` — обзор фич и API.
- `ARCHITECTURE.md` (этот файл) — общая архитектура.
- `backend/API.md` — детализация REST API.
- `backend/AUTH_ARCHITECTURE.md` — полный разбор MFA/безопасности.
- `NANO_AI_CORE.md` — архитектура Nano‑AI ядра (frontend).
- `P2P_PROTOCOL.md` — детализация P2P‑протокола.
- `PRESIDIUM_OS_INTEGRATION.md` — как встроен новый OS‑интерфейс.

---

## 3. Backend архитектура

### 3.1. Точка входа и маршрутизация

**Файл**: `backend/src/server.ts`

- Инициализирует `Express`‑приложение.
- Включает CORS с whitelisting доменов (`CORS_ORIGINS`).
- Регистрирует:
  - `/health` — health‑check.
  - `/` — служебное описание сервиса и основных эндпоинтов.
  - `/api` — все REST‑маршруты (подключены через `routes/index.ts` / `api/routes-v2.ts`).
- Создаёт HTTP‑сервер и поверх него:
  - **WebRTC signaling server** (`WebRTCSignalingServer`) — WebSocket‑сигналинг для P2P.
  - **Realtime сервер** (`initRealtimeServer`) — метрики, dashboard и обновления в реальном времени.

Паттерн:
- **Express как edge‑слой**: валидация, маршалинг тел запросов/ответов.
- **Сервисы** содержат доменную логику и не знают о HTTP‑деталях.

### 3.2. Доменные сервисы (`backend/src/services`)

Основные сервисы (см. также список в `README.md`):

- **`auth.service.ts`** — многофакторная аутентификация:
  - Инициация `SMS‑OTP`, проверка кода, управление сессиями.
  - Интеграция с:
    - `device.service.ts` (fingerprinting),
    - `behavioral.service.ts` (typing entropy, velocity),
    - `ratelimit.service.ts` (ограничения по попыткам),
    - `security.service.ts` (логирование событий безопасности).
  - Архитектура подробно описана в `backend/AUTH_ARCHITECTURE.md`.

- **`chat.service.ts`** — управление чатами и сообщениями:
  - CRUD чатов, фильтры (`all`, `personal`, `secret`, `ether`, `ai`).
  - Работа с историей сообщений и метаданными (прочитано/непрочитано).

- **`p2p.service.ts`** — мост к P2P‑ядру:
  - Отдаёт состояние P2P‑сети для dashboard.
  - Оборачивает `core/p2p-network.ts` и `core/p2p-dht.ts`.

- **`crdt.service.ts`** — управление CRDT‑состоянием:
  - Состояние CRDT, синхронизация и включение/выключение CRDT.
  - Используется `/api/crdt`, `/api/crdt/sync`, `/api/crdt/enabled`.

- **`economy.service.ts`** — экономика:
  - Кошелёк, транзакции, стейкинг, обмен валют, маркетплейс.
  - Сервирует эндпоинты `/api/economy/*`.

- **`vault.service.ts`** — криптосейф и управление ключами:
  - CRUD ключей и элементов хранилища (`/api/vault/*`).
  - Связан с репутацией/безопасностью.

- **`metrics.service.ts`** — сбор системных метрик:
  - Память (система/Node/AI), нагрузка CPU, сессии, P2P‑узлы и т.п.
  - Используется frontend‑панелью `DetailedMetricsPanel`.

- **`reputation.service.ts`** — доверие и репутация узла/пользователя.

Сервисы работают поверх:
- `models/types.ts` и `types/*.ts` — строгие типы DTO/моделей.
- `utils/logger.ts` and `services/logger.ts` — единый логгер.

### 3.3. Ядра (`backend/src/core`)

Здесь живут **низкоуровневые платформенные компоненты**, вокруг которых построены сервисы:

- **`ai-engine-production.ts`** — production‑реализация AI‑ядра:
  - Абстракция над `@xenova/transformers`.
  - Поддерживает:
    - **text‑generation** (Phi‑2),
    - **embeddings** (MiniLM),
    - **NER** (DistilBERT),
    - анализ намерений/тональности (в т.ч. fallback‑режим без моделей).
  - Предоставляет:
    - `analyze(text)` — sentiment + intent + entities.
    - `generate(prompt)` — генерация ответа.
    - `classify(text)` и `extractFeatures(text)` — более простые операции.
  - При отсутствии моделей автоматически переключается на лёгкий эвристический режим и всё равно возвращает полезные результаты.

- **`ai-engine.ts`** — облегчённая/абстрактная версия AI‑движка (для dev/тестов).

- **`crdt.ts`** — реализация CRDT‑структур для offline‑first синхронизации.

- **`p2p-network.ts`** и **`p2p-dht.ts`**:
  - Kademlia‑подобный DHT, routing table, bootstrap‑узлы.
  - Информация об узлах и статус‑метрики для `/api/p2p/network`.

- **`p2p-webrtc-signaling.ts`**:
  - WebSocket‑сигналинг для обмена SDP/ICE между браузерами.
  - Работает над тем же HTTP‑сервером, что и Express.

- **`pqc-crypto.ts` / `pqc-crypto-production.ts`**:
  - Бэкенд‑сторона квантово‑устойчивой криптографии (Kyber/Dilithium — подготовленные абстракции).

### 3.4. Системные подсистемы (`backend/src/systems`)

- **`cache-layer.ts`** — единый слой кэширования:
  - Конфигурируемый TTL, лимиты по памяти, hit‑rate.
  - Используется для метрик, CRDT‑состояния, P2P и т.п.

- **`storage-manager.ts` / `storage-manager-production.ts`**:
  - Абстракция над физическими хранилищами (файловая система, БД, S3 — текущий/roadmap).

- **`sync-engine.ts`**:
  - Координирует CRDT‑синхронизацию, P2P‑обмен и запись в storage.

- **`system-monitor.ts`**:
  - Сбор и агрегация системных метрик, которые потом отдаёт `metrics.service.ts`.

### 3.5. Адаптеры и интеграции

**`backend/src/adapters`**:
- `email.ts`, `sms.ts` — слой интеграций с внешними провайдерами (почта, SMS).
- В dev‑режиме SMS‑коды логируются в консоль (см. `AUTH_ARCHITECTURE.md`).

---

## 4. Frontend архитектура

### 4.1. Варианты UI

Фронтенд предоставляет **два интерфейса**:

- **Classic UI** (`App.tsx`):
  - Классический чат‑интерфейс (список диалогов, сообщения, AI‑чат).
  - Использует CSS‑модули (`*.module.css`).
  - Интегрирован с backend API через `src/api/*.ts`.

- **Presidium OS UI** (`PresidiumOS.tsx`):
  - Современный OS‑подобный интерфейс с Matrix‑фоном, темами и док‑панелью.
  - Три темы: **LUX**, **CYBER**, **PRIVACY**.
  - Использует Tailwind + Framer Motion + `lucide-react`.
  - Выбор UI через URL‑параметр:
    - `/?ui=new` → Presidium OS
    - без параметра → Classic UI
  - Подробный разбор: `PRESIDIUM_OS_INTEGRATION.md`.

### 4.2. Локальный AI (Nano‑Core) — `frontend/src/services/ai`

Основная логика описана в `NANO_AI_CORE.md`, а реализована в файлах:

- **`capability.service.ts`**:
  - Детектирует возможности устройства (CPU, RAM, WASM/WebGPU).
  - Классифицирует устройства на LOW/MID/HIGH.
  - Даёт профиль устройства (эмодзи‑бейдж, рекомендации по размеру моделей).

- **`nano.engine.ts`**:
  - Классификация текста: intent + sentiment.
  - Генерация быстрых ответов (quick replies) даже без тяжёлых моделей.
  - Интеграция с ONNX Runtime WASM (stub + roadmap по загрузке реальных моделей).

- **`nano.censor.ts`**:
  - Мгновенная модерация (<10ms) на основе regex + Bloom‑подобных структур.
  - Детектирует спам/скам/подозрительные паттерны.

- **`assistant.service.ts`**:
  - Высокоуровневый "AI‑ассистент":
    - Инициализация с учётом device‑tier.
    - Полный пайплайн: safety → intent → quick replies → action.
  - Возвращает:
    - набор умных реплик,
    - результат классификации,
    - решение (подсказать/автоответить/заблокировать).

Эти сервисы используются как в Classic UI, так и в Presidium OS (см. `PresidiumOS.tsx` — `LocalAIEngine`, `PrivacyGuard` и `LocalAIStatus`).

### 4.3. P2P и криптография

- **`src/p2p/WebRTCPeer.ts`**:
  - Клиентский WebRTC‑peer с data‑channel для P2P‑сообщений.
  - Подключается к signaling‑серверу backend (`/p2p-signaling`).

- **`src/hooks/useP2P.ts`**:
  - React‑hook, который инкапсулирует WebRTCPeer:
    - даёт `connected`, `peers`, `localPeerId`, `sendMessage`.
    - подписывается на события p2p‑соединений.

- **`src/services/p2p-messaging.ts`**:
  - Высокоуровневый сервис для обмена сообщениями по P2P:
    - onMessage‑подписки.
    - типизированный протокол сообщений (`P2PMessage`).

- **`src/crypto/pqc-browser.ts` / `pqc-crypto-client.ts`**:
  - Браузерная часть PQC:
    - генерация/обмен ключами (Kyber1024 KEM),
    - подписи (Dilithium5 — подготовленные интерфейсы),
    - шифрование сообщений (AES‑256‑GCM поверх PQC‑ключей).
  - Детали протокола и форматы сообщений описаны в `P2P_PROTOCOL.md`.

### 4.4. API‑клиенты и страницы

- **`src/api/chat.api.ts`, `src/api/status.api.ts`**:
  - Обёртки над REST‑эндпоинтами backend (`/api/chats`, `/api/dashboard`, `/api/metrics` и т.д.).
  - Единый базовый URL на основе `VITE_API_URL`.

- **Структура UI**:
  - `pages/Chat.tsx` — основной экран чата.
  - `pages/Dashboard.tsx` — панель с системными метриками и P2P/CRDT‑статусами.
  - `pages/Marketplace.tsx` — интерфейс экономики/маркетплейса.
  - `components/*` — переиспользуемые виджеты (списки сообщений, инпуты, панели, marketplace‑гриды).

Отдельно стоит `components/DetailedMetricsPanel.tsx` — **профессиональная панель метрик**, которая:
- отрисовывается через React‑портал поверх интерфейса,
- показывает детальный разбор памяти, CPU, потоков, P2P‑сети и хранилища,
- читает данные с backend (`/api/metrics`) и красиво визуализирует их.

---

## 5. Безопасность и аутентификация

### 5.1. Многофакторная аутентификация (Auth)

Подробно описано в `backend/AUTH_ARCHITECTURE.md`. Кратко:

- **Основной фактор**: SMS‑OTP (6‑значный код, TTL 90s, max 3 попытки).
- **Device Fingerprinting**:
  - собирает браузерные характеристики, строит device‑fingerprint,
  - различает новые/известные устройства, влияет на risk‑score.
- **Поведенческая аналитика**:
  - typing entropy, скорость, консистентность,
  - помогает детектировать ботов.
- **Rate limiting**:
  - отдельные лимиты для OTP‑запросов, verify и login‑попыток.
- **Risk scoring (0–100)**:
  - при `risk >= 80` — блокировка,
  - при `risk >= 50` — усиленный MFA (roadmap: WebAuthn/TOTP/Bio).

Backend хранит и проверяет сессии, а фронтенд работает с ними через API (`/api/auth/*`).

### 5.2. P2P безопасность

Как описано в `P2P_PROTOCOL.md`:

- **Шифрование**:
  - обмен ключами через PQC KEM (Kyber1024),
  - симметричное шифрование сообщений AES‑256‑GCM,
  - готовность к цифровым подписям Dilithium5.

- **Протокол сообщений**:
  - `P2PMessage` с полями `id`, `type`, `from`, `to`, `payload`, `timestamp`, `encrypted`, `encryptedData`.
  - поддерживает текст, файлы, typing‑индикаторы, read/delivery‑receipts.

### 5.3. Privacy & локальный AI

Из `NANO_AI_CORE.md` и `PRESIDIUM_OS_INTEGRATION.md`:

- Вся AI‑обработка на клиенте:
  - intent‑классификация, sentiment и модерация выполняются локально.
  - нет внешних API‑звонков.
- **PrivacyGuard** (в `PresidiumOS.tsx`):
  - логирует только **хеши** контента (SHA‑256),
  - хранит локальный audit‑лог до 100 записей.
- Сообщения на устройство/с устройства:
  - лишние данные не отправляются без явной необходимости (чат/экономика идут через backend, AI — локально).

---

## 6. Потоки данных (typical flows)

### 6.1. Вход пользователя (Auth flow)

1. Пользователь вводит телефон и проходит шаг **инициации** (`/api/auth/initiate`):
   - backend создаёт OTP, логирует риск‑параметры, отправляет SMS (или мок).
2. Пользователь вводит код → `/api/auth/verify-otp`.
3. Backend:
   - валидирует OTP, проверяет rate‑limits и risk‑score,
   - создаёт **сессию** и возвращает `sessionId`/JWT.
4. Frontend сохраняет сессию и использует её для API‑запросов (в Classic UI / Presidium OS).

### 6.2. Чат с AI

1. Пользователь вводит сообщение в UI.
2. На клиенте:
   - `assistantService.processMessage`:
     - `nanoCensor.checkSafety` — модерация,
     - `nanoEngine.classifyText` — intent+sentiment,
     - генерируются **quick replies** и действия.
3. В зависимости от режима:
   - сообщение может быть отправлено:
     - в backend (для сохранения/истории/синхронизации),
     - в локальный AI‑движок (Llama/ONNX) для генерации ответа.

### 6.3. P2P‑сообщение

1. `useP2P` устанавливает соединение с signaling‑сервером backend.
2. Через `WebRTCPeer` устанавливается WebRTC data‑channel с другим пэром.
3. Перед первой отправкой происходит PQC key‑exchange.
4. Сообщения шифруются локально (AES‑256‑GCM поверх PQC‑ключей) и отправляются по P2P‑каналу.
5. Backend при этом выступает только как signaling + опциональный мониторинг сети.

---

## 7. Расширение системы (как добавлять фичи)

Общий паттерн:

- **Backend**:
  1. Описать доменные типы в `backend/src/models/types.ts` или `backend/src/types/*`.
  2. Добавить/расширить сервис в `backend/src/services/*`.
  3. Пробросить новые операции в `backend/src/routes/index.ts` или `backend/src/api/routes-v2.ts`.
  4. При необходимости — дополнить core/systems (CRDT, P2P, storage, AI).

- **Frontend (Classic UI)**:
  1. Добавить HTTP‑клиент в `frontend/src/api/*`.
  2. Создать/расширить страницу в `frontend/src/pages/*`.
  3. Добавить компоненты в `frontend/src/components/*`.

- **Frontend (Presidium OS)**:
  1. Добавить новый "view" в `PresidiumOS.tsx` (например, новый таб в Dock).
  2. Подключить существующие сервисы (`assistantService`, P2P, economy) или создать новые.
  3. Использовать Tailwind + Framer Motion для анимаций.

Backend‑и frontend связаны **только через типизированные DTO и REST/WebSocket**. P2P и Nano‑AI в основном живут на клиенте и используют backend лишь как инфраструктуру (сигналинг, мониторинг, хранение состояния).

---

## 8. Связанные документы

Для более глубокого изучения конкретных подсистем:

- **API**: `backend/API.md`
- **Аутентификация**: `backend/AUTH_ARCHITECTURE.md`
- **Nano‑AI Core**: `NANO_AI_CORE.md`
- **P2P‑протокол**: `P2P_PROTOCOL.md`
- **Presidium OS UI**: `PRESIDIUM_OS_INTEGRATION.md`
- **Деплой**: `DEPLOYMENT.md`, `QUICK_DEPLOY.md`, `PRODUCTION_STATUS.md`
- **PQC статус/прогресс**: `BACKEND_P2P_PQC_STATUS.md`, `PERSISTENCE_UPGRADE.md`, `TEST_PERSISTENCE.md`

Этот `ARCHITECTURE.md` предназначен как **главный вход** в архитектуру проекта. Для реализации/отладки отдельных фич переходите к соответствующим тематическим документам и исходному коду.

