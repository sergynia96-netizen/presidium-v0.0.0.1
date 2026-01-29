import React from "react";

type MessageStatus = "SENT" | "DELIVERED" | "READ";

type ChatBubbleProps = {
  text: string;
  time: string;
  isOwn: boolean;
  status?: MessageStatus;
};

const statusColor = (status?: MessageStatus) => {
  switch (status) {
    case "READ":
      return "#00FF41";
    case "DELIVERED":
      return "#00FFFF";
    case "SENT":
      return "#666666";
    default:
      return "#666666";
  }
};

const ChatBubble: React.FC<ChatBubbleProps> = ({ text, time, isOwn, status }) => {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[78%] px-4 py-3 border shadow-[0_0_20px_rgba(255,61,0,0.08)]"
        style={{
          background: isOwn ? "#0B0B0B" : "#050505",
          borderColor: isOwn ? "#FF3D00" : "#222222",
        }}
      >
        <div className="text-sm leading-relaxed" style={{ color: "#E5E5E5" }}>
          {text}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] uppercase tracking-widest">
          <span style={{ color: "#666666" }}>{time}</span>
          {isOwn && (
            <span style={{ color: statusColor(status) }}>{status ?? "SENT"}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
