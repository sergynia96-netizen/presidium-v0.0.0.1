/**
 * Status API - Frontend API client for system status
 * Connects to backend API at http://localhost:3000
 */

export interface P2PStatus {
  connected: number;
  total: number;
  list: Array<{
    id: string;
    address: string;
    port: number;
    connected: boolean;
    latency?: number;
    lastSeen?: number;
  }>;
}

export interface PQCStatus {
  initialized: boolean;
  algorithm: string;
  keyPairs: number;
  kyberKeySize: number;
  dilithiumKeySize: number;
  production: boolean;
}

export interface SystemStatus {
  crdt: { operations: number; synced: boolean };
  p2p: { peers: number; status: string };
  ai: { loaded: number; memory: string };
  storage: { local: string; distributed: string };
  sync: string;
  monitor: { cpu: number; mem: number };
}

export interface Metrics {
  cpu: {
    usage: number;
  };
  memory: {
    usage: number;
    total: number;
    used: number;
  };
  disk: {
    usage: number;
  };
  network: {
    in: number;
    out: number;
  };
  threads: {
    active: number;
    max: number;
  };
  timestamp: number;
}

export interface HealthStatus {
  status: string;
  timestamp: number;
  uptime: number;
  version: string;
  components: {
    crypto: {
      initialized: boolean;
      algorithm: string;
      keyPairs: number;
      production: boolean;
    };
    signaling: {
      active: boolean;
      connections: number;
      peers: number;
      port: number;
    };
    dht: {
      active: boolean;
      nodes: number;
      buckets: number;
      bootstrapNodes: number;
    };
    p2p: {
      active: boolean;
    };
    storage: {
      active: boolean;
    };
    ai: {
      active: boolean;
    };
  };
}

// API base URL - use environment variable or fallback to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Fetch P2P status from backend
 * @returns Promise<P2PStatus> P2P network status and peer list
 */
export async function fetchP2PStatus(): Promise<P2PStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/peers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch P2P status: ${response.status} ${response.statusText}`);
    }

    const data: P2PStatus = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching P2P status:', error);
    // Return default values on error to allow app to continue functioning
    return {
      connected: 0,
      total: 0,
      list: [],
    };
  }
}

/**
 * Fetch PQC (Post-Quantum Cryptography) status from backend
 * @returns Promise<PQCStatus> PQC crypto status
 */
export async function fetchPQCStatus(): Promise<PQCStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/crypto/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PQC status: ${response.status} ${response.statusText}`);
    }

    const data: PQCStatus = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching PQC status:', error);
    // Return default values on error
    return {
      initialized: false,
      algorithm: 'N/A',
      keyPairs: 0,
      kyberKeySize: 0,
      dilithiumKeySize: 0,
      production: false,
    };
  }
}

/**
 * Fetch system status from backend
 * @returns Promise<SystemStatus> Complete system status
 */
export async function fetchSystemStatus(): Promise<SystemStatus | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch system status: ${response.status} ${response.statusText}`);
    }

    const data: SystemStatus = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching system status:', error);
    return null;
  }
}

/**
 * Fetch system metrics from backend
 * @returns Promise<Metrics> System metrics (CPU, memory, disk, network)
 */
export async function fetchMetrics(): Promise<Metrics | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/metrics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
    }

    const data: Metrics = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return null;
  }
}

/**
 * Fetch health status from backend
 * @returns Promise<HealthStatus> Health status with all components
 */
export async function fetchHealthStatus(): Promise<HealthStatus | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch health status: ${response.status} ${response.statusText}`);
    }

    const data: HealthStatus = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching health status:', error);
    return null;
  }
}
