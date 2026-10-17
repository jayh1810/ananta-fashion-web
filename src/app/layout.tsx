import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Suspense } from "react";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import type { AnnouncementBarInitial } from "@/components/AnnouncementBar";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { CheckoutModal } from "@/components/CheckoutModal";
import { CartSync } from "@/components/CartSync";
import { WishlistSync } from "@/components/WishlistSync";
import { LoginModal } from "@/components/LoginModal";
import { StoreOfferProvider } from "@/components/StoreOfferProvider";
import { ToastHost } from "@/components/Toast";
import { DynamicFavicon } from "@/components/DynamicFavicon";
import { SiteBrandingProvider } from "@/components/SiteBrandingProvider";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { JourneyAnalyticsTracker } from "@/components/JourneyAnalyticsTracker";
import { MetaPixel } from "@/components/MetaPixel";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { Recaptcha } from "@/components/Recaptcha";
import { OrganizationJsonLd } from "@/components/OrganizationJsonLd";
import { BRAND } from "@/lib/api";
import type { CacheShape } from "@/lib/site-branding";
import { metadataForPath, SITE_URL, fetchHeaderMenus, fetchFooterMenus, fetchFooterCollections } from "@/lib/seo";
import { brandCssVars, DEFAULT_BRAND_COLOR, normalizeBrandHex } from "@/lib/brand-color";
import { getCachedSettings, toStoreOfferConfig } from "@/lib/settings";
import { themeCssVars } from "@/lib/theme";
import { DeferredClientChrome } from "@/components/DeferredClientChrome";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const SITE_ICONS = {
  icon: [
    { url: "/android-icon-192x192.png", sizes: "192x192", type: "image/png" },
    { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    { url: "/favicon.ico" },
  ],
  shortcut: "/favicon.ico",
  apple: [
    { url: "/apple-icon-57x57.png", sizes: "57x57" },
    { url: "/apple-icon-60x60.png", sizes: "60x60" },
    { url: "/apple-icon-72x72.png", sizes: "72x72" },
    { url: "/apple-icon-76x76.png", sizes: "76x76" },
    { url: "/apple-icon-114x114.png", sizes: "114x114" },
    { url: "/apple-icon-120x120.png", sizes: "120x120" },
    { url: "/apple-icon-144x144.png", sizes: "144x144" },
    { url: "/apple-icon-152x152.png", sizes: "152x152" },
    { url: "/apple-icon-180x180.png", sizes: "180x180" },
  ],
  other: [
    {
      rel: "apple-touch-icon-precomposed",
      url: "/apple-icon-precomposed.png",
    },
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: DEFAULT_BRAND_COLOR },
    { media: "(prefers-color-scheme: dark)", color: DEFAULT_BRAND_COLOR },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const fallbackTitle = `${BRAND} – Shop Fashion, Beauty & Lifestyle Online`;
  const fallbackDescription = `Shop the latest fashion, beauty and lifestyle products online at ${BRAND}. Top brands, genuine products, easy returns and fast delivery across India.`;

  const base: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
      default: fallbackTitle,
      template: `%s | ${BRAND}`,
    },
    description: fallbackDescription,
    icons: SITE_ICONS,
    other: {
      "msapplication-TileColor": DEFAULT_BRAND_COLOR,
      "msapplication-TileImage": "/ms-icon-144x144.png",
    },
  };

  try {
    const settings = await getCachedSettings();
    const name = settings.siteName || BRAND;
    const home = await metadataForPath("/", {
      title: `${name} – Shop Fashion, Beauty & Lifestyle Online`,
      description: fallbackDescription,
    });
    const icons: Metadata["icons"] = settings.faviconUrl
      ? {
          ...SITE_ICONS,
          icon: [...SITE_ICONS.icon, { url: settings.faviconUrl }],
          apple: [...SITE_ICONS.apple, { url: settings.faviconUrl }],
        }
      : SITE_ICONS;
    return {
      ...base,
      ...home,
      title: {
        default:
          (typeof home.title === "string" && home.title) ||
          `${name} – Shop Fashion, Beauty & Lifestyle Online`,
        template: `%s | ${name}`,
      },
      icons,
    };
  } catch {
    return base;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const settings = await getCachedSettings();
  const branding: CacheShape = {
    siteName: settings.siteName,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    brandColor: settings.brandColor,
  };
  const storeOffer = toStoreOfferConfig(settings);
  const [headerLinks, footerCollections, footerMenus] = await Promise.all([
    fetchHeaderMenus(),
    fetchFooterCollections(),
    fetchFooterMenus(),
  ]);
  const brand = normalizeBrandHex(branding.brandColor);
  // Inline on <html> so SSR + client React props match (avoids hydration mismatch
  // when client branding later updates the same CSS variables).
  const brandStyle = {
    ...(brandCssVars(brand) as CSSProperties),
    ...themeCssVars(settings.theme),
  };

  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
      style={brandStyle}
    >
      <body className="min-h-full flex flex-col font-sans">
        <OrganizationJsonLd />
        <SiteBrandingProvider initial={branding}>
          <StoreOfferProvider value={storeOffer}>
            <DynamicFavicon />
            <AnnouncementBar
              initial={settings.announcements}
              topLinks={settings.theme.topLinks}
            />
            <Header initialLinks={headerLinks} />
            <main className="flex-1 min-w-0 overflow-x-clip">{children}</main>
            <Footer
              initialCollections={footerCollections}
              initialStore={settings.store}
              theme={settings.theme}
              menus={footerMenus}
            />
          <CartDrawer />
          <CheckoutModal />
          <CartSync />
          <WishlistSync />
          <LoginModal />
          <DeferredClientChrome />
          <ToastHost />
            <Suspense fallback={null}>
              <AnalyticsTracker />
              <JourneyAnalyticsTracker />
              <GoogleAnalytics />
              <Recaptcha />
              <MetaPixel />
            </Suspense>
          </StoreOfferProvider>
        </SiteBrandingProvider>
      </body>
    </html>
  );
}
