/**
 * Chat API - Frontend API client for chat functionality
 * Connects to backend API at http://localhost:3000
 */

export interface BackendMessage {
  id: string;
  text: string;
  sender: 'user' | 'server';
  timestamp: string; // ISO 8601 format
}

export interface HistoryResponse {
  history: BackendMessage[];
}

export interface ChatResponse {
  reply: string;
  timestamp: Date;
}

// API base URL - use environment variable or fallback to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Fetch chat history from backend
 * @returns Promise<BackendMessage[]> Array of messages
 */
export async function fetchHistory(): Promise<BackendMessage[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
    }

    const data: HistoryResponse = await response.json();
    return data.history || [];
  } catch (error) {
    console.error('Error fetching chat history:', error);
    // Return empty array on error to allow app to continue functioning
    return [];
  }
}

/**
 * Send a message to the backend and get AI response
 * @param text - Message text to send
 * @returns Promise<ChatResponse> AI reply and timestamp
 */
export async function sendMessage(text: string): Promise<ChatResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: text }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to send message: ${response.status} ${response.statusText}`);
    }

    const data: ChatResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error; // Re-throw to allow component to handle error
  }
}

