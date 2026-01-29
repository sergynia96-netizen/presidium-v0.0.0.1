/**
 * React Hook for P2P WebRTC
 * 
 * Hook для использования P2P WebRTC в React компонентах
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCPeer, P2PMessage, PeerStatus } from '../p2p/WebRTCPeer';
import { PQCCryptoBrowser } from '../crypto/pqc-browser';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
// Construct WebSocket URL for signaling server (always root /p2p-signaling)
const WS_URL = (() => {
  try {
    const apiUrl = new URL(API_BASE_URL);
    const wsOrigin = apiUrl.origin.replace('https://', 'wss://').replace('http://', 'ws://');
    return `${wsOrigin}/p2p-signaling`;
  } catch {
    // Fallback for invalid or relative API_BASE_URL
    const fallback = API_BASE_URL.startsWith('https://')
      ? API_BASE_URL.replace('https://', 'wss://')
      : API_BASE_URL.replace('http://', 'ws://');
    return `${fallback}/p2p-signaling`;
  }
})();

export interface UseP2PReturn {
  peer: WebRTCPeer | null;
  connected: boolean;
  peers: string[];
  peerStatus: Map<string, PeerStatus>;
  sendMessage: (to: string, type: string, payload: any) => Promise<boolean>;
  localPeerId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * Hook for P2P WebRTC
 */
export function useP2P(): UseP2PReturn {
  const [peer, setPeer] = useState<WebRTCPeer | null>(null);
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);
  const [peerStatus, setPeerStatus] = useState<Map<string, PeerStatus>>(new Map());
  const [localPeerId, setLocalPeerId] = useState<string | null>(null);
  const peerRef = useRef<WebRTCPeer | null>(null);
  const cryptoRef = useRef<PQCCryptoBrowser | null>(null);

  /**
   * Connect to P2P network
   */
  const connect = useCallback(async (): Promise<void> => {
    if (peerRef.current) {
      return; // Already connected
    }

    try {
      // Initialize crypto
      cryptoRef.current = new PQCCryptoBrowser();
      await cryptoRef.current.generateKeyPair();

      // Create P2P peer
      const p2pPeer = new WebRTCPeer(WS_URL, undefined, cryptoRef.current);
      peerRef.current = p2pPeer;

      // Set up message handler
      p2pPeer.onMessage((message: P2PMessage) => {
        console.log('📨 Received P2P message:', message);
      });

      // Set up peer status handler
      p2pPeer.onPeerStatus((status: PeerStatus) => {
        setPeerStatus((prev) => {
          const next = new Map(prev);
          next.set(status.id, status);
          
          // Update peers list from all peer statuses
          const allConnectedPeers: string[] = [];
          for (const [id, peerStatus] of next.entries()) {
            if (peerStatus.connected) {
              allConnectedPeers.push(id);
            }
          }
          setPeers(allConnectedPeers);
          
          return next;
        });
      });

      // Connect to signaling server
      try {
        await p2pPeer.connect();
        setPeer(p2pPeer);
        setConnected(true);
        setLocalPeerId(p2pPeer.getLocalPeerId());
        console.log('✅ P2P client connected and ready');
      } catch (error) {
        console.error('Failed to connect to signaling server:', error);
        // Still set peer but mark as not connected
        setPeer(p2pPeer);
        setConnected(false);
        setLocalPeerId(p2pPeer.getLocalPeerId());
        // Don't throw - allow component to continue, will retry
      }
    } catch (error) {
      console.error('Failed to connect to P2P network:', error);
      setConnected(false);
    }
  }, []);

  /**
   * Disconnect from P2P network
   */
  const disconnect = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.disconnect();
      peerRef.current = null;
      setPeer(null);
      setConnected(false);
      setPeers([]);
      setPeerStatus(new Map());
      setLocalPeerId(null);
    }
  }, []);

  /**
   * Send message to peer
   */
  const sendMessage = useCallback(
    async (to: string, type: string, payload: any): Promise<boolean> => {
      if (!peerRef.current) {
        console.warn('P2P peer not connected');
        return false;
      }

      return await peerRef.current.sendMessage(to, type, payload);
    },
    []
  );

  /**
   * Connect on mount
   */
  useEffect(() => {
    connect().catch((error) => {
      console.error('P2P connection error:', error);
    });

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    peer,
    connected,
    peers,
    peerStatus,
    sendMessage,
    localPeerId,
    connect,
    disconnect,
  };
}
