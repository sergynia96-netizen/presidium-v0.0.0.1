import React, { useState } from "react";
import styles from "./App.module.css";

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "server";
  timestamp: Date;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);

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
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: inputValue })
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
