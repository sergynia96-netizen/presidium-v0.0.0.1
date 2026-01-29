import React from "react";
import type { Attachment, Message } from "../types";
import styles from "./MessageList.module.css";

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
                      if (att.type === "image" && att.url) {
                        return (
                          <img
                            key={att.id}
                            src={att.url}
                            alt={att.name ?? "image"}
                            className={styles.attachmentImage}
                          />
                        );
                      }

                      if (
                        (att.type === "video" ||
                          att.type === "video-circle" ||
                          att.type === "vanishing-video") &&
                        att.url
                      ) {
                        return (
                          <video
                            key={att.id}
                            src={att.url}
                            className={
                              att.type === "video-circle"
                                ? styles.attachmentVideoCircle
                                : styles.attachmentVideo
                            }
                            controls
                          />
                        );
                      }

                      if (att.type === "voice" && att.url) {
                        return (
                          <audio key={att.id} className={styles.attachmentAudio} controls>
                            <source src={att.url} />
                          </audio>
                        );
                      }

                      if (att.type === "document" && att.url) {
                        return (
                          <a
                            key={att.id}
                            href={att.url}
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

