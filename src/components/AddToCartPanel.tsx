"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Product } from "@/lib/api";
import { useCart } from "@/lib/cart";
export function AddToCartPanel({ product }: { product: Product }) {
  const addItem = useCart((s) => s.addItem);
  const router = useRouter();
  const [qty, setQty] = useState(1);

  function handleAddToCart() {
    addItem(product, qty);
  }

  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm font-medium">Quantity</span>
        <div className="inline-flex items-center border rounded-md">
          <button
            type="button"
            className="p-2"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            <Minus size={16} />
          </button>
          <span className="w-10 text-center font-medium">{qty}</span>
          <button
            type="button"
            className="p-2"
            onClick={() => setQty((q) => q + 1)}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={product.soldOut}
          onClick={handleAddToCart}
          className="flex-1 btn-bhagva py-3.5 text-sm disabled:opacity-40"
        >
          {product.soldOut ? "Sold Out" : "Add to cart"}
        </button>
        <button
          type="button"
          disabled={product.soldOut}
          onClick={() => {
            handleAddToCart();
            router.push("/checkout");
          }}
          className="flex-1 btn-gold py-3.5 text-sm disabled:opacity-40"
        >
          Buy Now
        </button>
      </div>
    </>
  );
}
