import React, { useCallback, useEffect, useMemo, useState } from "react";
import MarketplaceGrid from "../components/MarketplaceGrid";

type MarketplaceItem = {
  id: string;
  name: string;
  price: number;
  currency: string;
  category: "hardware" | "software" | "service";
  description: string;
  available: boolean;
  sellerId: string;
  sellerName: string;
  imageUrl: string;
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

type Reputation = {
  trust: number;
  reputation: number;
  rating: number;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const getPlaceholderImage = (id: string) => {
  const gradients = [
    "linear-gradient(135deg, #050505, #1a1a1a)",
    "linear-gradient(135deg, #0b0b0b, #202020)",
    "linear-gradient(135deg, #050505, #141414)",
  ];
  const index = Math.abs(id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % gradients.length;
  const svg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='100%' height='100%' fill='${gradients[index]}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23FF3D00' font-family='monospace' font-size='20'>PRESIDIUM</text></svg>`
  );
  return `data:image/svg+xml;utf8,${svg}`;
};

const fetchMarketplace = async (): Promise<MarketplaceItem[]> => {
  const response = await fetch(`${API_BASE_URL}/api/economy/marketplace`);
  if (!response.ok) {
    throw new Error(`Marketplace fetch failed: ${response.status}`);
  }
  const payload: ApiResponse<any[]> = await response.json();
  const items = payload.data || [];
  return items.map((item) => ({
    ...item,
    sellerId: `seller-${item.id}`,
    sellerName: `Vendor ${item.id.slice(0, 4).toUpperCase()}`,
    imageUrl: getPlaceholderImage(item.id),
  }));
};

const fetchReputation = async (userId: string): Promise<Reputation | null> => {
  const userScoped = `${API_BASE_URL}/api/reputation/${userId}`;
  const fallback = `${API_BASE_URL}/api/reputation`;

  const tryFetch = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload: ApiResponse<any> = await response.json();
    return payload.data || null;
  };

  return (await tryFetch(userScoped)) || (await tryFetch(fallback));
};

const purchaseItem = async (itemId: string): Promise<Transaction> => {
  const response = await fetch(`${API_BASE_URL}/api/economy/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId }),
  });
  if (!response.ok) {
    throw new Error(`Purchase failed: ${response.status}`);
  }
  const payload: ApiResponse<Transaction> = await response.json();
  if (!payload.data) throw new Error("No transaction returned");
  return payload.data;
};

const Marketplace: React.FC = () => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [sellerReputation, setSellerReputation] = useState<Record<string, Reputation | null>>({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [purchasingItemId, setPurchasingItemId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchMarketplace();
        if (!isMounted) return;
        setItems(data);
        const reputations = await Promise.all(
          data.map(async (item) => [item.sellerId, await fetchReputation(item.sellerId)] as const)
        );
        if (!isMounted) return;
        setSellerReputation(Object.fromEntries(reputations));
      } catch {
        if (isMounted) setItems([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const filtered = activeCategory === "all"
      ? items
      : items.filter((item) => item.category === activeCategory);
    return [...filtered].sort((a, b) =>
      sortOrder === "asc" ? a.price - b.price : b.price - a.price
    );
  }, [items, activeCategory, sortOrder]);

  const handlePurchase = useCallback(
    async (itemId: string) => {
      setPurchasingItemId(itemId);
      try {
        await purchaseItem(itemId);
      } finally {
        setPurchasingItemId(null);
      }
    },
    []
  );

  return (
    <div className="min-h-screen w-full" style={{ background: "#050505", color: "#E5E5E5" }}>
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-[0.3em]" style={{ color: "#FF3D00" }}>
              MARKETPLACE GRID
            </h1>
            <div className="text-xs uppercase tracking-[0.4em]" style={{ color: "#666666" }}>
              Industrial Cyberpunk Commerce
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#00FFFF" }}>
            {loading ? "Loading" : `${filteredItems.length} items`}
          </div>
        </header>

        {loading ? (
          <div className="border px-4 py-3 text-xs uppercase tracking-[0.3em]" style={{ borderColor: "#333333", color: "#666666" }}>
            Fetching marketplace data...
          </div>
        ) : (
          <MarketplaceGrid
            items={filteredItems}
            sellerReputation={sellerReputation}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            onPurchase={handlePurchase}
            purchasingItemId={purchasingItemId}
          />
        )}
      </div>
    </div>
  );
};

export default Marketplace;
