import React, { useMemo } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { create } from "zustand";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};

type CRDTState = {
  enabled: boolean;
  lastSync: string;
  conflicts: number;
  merged: number;
  status: "synced" | "syncing" | "conflict" | "error";
};

type P2PNode = {
  id: string;
  address: string;
  port: number;
  publicKey: string;
  lastSeen: string;
  status: "online" | "offline" | "syncing";
  latency?: number;
  version: string;
};

type P2PNetwork = {
  totalNodes: number;
  connectedNodes: number;
  activeSessions: number;
  maxSlots: number;
  nodes: P2PNode[];
};

type Reputation = {
  trust: number;
  reputation: number;
  uptime: number;
  transactions: number;
  rating: number;
  lastUpdate: string;
};

type SystemMetrics = {
  activeThreads: number;
  activeSessions: number;
  maxSessions: number;
};

type DashboardStats = {
  crdt: CRDTState;
  p2p: P2PNetwork;
  metrics: SystemMetrics;
  reputation: Reputation;
  timestamp: string;
};

type Transaction = {
  id: string;
  type: "deposit" | "withdraw" | "exchange" | "staking" | "purchase";
  amount: number;
  currency: string;
  timestamp: string;
  status: "pending" | "completed" | "failed";
  description?: string;
};

type Wallet = {
  capital: number;
  currency: string;
  transactions: Transaction[];
  balance: number;
};

type DashboardStore = {
  dashboard: DashboardStats | null;
  wallet: Wallet | null;
  lastUpdated: string | null;
  setDashboard: (data: DashboardStats) => void;
  setWallet: (data: Wallet) => void;
  setLastUpdated: (timestamp: string) => void;
};

const useDashboardStore = create<DashboardStore>((set) => ({
  dashboard: null,
  wallet: null,
  lastUpdated: null,
  setDashboard: (data) => set({ dashboard: data }),
  setWallet: (data) => set({ wallet: data }),
  setLastUpdated: (timestamp) => set({ lastUpdated: timestamp }),
}));

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const fetchDashboard = async (): Promise<ApiResponse<DashboardStats>> => {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`);
  if (!response.ok) {
    throw new Error(`Dashboard fetch failed: ${response.status}`);
  }
  return response.json();
};

const fetchWallet = async (): Promise<ApiResponse<Wallet>> => {
  const response = await fetch(`${API_BASE_URL}/api/economy/wallet`);
  if (!response.ok) {
    throw new Error(`Wallet fetch failed: ${response.status}`);
  }
  return response.json();
};

const formatUptime = (seconds?: number): string => {
  if (seconds === undefined || Number.isNaN(seconds)) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [
    days > 0 ? `${days}d` : null,
    hours > 0 ? `${hours}h` : null,
    `${minutes}m`,
  ].filter(Boolean);
  return parts.join(" ");
};

const formatMoney = (amount?: number, currency?: string): string => {
  if (amount === undefined || Number.isNaN(amount)) return "—";
  return `${amount.toFixed(2)} ${currency || ""}`.trim();
};

const statusColor = (status: CRDTState["status"]) => {
  switch (status) {
    case "synced":
      return "#00FF41";
    case "syncing":
      return "#00FFFF";
    case "conflict":
    case "error":
      return "#FF3D00";
    default:
      return "#666666";
  }
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 5000,
      refetchIntervalInBackground: true,
    },
  },
});

const DashboardContent: React.FC = () => {
  const { dashboard, wallet, lastUpdated, setDashboard, setWallet, setLastUpdated } = useDashboardStore();

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    onSuccess: (payload) => {
      if (payload?.data) {
        setDashboard(payload.data);
        setLastUpdated(payload.timestamp);
      }
    },
  });

  useQuery({
    queryKey: ["wallet"],
    queryFn: fetchWallet,
    onSuccess: (payload) => {
      if (payload?.data) {
        setWallet(payload.data);
      }
    },
  });

  const nodes = dashboard?.p2p.nodes || [];
  const transactions = wallet?.transactions?.slice(0, 5) || [];

  const uptime = useMemo(() => formatUptime(dashboard?.reputation?.uptime), [dashboard?.reputation?.uptime]);

  return (
    <div style={{ backgroundColor: "#050505", color: "#FFFFFF" }} className="min-h-screen w-full px-6 py-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-widest" style={{ color: "#FF3D00" }}>
            INDUSTRIAL CYBERPUNK DASHBOARD
          </h1>
          <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#666666" }}>
            Status feed • {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "loading"}
          </div>
        </header>

        {dashboardQuery.isError && (
          <div className="border px-4 py-3 text-sm" style={{ borderColor: "#FF3D00", color: "#FF3D00" }}>
            Ошибка загрузки /api/dashboard. Проверьте backend.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="border p-4" style={{ borderColor: "#333333", background: "#0B0B0B" }}>
            <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#666666" }}>
              System uptime
            </div>
            <div className="text-3xl font-bold mt-2" style={{ color: "#00FF41" }}>
              {uptime}
            </div>
            <div className="text-xs mt-3" style={{ color: "#00FFFF" }}>
              Active sessions: {dashboard?.metrics?.activeSessions ?? "—"} / {dashboard?.metrics?.maxSessions ?? "—"}
            </div>
          </div>

          <div className="border p-4" style={{ borderColor: "#333333", background: "#0B0B0B" }}>
            <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#666666" }}>
              CRDT sync status
            </div>
            <div className="text-3xl font-bold mt-2" style={{ color: statusColor(dashboard?.crdt?.status || "syncing") }}>
              {dashboard?.crdt?.status?.toUpperCase() || "—"}
            </div>
            <div className="mt-3 text-xs" style={{ color: "#00FFFF" }}>
              Last sync: {dashboard?.crdt?.lastSync ? new Date(dashboard.crdt.lastSync).toLocaleTimeString() : "—"}
            </div>
            <div className="mt-2 text-xs" style={{ color: "#666666" }}>
              Conflicts: {dashboard?.crdt?.conflicts ?? "—"} • Merged: {dashboard?.crdt?.merged ?? "—"}
            </div>
          </div>

          <div className="border p-4" style={{ borderColor: "#333333", background: "#0B0B0B" }}>
            <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#666666" }}>
              Wallet balance
            </div>
            <div className="text-3xl font-bold mt-2" style={{ color: "#00FF41" }}>
              {formatMoney(wallet?.balance, wallet?.currency)}
            </div>
            <div className="text-xs mt-3" style={{ color: "#00FFFF" }}>
              Capital: {formatMoney(wallet?.capital, wallet?.currency)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border p-4" style={{ borderColor: "#333333", background: "#0B0B0B" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#666666" }}>
                Active P2P nodes
              </div>
              <div className="text-xs font-mono" style={{ color: "#00FF41" }}>
                {dashboard?.p2p?.connectedNodes ?? 0}/{dashboard?.p2p?.totalNodes ?? 12}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nodes.map((node) => (
                <div
                  key={node.id}
                  className="p-3 border flex items-center justify-between text-xs"
                  style={{
                    borderColor: node.status === "online" ? "#00FF41" : "#333333",
                    background: "#050505",
                  }}
                >
                  <div>
                    <div className="font-semibold" style={{ color: "#00FFFF" }}>
                      {node.address}:{node.port}
                    </div>
                    <div style={{ color: "#666666" }}>
                      {node.id.slice(0, 8)} • {node.version}
                    </div>
                  </div>
                  <div className="text-right">
                    <div style={{ color: node.status === "online" ? "#00FF41" : "#FF3D00" }}>
                      {node.status.toUpperCase()}
                    </div>
                    <div style={{ color: "#666666" }}>
                      {node.latency ? `${node.latency.toFixed(0)}ms` : "—"}
                    </div>
                  </div>
                </div>
              ))}
              {nodes.length === 0 && (
                <div className="text-xs" style={{ color: "#666666" }}>
                  Нет данных по узлам. Проверьте /api/dashboard.
                </div>
              )}
            </div>
          </div>

          <div className="border p-4" style={{ borderColor: "#333333", background: "#0B0B0B" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#666666" }}>
                Recent transactions
              </div>
              <div className="text-xs font-mono" style={{ color: "#00FFFF" }}>
                {wallet?.transactions?.length ?? 0} total
              </div>
            </div>
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 border text-xs flex items-center justify-between"
                  style={{ borderColor: "#222222", background: "#050505" }}
                >
                  <div>
                    <div className="font-semibold" style={{ color: "#00FFFF" }}>
                      {tx.description || tx.type.toUpperCase()}
                    </div>
                    <div style={{ color: "#666666" }}>
                      {new Date(tx.timestamp).toLocaleTimeString()} • {tx.status}
                    </div>
                  </div>
                  <div className="text-right" style={{ color: tx.status === "completed" ? "#00FF41" : "#FF3D00" }}>
                    {tx.amount.toFixed(2)} {tx.currency}
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-xs" style={{ color: "#666666" }}>
                  Транзакций пока нет.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <DashboardContent />
  </QueryClientProvider>
);

export default Dashboard;
