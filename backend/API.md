# Presidium Backend API Documentation

Полная документация по API endpoints для всех модулей Presidium.

## Базовый URL
```
http://localhost:3000/api
```

## Формат ответа

Все ответы в формате:
```json
{
  "success": true,
  "data": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Эндпоинты

### 🔍 Dashboard & Metrics

#### GET `/api/dashboard`
Получить полную статистику системы (CRDT, P2P, метрики, репутация)

#### GET `/api/metrics`
Получить системные метрики (память ИИ, хранилище, активные сессии)

---

### 🌐 P2P Network

#### GET `/api/p2p/network`
Получить статус P2P сети (узлы, подключения, сессии)

#### GET `/api/p2p/nodes/:nodeId`
Получить информацию о конкретном узле

---

### 🔄 CRDT (Conflict-free Replicated Data Types)

#### GET `/api/crdt`
Получить состояние CRDT (включено, последняя синхронизация, конфликты)

#### POST `/api/crdt/sync`
Принудительная синхронизация CRDT

#### PUT `/api/crdt/enabled`
Включить/выключить CRDT
```json
{
  "enabled": true
}
```

---

### 💰 Economy

#### GET `/api/economy/wallet`
Получить кошелек (капитал, баланс, валюта)

#### GET `/api/economy/transactions?limit=50`
Получить транзакции

#### POST `/api/economy/deposit`
Пополнить баланс
```json
{
  "amount": 100,
  "description": "Пополнение"
}
```

#### POST `/api/economy/withdraw`
Вывести средства
```json
{
  "amount": 50,
  "description": "Вывод"
}
```

#### POST `/api/economy/exchange`
Обменять валюту
```json
{
  "amount": 100,
  "toCurrency": "USD",
  "rate": 0.01
}
```

#### POST `/api/economy/stake`
Стейкинг
```json
{
  "amount": 1000,
  "duration": 30
}
```

#### GET `/api/economy/marketplace`
Получить все товары маркетплейса

#### GET `/api/economy/marketplace/:itemId`
Получить товар по ID

#### POST `/api/economy/purchase`
Купить товар
```json
{
  "itemId": "mesh-router-1"
}
```

---

### ⭐ Reputation & Trust

#### GET `/api/reputation`
Получить репутацию (доверие, рейтинг, аптайм)

---

### 🔐 Vault & Keys

#### GET `/api/vault/keys`
Получить все ключи

#### GET `/api/vault/keys/:keyId`
Получить ключ по ID

#### POST `/api/vault/keys`
Создать новый ключ
```json
{
  "name": "Session Key",
  "type": "session",
  "fingerprint": "A1:B2:C3",
  "encrypted": true
}
```

#### DELETE `/api/vault/keys/:keyId`
Удалить ключ

#### GET `/api/vault/items`
Получить все элементы хранилища

#### POST `/api/vault/items`
Добавить элемент в хранилище
```json
{
  "name": "Secret File",
  "type": "file",
  "encrypted": true,
  "size": 1024
}
```

#### DELETE `/api/vault/items/:itemId`
Удалить элемент из хранилища

---

### 💬 Chat

#### GET `/api/chats?filter=all`
Получить все чаты (фильтр: all, personal, secret, ether, ai)

#### GET `/api/chats/search?q=query`
Поиск чатов

#### GET `/api/chats/:chatId`
Получить чат по ID

#### GET `/api/chats/:chatId/messages?limit=100`
Получить сообщения чата

#### POST `/api/chats/:chatId/messages`
Отправить сообщение
```json
{
  "text": "Привет",
  "sender": "user",
  "senderType": "user",
  "encrypted": true,
  "filter": "all"
}
```

#### POST `/api/chats/:chatId/read`
Отметить чат как прочитанный

#### POST `/api/chats`
Создать новый чат
```json
{
  "name": "Новый чат",
  "type": "personal",
  "encrypted": true
}
```

---

### 📜 Legacy API (для совместимости)

#### GET `/api/history`
Получить историю чата (legacy)

#### POST `/api/chat`
Отправить сообщение ИИ (legacy)
```json
{
  "message": "Привет"
}
```

---

### 🏥 Health Check

#### GET `/health`
Проверка здоровья сервера

---

## Примеры использования

### Получить статистику дашборда
```bash
curl http://localhost:3000/api/dashboard
```

### Пополнить баланс
```bash
curl -X POST http://localhost:3000/api/economy/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "description": "Пополнение"}'
```

### Получить P2P сеть
```bash
curl http://localhost:3000/api/p2p/network
```

### Отправить сообщение
```bash
curl -X POST http://localhost:3000/api/chats/presidium-ai/messages \
  -H "Content-Type: application/json" \
  -d '{"text": "Привет", "sender": "user", "senderType": "user"}'
```

## Статусы ответов

- `200` - Успешно
- `400` - Неверный запрос (отсутствуют обязательные поля)
- `404` - Ресурс не найден
- `500` - Внутренняя ошибка сервера

## Примечания

- Все временные метки в формате ISO 8601
- Все суммы в базовой валюте (₵)
- Все идентификаторы в формате UUID
- P2P узлы обновляются динамически
- Метрики имитируют небольшие флуктуации

