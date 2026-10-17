"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StoreOfferConfig } from "@/lib/settings";
import { BRAND } from "@/lib/api";

const DEFAULT: StoreOfferConfig = {
  siteName: BRAND,
  cashbackRibbonEnabled: false,
  defaultCashbackLabel: "",
  packagingEnabled: true,
  packagingText: "",
  returnsEnabled: true,
  returnsText: "",
  cashbackTermsEnabled: false,
  cashbackTerms: "",
  walletEnabled: false,
  cashbackEarnEnabled: false,
  cashbackPercent: 0,
  whyBrandEnabled: true,
  whyBrandHappyCustomersEnabled: true,
  whyBrandCertifiedEnabled: true,
  whyBrandReturnsEnabled: true,
  whyBrandShippingEnabled: true,
  whyBrandHappyCustomers: "",
  whyBrandCertified: "",
  whyBrandReturns: "",
  whyBrandShipping: "",
  reviewsOnProductPage: true,
  reviewsSlider: true,
  reviewsOnCards: true,
  reviewSubmissions: true,
  reviewPhotos: true,
  freeShippingAbovePaise: 99900,
  shippingFlatPaise: 4900,
  pricesIncludeTax: true,
};

const StoreOfferContext = createContext<StoreOfferConfig>(DEFAULT);

export function StoreOfferProvider({
  value,
  children,
}: {
  value: StoreOfferConfig;
  children: ReactNode;
}) {
  return (
    <StoreOfferContext.Provider value={value}>
      {children}
    </StoreOfferContext.Provider>
  );
}

export function useStoreOffer(): StoreOfferConfig {
  return useContext(StoreOfferContext);
}
