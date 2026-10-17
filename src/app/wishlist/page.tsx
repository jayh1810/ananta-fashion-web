import type { Metadata } from "next";
import { WishlistView } from "@/components/WishlistView";

export const metadata: Metadata = {
  title: "My Wishlist",
  robots: { index: false, follow: true },
};

export default function WishlistPage() {
  return <WishlistView />;
}
