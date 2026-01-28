import React, { useEffect, useRef, useState } from "react";
import styles from "./App.module.css";

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "server";
  timestamp: Date;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    "Ты помощник Presidium. Отвечай коротко и по делу."
  );
  const [isPromptVisible, setIsPromptVisible] = useState(false);
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

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      text: inputValue,
      sender: "user",
      timestamp: new Date()
    };

    // Optimistically add user message to list
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsSending(true);

    try {
      // POST to backend
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: inputValue, systemPrompt })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add server reply to list
        const serverMessage: ChatMessage = {
          id: crypto.randomUUID(),
          text: data.reply,
          sender: "server",
          timestamp: new Date(data.timestamp)
        };

        setMessages((prev) => [...prev, serverMessage]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        text: "Failed to connect to server",
        sender: "server",
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.app}>
      <section className={styles.callPanel}>
        <div className={styles.callHeader}>
          <div>
            <h2 className={styles.callTitle}>Аудио и видео звонки</h2>
            <p className={styles.callSubtitle}>
              Локальный WebRTC loopback. Для реальных звонков потребуется сигналинг сервер.
            </p>
          </div>
          <div className={styles.callStatus}>
            {callStatus === "idle" && "Готов к звонку"}
            {callStatus === "connecting" && "Подключение..."}
            {callStatus === "active" && `Звонок активен (${callMode})`}
          </div>
        </div>

        {callError ? <div className={styles.callError}>{callError}</div> : null}

        <div className={styles.callControls}>
          <button
            className={styles.callButton}
            onClick={() => startCall("audio")}
            disabled={callStatus !== "idle"}
          >
            Аудио звонок
          </button>
          <button
            className={styles.callButton}
            onClick={() => startCall("video")}
            disabled={callStatus !== "idle"}
          >
            Видео звонок
          </button>
          <button
            className={styles.callButtonSecondary}
            onClick={toggleMic}
            disabled={callStatus !== "active"}
          >
            {isMicMuted ? "Включить микрофон" : "Выключить микрофон"}
          </button>
          <button
            className={styles.callButtonSecondary}
            onClick={toggleCamera}
            disabled={callStatus !== "active" || callMode !== "video"}
          >
            {isCameraOff ? "Включить камеру" : "Выключить камеру"}
          </button>
          <button
            className={styles.callButtonDanger}
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
      </section>
      <section className={styles.chatHeader}>
        <div>
          <h2 className={styles.chatTitle}>Локальный чат</h2>
          <p className={styles.chatSubtitle}>
            Backend: {API_BASE_URL}. Подключайте локальный LLM через переменные окружения.
          </p>
        </div>
        <button
          className={styles.promptToggle}
          onClick={() => setIsPromptVisible((prev) => !prev)}
        >
          {isPromptVisible ? "Скрыть инструкцию" : "Показать инструкцию"}
        </button>
      </section>
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
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            Start a conversation with Presidium Core
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${
                msg.sender === "user" ? styles.userMessage : styles.serverMessage
              }`}
            >
              <div className={styles.messageText}>{msg.text}</div>
              <div className={styles.messageTime}>
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles.inputContainer}>
        <input
          type="text"
          className={styles.input}
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isSending}
        />
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={!inputValue.trim() || isSending}
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
};

export default App;
