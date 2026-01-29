import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";
import MessageList from "./components/MessageList";
import Composer from "./components/Composer";
import type { Attachment, Message, NewMessageInput } from "./types";
import { deleteMedia } from "./services/localMediaStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemPrompt, setSystemPrompt] = useState(
    "Ты помощник Presidium. Отвечай коротко и по делу."
  );
  const [isPromptVisible, setIsPromptVisible] = useState(true);
  const [roomId, setRoomId] = useState("presidium-demo");
  const [isRoomConnected, setIsRoomConnected] = useState(false);
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
  const pollTimerRef = useRef<number | null>(null);
  const lastSignalIdRef = useRef(0);

  const isAttachmentExpired = (attachment: Attachment) => {
    if (!attachment.expiresAt) return false;
    return new Date(attachment.expiresAt).getTime() <= Date.now();
  };

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
    pcLocalRef.current = null;

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

  const sendSignal = async (payload: Record<string, unknown>) => {
    if (!isRoomConnected) return;
    await fetch(`${API_BASE_URL}/api/signaling/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ room: roomId, payload })
    });
  };

  const ensurePeerConnection = async (mode: "audio" | "video") => {
    if (pcLocalRef.current) return pcLocalRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video"
    });

    localStreamRef.current = stream;
    setCallMode(mode);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const pc = new RTCPeerConnection();
    pcLocalRef.current = pc;

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        remoteStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: "candidate", candidate: event.candidate });
      }
    };

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    return pc;
  };

  const startCall = async (mode: "audio" | "video") => {
    if (callStatus !== "idle") return;
    if (!isRoomConnected) {
      setCallError("Подключитесь к комнате, чтобы начать звонок.");
      return;
    }

    setCallStatus("connecting");
    setCallError(null);

    try {
      const pc = await ensurePeerConnection(mode);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ type: "offer", offer, mode });
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessages((prev) =>
        prev
          .map((message) => {
            if (!message.attachments) return message;
            const [active, expired] = message.attachments.reduce<
              [Attachment[], Attachment[]]
            >(
              (acc, att) => {
                if (isAttachmentExpired(att)) {
                  acc[1].push(att);
                } else {
                  acc[0].push(att);
                }
                return acc;
              },
              [[], []]
            );
            expired.forEach((att) => {
              if (att.storageKey) {
                void deleteMedia(att.storageKey);
              }
            });
            return { ...message, attachments: active };
          })
          .filter((message) => message.body || (message.attachments?.length ?? 0) > 0)
      );
    }, 2000);

    return () => window.clearInterval(interval);
  }, []);

  const handleSignalMessage = async (message: {
    type: "offer" | "answer" | "candidate" | "hangup";
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    mode?: "audio" | "video";
  }) => {
    if (message.type === "offer" && message.offer && message.mode) {
      try {
        const pc = await ensurePeerConnection(message.mode);
        await pc.setRemoteDescription(message.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "answer", answer });
        setCallStatus("active");
      } catch (error) {
        console.error("Failed to answer call:", error);
        setCallError("Не удалось принять звонок.");
      }
    }

    if (message.type === "answer" && message.answer && pcLocalRef.current) {
      await pcLocalRef.current.setRemoteDescription(message.answer);
    }

    if (message.type === "candidate" && message.candidate && pcLocalRef.current) {
      await pcLocalRef.current.addIceCandidate(message.candidate);
    }

    if (message.type === "hangup") {
      stopCall();
    }
  };

  const connectRoom = () => {
    if (!roomId.trim()) {
      setCallError("Введите название комнаты.");
      return;
    }
    setIsRoomConnected(true);
    setCallError(null);
  };

  const disconnectRoom = () => {
    setIsRoomConnected(false);
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    lastSignalIdRef.current = 0;
  };

  useEffect(() => {
    if (!isRoomConnected) return;

    const poll = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/signaling/poll?room=${encodeURIComponent(
            roomId
          )}&since=${lastSignalIdRef.current}`
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          messages: Array<{ id: number; payload: unknown }>;
        };
        data.messages.forEach((message) => {
          lastSignalIdRef.current = Math.max(lastSignalIdRef.current, message.id);
          const payload = message.payload as {
            type: "offer" | "answer" | "candidate" | "hangup";
            offer?: RTCSessionDescriptionInit;
            answer?: RTCSessionDescriptionInit;
            candidate?: RTCIceCandidateInit;
            mode?: "audio" | "video";
          };
          handleSignalMessage(payload);
        });
      } catch (error) {
        console.error("Failed to poll signaling:", error);
      }
    };

    poll();
    pollTimerRef.current = window.setInterval(poll, 1200);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [API_BASE_URL, isRoomConnected, roomId]);

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
      status: "sent",
      attachments: input.attachments
    };

    addMessage(userMessage);

    try {
      // POST to backend
      if (input.body.trim()) {
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
                <p>WebRTC звонки через сигналинг. Откройте вторую вкладку.</p>
              </div>
              <span className={styles.callStatusBadge}>
                {callStatus === "idle" && "Готов"}
                {callStatus === "connecting" && "Подключение"}
                {callStatus === "active" && `В сети (${callMode})`}
              </span>
            </div>

            {callError ? <div className={styles.callError}>{callError}</div> : null}

            <div className={styles.roomRow}>
              <label className={styles.roomLabel} htmlFor="roomId">
                Комната
              </label>
              <input
                id="roomId"
                className={styles.roomInput}
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
              />
              {isRoomConnected ? (
                <button className={styles.secondaryButton} onClick={disconnectRoom}>
                  Отключиться
                </button>
              ) : (
                <button className={styles.secondaryButton} onClick={connectRoom}>
                  Подключиться
                </button>
              )}
            </div>

            <div className={styles.callControls}>
              <button
                className={styles.primaryButton}
                onClick={() => startCall("audio")}
                disabled={callStatus !== "idle" || !isRoomConnected}
              >
                Аудио звонок
              </button>
              <button
                className={styles.primaryButton}
                onClick={() => startCall("video")}
                disabled={callStatus !== "idle" || !isRoomConnected}
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
                onClick={() => {
                  sendSignal({ type: "hangup" });
                  stopCall();
                }}
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
