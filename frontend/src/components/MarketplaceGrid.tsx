import React from "react";

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

type SellerReputation = {
  trust: number;
  reputation: number;
  rating: number;
};

type MarketplaceGridProps = {
  items: MarketplaceItem[];
  sellerReputation: Record<string, SellerReputation | null>;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  onPurchase: (itemId: string) => void;
  purchasingItemId?: string | null;
};

const MarketplaceGrid: React.FC<MarketplaceGridProps> = ({
  items,
  sellerReputation,
  activeCategory,
  onCategoryChange,
  sortOrder,
  onSortChange,
  onPurchase,
  purchasingItemId,
}) => {
  const categories = ["all", "hardware", "software", "service"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className="px-4 py-2 text-[10px] uppercase tracking-[0.3em] border"
              style={{
                borderColor: activeCategory === category ? "#FF3D00" : "#333333",
                color: activeCategory === category ? "#FF3D00" : "#666666",
                background: activeCategory === category ? "#0B0B0B" : "#050505",
              }}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em]">
          <span style={{ color: "#666666" }}>Sort</span>
          <button
            className="border px-3 py-2"
            style={{
              borderColor: sortOrder === "asc" ? "#00FFFF" : "#333333",
              color: sortOrder === "asc" ? "#00FFFF" : "#666666",
            }}
            onClick={() => onSortChange("asc")}
          >
            ASC
          </button>
          <button
            className="border px-3 py-2"
            style={{
              borderColor: sortOrder === "desc" ? "#00FFFF" : "#333333",
              color: sortOrder === "desc" ? "#00FFFF" : "#666666",
            }}
            onClick={() => onSortChange("desc")}
          >
            DESC
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {items.map((item) => {
          const reputation = sellerReputation[item.sellerId];
          return (
            <div
              key={item.id}
              className="border p-4 flex flex-col gap-4"
              style={{ borderColor: "#222222", background: "#050505" }}
            >
              <div
                className="h-40 border flex items-center justify-center text-xs uppercase tracking-[0.4em]"
                style={{ borderColor: "#333333", color: "#666666", background: "#0B0B0B" }}
              >
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#00FFFF" }}>
                  {item.name}
                </div>
                <div className="text-xs" style={{ color: "#666666" }}>
                  {item.description}
                </div>
                <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#00FF41" }}>
                  {item.price.toFixed(2)} {item.currency}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em]">
                <div>
                  <div style={{ color: "#666666" }}>Seller</div>
                  <div style={{ color: "#E5E5E5" }}>{item.sellerName}</div>
                </div>
                <div className="text-right">
                  <div style={{ color: "#666666" }}>Rep</div>
                  <div style={{ color: reputation ? "#00FF41" : "#666666" }}>
                    {reputation ? `${reputation.reputation} / ${reputation.rating.toFixed(1)}` : "--"}
                  </div>
                </div>
              </div>

              <button
                className="border px-4 py-2 text-[10px] uppercase tracking-[0.4em]"
                style={{
                  borderColor: item.available ? "#FF3D00" : "#333333",
                  color: item.available ? "#FF3D00" : "#666666",
                }}
                onClick={() => onPurchase(item.id)}
                disabled={!item.available || purchasingItemId === item.id}
              >
                {purchasingItemId === item.id ? "Processing" : "Purchase"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketplaceGrid;
