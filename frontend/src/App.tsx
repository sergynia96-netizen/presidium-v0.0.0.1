import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";
import MessageList from "./components/MessageList";
import Composer from "./components/Composer";
import type { Message, NewMessageInput } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemPrompt, setSystemPrompt] = useState(
    "Ты помощник Presidium. Отвечай коротко и по делу."
  );
  const [isPromptVisible, setIsPromptVisible] = useState(true);
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active">(
    "idle"
  );
  const [callMode, setCallMode] = useState<"audio" | "video" | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcLocalRef = useRef<RTCPeerConnection | null>(null);
  const pcRemoteRef = useRef<RTCPeerConnection | null>(null);

  const messageCountLabel = useMemo(() => {
    if (messages.length === 0) return "Нет сообщений";
    return `${messages.length} сообщений`;
  }, [messages.length]);

  const resetCallState = () => {
    setCallStatus("idle");
    setCallMode(null);
    setIsMicMuted(false);
    setIsCameraOff(false);
    setCallError(null);
  };

  const stopCall = () => {
    pcLocalRef.current?.close();
    pcRemoteRef.current?.close();
    pcLocalRef.current = null;
    pcRemoteRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    resetCallState();
  };

  const startCall = async (mode: "audio" | "video") => {
    if (callStatus !== "idle") return;
    setCallStatus("connecting");
    setCallMode(mode);
    setCallError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video"
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pcLocal = new RTCPeerConnection();
      const pcRemote = new RTCPeerConnection();

      pcLocalRef.current = pcLocal;
      pcRemoteRef.current = pcRemote;

      pcRemote.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          remoteStreamRef.current = remoteStream;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        }
      };

      pcLocal.onicecandidate = (event) => {
        if (event.candidate) {
          pcRemote.addIceCandidate(event.candidate);
        }
      };

      pcRemote.onicecandidate = (event) => {
        if (event.candidate) {
          pcLocal.addIceCandidate(event.candidate);
        }
      };

      stream.getTracks().forEach((track) => pcLocal.addTrack(track, stream));

      const offer = await pcLocal.createOffer();
      await pcLocal.setLocalDescription(offer);
      await pcRemote.setRemoteDescription(offer);

      const answer = await pcRemote.createAnswer();
      await pcRemote.setLocalDescription(answer);
      await pcLocal.setRemoteDescription(answer);

      setCallStatus("active");
    } catch (error) {
      console.error("Failed to start call:", error);
      stopCall();
      setCallError("Не удалось запустить звонок. Проверьте доступ к камере/микрофону.");
    }
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = isMicMuted;
    });
    setIsMicMuted((prev) => !prev);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = isCameraOff;
    });
    setIsCameraOff((prev) => !prev);
  };

  useEffect(() => {
    return () => {
      stopCall();
    };
  }, []);

  const addMessage = (message: Message) => {
    setMessages((prev) => [message, ...prev]);
  };

  const handleSend = async (input: NewMessageInput) => {
    const now = new Date().toISOString();
    const userMessage: Message = {
      id: crypto.randomUUID(),
      channel: input.channel,
      from: input.from,
      to: input.to,
      subject: input.subject,
      body: input.body,
      createdAt: now,
      status: "sent"
    };

    addMessage(userMessage);

    try {
      // POST to backend
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: input.body, systemPrompt })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add server reply to list
        const serverMessage: Message = {
          id: crypto.randomUUID(),
          channel: input.channel,
          from: "presidium.local",
          to: input.from,
          subject: "Local LLM",
          body: data.reply,
          createdAt: new Date(data.timestamp).toISOString(),
          status: "received"
        };

        addMessage(serverMessage);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      
      // Add error message
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        channel: input.channel,
        from: "presidium.local",
        to: input.from,
        subject: "Ошибка доставки",
        body: "Не удалось подключиться к серверу.",
        createdAt: new Date().toISOString(),
        status: "failed"
      };

      addMessage(errorMessage);
    }
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>Presidium Core</div>
          <h1 className={styles.title}>Unified Inbox</h1>
          <p className={styles.subtitle}>
            Локальный чат + аудио/видео звонки. Backend: {API_BASE_URL}
          </p>
        </div>
        <div className={styles.statusBadge}>
          {callStatus === "active" ? "Звонок активен" : "Система готова"}
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.inboxPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Единый инбокс</h2>
              <p>Сообщения из чата, почты и SMS</p>
            </div>
            <span className={styles.panelMeta}>{messageCountLabel}</span>
          </div>
          <MessageList messages={messages} />
        </section>

        <aside className={styles.sidePanel}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3>Звонки</h3>
                <p>Локальный WebRTC loopback без сигналинга</p>
              </div>
              <span className={styles.callStatusBadge}>
                {callStatus === "idle" && "Готов"}
                {callStatus === "connecting" && "Подключение"}
                {callStatus === "active" && `В сети (${callMode})`}
              </span>
            </div>

            {callError ? <div className={styles.callError}>{callError}</div> : null}

            <div className={styles.callControls}>
              <button
                className={styles.primaryButton}
                onClick={() => startCall("audio")}
                disabled={callStatus !== "idle"}
              >
                Аудио звонок
              </button>
              <button
                className={styles.primaryButton}
                onClick={() => startCall("video")}
                disabled={callStatus !== "idle"}
              >
                Видео звонок
              </button>
              <button
                className={styles.secondaryButton}
                onClick={toggleMic}
                disabled={callStatus !== "active"}
              >
                {isMicMuted ? "Включить микрофон" : "Выключить микрофон"}
              </button>
              <button
                className={styles.secondaryButton}
                onClick={toggleCamera}
                disabled={callStatus !== "active" || callMode !== "video"}
              >
                {isCameraOff ? "Включить камеру" : "Выключить камеру"}
              </button>
              <button
                className={styles.dangerButton}
                onClick={stopCall}
                disabled={callStatus === "idle"}
              >
                Завершить звонок
              </button>
            </div>

            <div className={styles.callMediaGrid}>
              <div className={styles.callMediaCard}>
                <span>Ваш поток</span>
                <video
                  ref={localVideoRef}
                  className={styles.callVideo}
                  autoPlay
                  muted
                  playsInline
                />
              </div>
              <div className={styles.callMediaCard}>
                <span>Удаленный поток</span>
                <video ref={remoteVideoRef} className={styles.callVideo} autoPlay playsInline />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3>Local LLM</h3>
                <p>Настройте prompt и отправьте сообщение</p>
              </div>
              <button
                className={styles.secondaryButton}
                onClick={() => setIsPromptVisible((prev) => !prev)}
              >
                {isPromptVisible ? "Скрыть prompt" : "Показать prompt"}
              </button>
            </div>

            {isPromptVisible ? (
              <div className={styles.promptPanel}>
                <label className={styles.promptLabel} htmlFor="systemPrompt">
                  System prompt для локального LLM
                </label>
                <textarea
                  id="systemPrompt"
                  className={styles.promptInput}
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  rows={3}
                />
              </div>
            ) : null}

            <Composer onSend={handleSend} />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default App;
