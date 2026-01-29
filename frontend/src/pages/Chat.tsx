import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatBubble from "../components/ChatBubble";
import MessageInput from "../components/MessageInput";
import { assistantService } from "../services/ai/assistant.service";
import { useP2P } from "../hooks/useP2P";

type ChatItem = {
  id: string;
  name: string;
  type: "all" | "personal" | "secret" | "ether" | "ai";
  lastMessage?: string;
  lastMessageTime?: string;
  unread: number;
  encrypted: boolean;
};

type ChatMessage = {
  id: string;
  chatId: string;
  text: string;
  sender: string;
  senderType: "user" | "ai" | "system";
  timestamp: string;
  encrypted: boolean;
  filter: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};

type MessageStatus = "SENT" | "DELIVERED" | "READ";

type StatusIndicatorProps = {
  label: string;
  active: boolean;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const PAGE_SIZE = 30;

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ label, active }) => (
  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em]">
    <span
      className="h-2 w-2 rounded-full"
      style={{ background: active ? "#00FF41" : "#FF3D00" }}
    />
    <span style={{ color: active ? "#00FF41" : "#FF3D00" }}>{label}</span>
  </div>
);

type ContactListProps = {
  chats: ChatItem[];
  activeChatId?: string;
  onSelect: (chat: ChatItem) => void;
};

const ContactList: React.FC<ContactListProps> = ({ chats, activeChatId, onSelect }) => (
  <div className="flex flex-col gap-2">
    {chats.map((chat) => (
      <button
        key={chat.id}
        onClick={() => onSelect(chat)}
        className="text-left border px-4 py-3 transition"
        style={{
          borderColor: activeChatId === chat.id ? "#FF3D00" : "#222222",
          background: activeChatId === chat.id ? "#0B0B0B" : "#050505",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold" style={{ color: "#E5E5E5" }}>
            {chat.name}
          </div>
          {chat.unread > 0 && (
            <span className="text-[10px] font-bold" style={{ color: "#00FFFF" }}>
              {chat.unread}
            </span>
          )}
        </div>
        <div className="text-xs mt-2" style={{ color: "#666666" }}>
          {chat.lastMessage || "Нет сообщений"}
        </div>
      </button>
    ))}
  </div>
);

const formatTime = (timestamp?: string) => {
  if (!timestamp) return "--:--";
  return new Date(timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const fetchChats = async (query?: string): Promise<ChatItem[]> => {
  const url = query
    ? `${API_BASE_URL}/api/chats/search?q=${encodeURIComponent(query)}`
    : `${API_BASE_URL}/api/chats`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Chats fetch failed: ${response.status}`);
  }
  const payload: ApiResponse<ChatItem[]> = await response.json();
  return payload.data || [];
};

const fetchMessages = async (chatId: string, limit: number): Promise<ChatMessage[]> => {
  const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Messages fetch failed: ${response.status}`);
  }
  const payload: ApiResponse<ChatMessage[]> = await response.json();
  return payload.data || [];
};

const sendMessage = async (chatId: string, text: string): Promise<ChatMessage> => {
  const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      sender: "user",
      senderType: "user",
      encrypted: true,
      filter: "all",
    }),
  });
  if (!response.ok) {
    throw new Error(`Send message failed: ${response.status}`);
  }
  const payload: ApiResponse<ChatMessage> = await response.json();
  if (!payload.data) throw new Error("No message returned");
  return payload.data;
};

const getWebSocketUrl = () => {
  try {
    const apiUrl = new URL(API_BASE_URL);
    const wsOrigin = apiUrl.origin.replace("https://", "wss://").replace("http://", "ws://");
    return `${wsOrigin}/ws`;
  } catch {
    const fallback = API_BASE_URL.replace("https://", "wss://").replace("http://", "ws://");
    return `${fallback}/ws`;
  }
};

const Chat: React.FC = () => {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [messageStatus, setMessageStatus] = useState<Record<string, MessageStatus>>({});
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [spamAlerts, setSpamAlerts] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const p2pClient = useP2P();

  const loadChats = useCallback(async (search?: string) => {
    const list = await fetchChats(search);
    setChats(list);
    if (!activeChat && list.length > 0) {
      setActiveChat(list[0]);
    }
  }, [activeChat]);

  useEffect(() => {
    loadChats().catch(() => setChats([]));
  }, [loadChats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length === 0) {
        loadChats().catch(() => setChats([]));
      } else {
        loadChats(query.trim()).catch(() => setChats([]));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, loadChats]);

  const loadMessages = useCallback(async (chatId: string, nextOffset: number) => {
    setLoading(true);
    try {
      const limit = nextOffset + PAGE_SIZE;
      const list = await fetchMessages(chatId, limit);
      setMessages(list);
      setHasMore(list.length >= limit);
      setOffset(nextOffset);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAiAssist = useCallback(async (list: ChatMessage[]) => {
    if (!list.length) {
      setAiSummary("Нет данных для анализа");
      setAiSuggestions([]);
      return;
    }

    const lastMessages = list.slice(-3);
    const summary = lastMessages
      .map((msg) => `${msg.senderType === "user" ? "Вы" : msg.sender}: ${msg.text}`)
      .join(" | ")
      .slice(0, 220);

    setAiSummary(summary);

    const lastText = lastMessages[lastMessages.length - 1]?.text || "";
    const suggestions = await assistantService.getSmartSuggestions(lastText);
    setAiSuggestions(suggestions);
  }, []);

  const handleIncomingMessage = useCallback(
    async (incoming: ChatMessage) => {
      const isSpam = await assistantService.shouldFilter(incoming.text);
      if (isSpam) {
        setSpamAlerts((prev) => [incoming.text, ...prev].slice(0, 5));
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === "scam-warning"
              ? {
                  ...chat,
                  lastMessage: incoming.text,
                  lastMessageTime: incoming.timestamp,
                  unread: chat.unread + 1,
                }
              : chat
          )
        );
        return;
      }

      setMessages((prev) => [...prev, incoming]);
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === incoming.chatId
            ? { ...chat, lastMessage: incoming.text, lastMessageTime: incoming.timestamp, unread: chat.unread + 1 }
            : chat
        )
      );
    },
    []
  );

  useEffect(() => {
    if (!activeChat) return;
    loadMessages(activeChat.id, 0).catch(() => setMessages([]));
  }, [activeChat, loadMessages]);

  useEffect(() => {
    if (activeChat?.type === "ai") {
      updateAiAssist(messages).catch(() => {
        setAiSummary("AI анализ недоступен");
      });
    }
  }, [activeChat?.type, messages, updateAiAssist]);

  const handleSend = useCallback(async () => {
    if (!activeChat || !input.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      chatId: activeChat.id,
      text: input.trim(),
      sender: "user",
      senderType: "user",
      timestamp: new Date().toISOString(),
      encrypted: true,
      filter: "all",
    };

    setMessages((prev) => [...prev, optimistic]);
    setMessageStatus((prev) => ({ ...prev, [tempId]: "SENT" }));
    setInput("");

    try {
      if (activeChat.id === "p2p-sync" && p2pClient.connected && p2pClient.peers.length > 0) {
        const targetPeer = p2pClient.peers[0];
        await p2pClient.sendMessage(targetPeer, "message", { text: optimistic.text });
        setMessageStatus((prev) => ({ ...prev, [tempId]: "DELIVERED" }));
        setTimeout(() => {
          setMessageStatus((prev) => ({ ...prev, [tempId]: "READ" }));
        }, 1200);
        return;
      }

      const saved = await sendMessage(activeChat.id, optimistic.text);
      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? saved : msg)));
      setMessageStatus((prev) => ({ ...prev, [saved.id]: "DELIVERED" }));

      setTimeout(() => {
        setMessageStatus((prev) => ({ ...prev, [saved.id]: "READ" }));
      }, 1200);
    } catch {
      setMessageStatus((prev) => ({ ...prev, [tempId]: "SENT" }));
    }
  }, [activeChat, input, p2pClient.connected, p2pClient.peers, p2pClient.sendMessage]);

  useEffect(() => {
    const wsUrl = getWebSocketUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type !== "chat-message") return;
        const data = payload.data as ChatMessage;
        if (!data?.chatId || !data?.text) return;
        handleIncomingMessage(data);
      } catch {
        // Ignore malformed WS messages
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (!p2pClient.peer) return;
    const unsubscribe = p2pClient.peer.onMessage(async (message) => {
      if (message.type !== "message" || !message.payload?.text) return;
      const incoming: ChatMessage = {
        id: message.id,
        chatId: "p2p-sync",
        text: message.payload.text,
        sender: message.from,
        senderType: "system",
        timestamp: new Date(message.timestamp).toISOString(),
        encrypted: message.encrypted,
        filter: "ether",
      };
      await handleIncomingMessage(incoming);
    });

    return () => unsubscribe();
  }, [p2pClient.peer, handleIncomingMessage]);

  const currentMessages = useMemo(() => {
    return messages.map((msg) => ({
      ...msg,
      status: messageStatus[msg.id],
    }));
  }, [messages, messageStatus]);

  return (
    <div className="min-h-screen w-full" style={{ background: "#050505", color: "#E5E5E5" }}>
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-[0.3em]" style={{ color: "#FF3D00" }}>
              COMMUNICATION GRID
            </h1>
            <div className="text-xs uppercase tracking-[0.4em]" style={{ color: "#666666" }}>
              Industrial Cyberpunk Interface
            </div>
          </div>
          <StatusIndicator label={wsConnected ? "REAL-TIME" : "OFFLINE"} active={wsConnected} />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <aside className="border p-4" style={{ borderColor: "#222222", background: "#050505" }}>
            <div className="mb-4">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск чатов..."
                className="w-full bg-transparent border px-3 py-2 text-xs uppercase tracking-[0.3em] outline-none"
                style={{ borderColor: "#333333", color: "#00FFFF" }}
              />
            </div>
            <ContactList chats={chats} activeChatId={activeChat?.id} onSelect={setActiveChat} />
          </aside>

          <section className="border flex flex-col" style={{ borderColor: "#222222", background: "#050505" }}>
            <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "#222222" }}>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#00FFFF" }}>
                  {activeChat?.name || "Выберите чат"}
                </div>
                <div className="text-xs" style={{ color: "#666666" }}>
                  {activeChat?.lastMessageTime ? `Last: ${formatTime(activeChat.lastMessageTime)}` : "Нет сообщений"}
                </div>
              </div>
              <StatusIndicator label={activeChat?.encrypted ? "ENCRYPTED" : "PLAIN"} active={!!activeChat?.encrypted} />
            </div>

            {activeChat?.type === "ai" && (
              <div className="border-b px-6 py-4 flex flex-col gap-3" style={{ borderColor: "#222222" }}>
                <div className="text-[10px] uppercase tracking-[0.4em]" style={{ color: "#FF3D00" }}>
                  Presidium AI Summary
                </div>
                <div className="text-xs" style={{ color: "#E5E5E5" }}>
                  {aiSummary || "AI анализ выполняется..."}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {aiSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        setTimeout(handleSend, 0);
                      }}
                      className="border px-3 py-2 text-[10px] uppercase tracking-[0.3em]"
                      style={{ borderColor: "#00FFFF", color: "#00FFFF" }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {spamAlerts.length > 0 && activeChat?.id === "scam-warning" && (
              <div className="border-b px-6 py-4" style={{ borderColor: "#222222" }}>
                <div className="text-[10px] uppercase tracking-[0.4em]" style={{ color: "#FF3D00" }}>
                  Scam Shield Alerts
                </div>
                <ul className="mt-3 space-y-2 text-xs" style={{ color: "#E5E5E5" }}>
                  {spamAlerts.map((alert, index) => (
                    <li key={`${alert}-${index}`} className="border px-3 py-2" style={{ borderColor: "#333333" }}>
                      {alert}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
              {hasMore && activeChat && (
                <button
                  onClick={() => loadMessages(activeChat.id, offset + PAGE_SIZE)}
                  className="self-center text-[10px] uppercase tracking-[0.3em] border px-4 py-2"
                  style={{ borderColor: "#333333", color: "#00FFFF" }}
                  disabled={loading}
                >
                  {loading ? "Загрузка..." : "Загрузить ещё"}
                </button>
              )}
              {currentMessages.length === 0 && (
                <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#666666" }}>
                  Сообщений нет
                </div>
              )}
              {currentMessages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  text={msg.text}
                  time={formatTime(msg.timestamp)}
                  isOwn={msg.senderType === "user"}
                  status={messageStatus[msg.id]}
                />
              ))}
            </div>

            <div className="border-t px-6 py-4" style={{ borderColor: "#222222" }}>
              <MessageInput value={input} onChange={setInput} onSend={handleSend} disabled={!activeChat} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Chat;
