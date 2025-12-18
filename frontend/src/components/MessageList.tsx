import React from "react";
import type { Message } from "../types";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <div className={styles.container}>
      <div className={styles.scroll}>
        {messages.length === 0 ? (
          <div className={styles.empty}>Нет сообщений. Отправьте первое сообщение через Composer справа.</div>
        ) : (
          messages.map((m) => (
            <article key={m.id} className={styles.item}>
              <header className={styles.header}>
                <span className={styles.channel}>{m.channel.toUpperCase()}</span>
                <span className={styles.subject}>{m.subject || "(без темы)"}</span>
              </header>
              <div className={styles.meta}>
                <span>
                  {m.from} → {m.to}
                </span>
                <span>{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <p className={styles.body}>{m.body}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
};

export default MessageList;


