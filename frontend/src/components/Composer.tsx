import React, { useState } from "react";
import type { Channel, NewMessageInput } from "../types";
import styles from "./Composer.module.css";

interface ComposerProps {
  onSend: (input: NewMessageInput) => Promise<void> | void;
}

const defaultFrom = "you@example.com";
const defaultTo = "contact@presidium.local";

export const Composer: React.FC<ComposerProps> = ({ onSend }) => {
  const [channel, setChannel] = useState<Channel>("email");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;

    const payload: NewMessageInput = {
      channel,
      from,
      to,
      subject: subject || undefined,
      body
    };

    try {
      setSending(true);
      await onSend(payload);
      setBody("");
      setSubject("");
    } finally {
      setSending(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <div>
          <div className={styles.label}>Канал</div>
          <select className={styles.select} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="p2p">P2P Chat</option>
          </select>
        </div>
        <div>
          <div className={styles.label}>От</div>
          <input className={styles.input} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <div className={styles.label}>Кому</div>
          <input className={styles.input} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div>
        <div className={styles.label}>Тема (опционально)</div>
        <input className={styles.input} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div>
        <div className={styles.label}>Текст сообщения</div>
        <textarea
          className={styles.textarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Напишите сообщение, и оно появится в едином инбоксе слева…"
        />
      </div>

      <div className={styles.actions}>
        <div className={styles.hint}>Демо-режим: сообщение сохраняется в памяти в браузере / на бэкенде.</div>
        <button className={styles.button} type="submit" disabled={sending || !body.trim()}>
          {sending ? "Отправка…" : "Отправить в Presidium"}
        </button>
      </div>
    </form>
  );
};

export default Composer;


