import React, { useEffect, useMemo, useState } from "react";
import type { Attachment, Message } from "../types";
import styles from "./MessageList.module.css";
import { loadMedia } from "../services/localMediaStore";

interface MessageListProps {
  messages: Message[];
}

const formatBytes = (bytes?: number) => {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
};

const isAttachmentExpired = (attachment: Attachment) => {
  if (!attachment.expiresAt) return false;
  return new Date(attachment.expiresAt).getTime() <= Date.now();
};

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const [loadedUrls, setLoadedUrls] = useState<Record<string, string>>({});

  const attachmentIds = useMemo(() => {
    const ids = new Set<string>();
    messages.forEach((message) => {
      message.attachments?.forEach((attachment) => ids.add(attachment.id));
    });
    return ids;
  }, [messages]);

  useEffect(() => {
    setLoadedUrls((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (!attachmentIds.has(id)) {
          URL.revokeObjectURL(next[id]);
          delete next[id];
        }
      });
      return next;
    });
  }, [attachmentIds]);

  useEffect(() => {
    return () => {
      Object.values(loadedUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [loadedUrls]);

  const handleLoad = async (attachment: Attachment) => {
    if (!attachment.storageKey) return;
    const blob = await loadMedia(attachment.storageKey);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setLoadedUrls((prev) => ({ ...prev, [attachment.id]: url }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.scroll}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            Нет сообщений. Отправьте первое сообщение через Composer справа.
          </div>
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
              {m.body ? <p className={styles.body}>{m.body}</p> : null}
              {m.attachments && m.attachments.length > 0 ? (
                <div className={styles.attachments}>
                  {m.attachments
                    .filter((att) => !isAttachmentExpired(att))
                    .map((att) => {
                      const url = att.url ?? loadedUrls[att.id];

                      if (att.type === "image" && url) {
                        return (
                          <img
                            key={att.id}
                            src={url}
                            alt={att.name ?? "image"}
                            className={styles.attachmentImage}
                          />
                        );
                      }

                      if (
                        (att.type === "video" ||
                          att.type === "video-circle" ||
                          att.type === "vanishing-video") &&
                        url
                      ) {
                        return (
                          <video
                            key={att.id}
                            src={url}
                            className={
                              att.type === "video-circle"
                                ? styles.attachmentVideoCircle
                                : styles.attachmentVideo
                            }
                            controls
                          />
                        );
                      }

                      if (att.type === "voice" && url) {
                        return (
                          <audio key={att.id} className={styles.attachmentAudio} controls>
                            <source src={url} />
                          </audio>
                        );
                      }

                      if (att.type === "document" && url) {
                        return (
                          <a
                            key={att.id}
                            href={url}
                            className={styles.attachmentDoc}
                            download={att.name}
                          >
                            <div>
                              <div className={styles.attachmentTitle}>
                                {att.name ?? "Документ"}
                              </div>
                              <div className={styles.attachmentMeta}>
                                {formatBytes(att.size)}
                              </div>
                            </div>
                          </a>
                        );
                      }

                      if (att.type === "location") {
                        const label = att.label ?? "Геопозиция";
                        const href = `https://maps.google.com/?q=${att.latitude},${att.longitude}`;
                        return (
                          <a
                            key={att.id}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.attachmentLocation}
                          >
                            <span>{label}</span>
                            <span className={styles.attachmentMeta}>
                              {att.latitude?.toFixed(5)}, {att.longitude?.toFixed(5)}
                            </span>
                          </a>
                        );
                      }

                      if (att.storageKey) {
                        return (
                          <button
                            key={att.id}
                            className={styles.attachmentLoad}
                            onClick={() => handleLoad(att)}
                          >
                            Загрузить {att.type}
                          </button>
                        );
                      }

                      return null;
                    })}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
};

export default MessageList;
