import React, { useRef, useState } from "react";
import type { Attachment, Channel, NewMessageInput } from "../types";
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim() && attachments.length === 0) return;

    const payload: NewMessageInput = {
      channel,
      from,
      to,
      subject: subject || undefined,
      body,
      attachments
    };

    try {
      setSending(true);
      await onSend(payload);
      setBody("");
      setSubject("");
      setAttachments([]);
    } finally {
      setSending(false);
    }
  };

  const handleFiles = (files: FileList | null, type: Attachment["type"]) => {
    if (!files) return;
    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      type,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const handleLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setAttachments((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "location",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: "Моя геопозиция"
        }
      ]);
    });
  };

  const startVoiceRecording = async () => {
    if (isRecording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    audioRecorderRef.current = recorder;
    audioChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      setAttachments((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "voice",
          url,
          duration: Math.round(blob.size / 1000)
        }
      ]);
      stream.getTracks().forEach((track) => track.stop());
    };
    recorder.start();
    setIsRecording(true);
  };

  const stopVoiceRecording = () => {
    audioRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const startVideoRecording = async (isCircle: boolean) => {
    if (isVideoRecording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const recorder = new MediaRecorder(stream);
    videoRecorderRef.current = recorder;
    videoChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      videoChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const expiresAt = isCircle ? new Date(Date.now() + 60_000).toISOString() : undefined;
      setAttachments((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: isCircle ? "video-circle" : "video",
          url,
          expiresAt
        }
      ]);
      stream.getTracks().forEach((track) => track.stop());
    };
    recorder.start();
    setIsVideoRecording(true);
    setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
        setIsVideoRecording(false);
      }
    }, isCircle ? 8000 : 15000);
  };

  const stopVideoRecording = () => {
    videoRecorderRef.current?.stop();
    setIsVideoRecording(false);
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

      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => fileInputRef.current?.click()}
        >
          Фото
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => videoInputRef.current?.click()}
        >
          Видео
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => docInputRef.current?.click()}
        >
          Док
        </button>
        <button type="button" className={styles.secondaryButton} onClick={handleLocation}>
          Гео
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
        >
          {isRecording ? "Стоп голос" : "Голос"}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={isVideoRecording ? stopVideoRecording : () => startVideoRecording(false)}
        >
          {isVideoRecording ? "Стоп видео" : "Видео запись"}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => startVideoRecording(true)}
        >
          Кружок
        </button>
      </div>

      {attachments.length > 0 ? (
        <div className={styles.attachmentList}>
          {attachments.map((attachment) => (
            <div key={attachment.id} className={styles.attachmentItem}>
              <span>{attachment.type}</span>
              <button
                type="button"
                onClick={() =>
                  setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        multiple
        onChange={(event) => handleFiles(event.target.files, "image")}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(event) => handleFiles(event.target.files, "video")}
      />
      <input
        ref={docInputRef}
        type="file"
        hidden
        onChange={(event) => handleFiles(event.target.files, "document")}
      />

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
        <button
          className={styles.button}
          type="submit"
          disabled={sending || (!body.trim() && attachments.length === 0)}
        >
          {sending ? "Отправка…" : "Отправить в Presidium"}
        </button>
      </div>
    </form>
  );
};

export default Composer;

