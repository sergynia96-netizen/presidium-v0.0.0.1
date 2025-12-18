import React, { useEffect, useState } from "react";
import MessageList from "./components/MessageList";
import Composer from "./components/Composer";
import type { Message, NewMessageInput } from "./types";
import styles from "./App.module.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/messages`);
        if (!res.ok) return;
        const data = (await res.json()) as Message[];
        setMessages(data);
      } catch {
        // Backend может быть ещё не запущен – тихо игнорируем ошибку.
      }
    };
    void load();
  }, []);

  const handleSend = async (input: NewMessageInput) => {
    try {
      const res = await fetch(`${API_URL}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });

      if (res.ok) {
        const data = (await res.json()) as { message: Message };
        setMessages((prev) => [data.message, ...prev]);
        return;
      }
    } catch {
      // Fallback: если бэкенд недоступен, сохраняем сообщение только на фронте.
    }

    const localMessage: Message = {
      id: crypto.randomUUID(),
      channel: input.channel,
      from: input.from,
      to: input.to,
      subject: input.subject,
      body: input.body,
      createdAt: new Date().toISOString(),
      status: "sent"
    };

    setMessages((prev) => [localMessage, ...prev]);
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.title}>📬 Presidium v0.0.0.1 — Unified Inbox</div>
        <span className={styles.badge}>Demo • Email + SMS + P2P</span>
      </header>

      <main className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Unified Inbox</div>
            <div className={styles.panelMeta}>{messages.length} сообщений</div>
          </div>
          <div className={styles.panelBody}>
            <MessageList messages={messages} />
          </div>
        </section>

        <section className={`${styles.panel} ${styles.panelRight}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Composer</div>
            <div className={styles.panelMeta}>Отправка в демо-инбокс</div>
          </div>
          <div className={styles.panelBody}>
            <Composer onSend={handleSend} />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Backend: {API_URL}</span>
        <span>
          Built with <a className={styles.link} href="https://vitejs.dev" target="_blank" rel="noreferrer">
            Vite + React 18 + TypeScript
          </a>
        </span>
      </footer>
    </div>
  );
};

export default App;


