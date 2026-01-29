import React from "react";

type MessageInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
};

const MessageInput: React.FC<MessageInputProps> = ({ value, onChange, onSend, disabled }) => {
  return (
    <div
      className="flex items-center gap-3 border px-4 py-3"
      style={{ borderColor: "#333333", background: "#050505" }}
    >
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Введите сообщение..."
        className="flex-1 bg-transparent outline-none text-sm uppercase tracking-wider"
        style={{ color: "#E5E5E5" }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!disabled) onSend();
          }
        }}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] border"
        style={{
          borderColor: disabled ? "#333333" : "#FF3D00",
          color: disabled ? "#666666" : "#FF3D00",
        }}
      >
        Send
      </button>
    </div>
  );
};

export default MessageInput;
