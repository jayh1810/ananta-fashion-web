"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, BRAND } from "@/lib/api";
import { useSiteBranding } from "@/lib/site-branding";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { CopilotLauncher } from "@/components/copilot/CopilotLauncher";
import { BrandLogo } from "@/components/BrandLogo";
import { PaymentMethodIcons } from "@/components/PaymentMethodIcons";
import type { MenuNode } from "@/lib/menu-tree";
import { Mail, Package, Phone } from "lucide-react";
import { ThemeIcon } from "@/components/ThemeIcon";
import { DEFAULT_THEME, type StoreTheme } from "@/lib/theme";

const COMPANY_NAME = "Ananta Labs";
const BRAND_NAME = BRAND;

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M14 13.5h2.5l.5-3H14v-1.8c0-.9.2-1.5 1.5-1.5H17V4.1C16.7 4.1 15.7 4 14.6 4 12.1 4 10.4 5.5 10.4 8.2V10.5H8v3h2.4V20h3.6v-6.5z" />
    </svg>
  );
}

import type { AppSettings } from "@/lib/settings";

const collectionsFallback = [
  ["Shop All", "/collections/all"],
  ["Best Sellers", "/collections/bestsellers"],
] as const;

const policiesFallback = [
  ["Contact Us", "/pages/contact"],
  ["Track Order", "/pages/track-order"],
  ["Privacy Policy", "/policies/privacy-policy"],
  ["Return Policy", "/policies/refund-policy"],
  ["Shipping Policy", "/policies/shipping-policy"],
  ["Terms of Service", "/policies/terms-of-service"],
] as const;

const other = [
  ["Blogs", "/blogs"],
  ["FAQs", "/#faqs"],
  ["AI index (llms.txt)", "/llms.txt"],
] as const;

type FooterLink = readonly [label: string, href: string, newTab?: boolean];

function Col({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<FooterLink>;
}) {
  return (
    <div>
      <h3 className="mb-3 text-[14px] font-medium text-white">
        {title}
      </h3>
      <ul className="space-y-2">
        {links.map(([label, href, newTab]) => (
          <li key={`${label}-${href}`}>
            <Link
              href={href}
              {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="text-[12px] text-white/85 transition-colors hover:text-white hover:underline"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const toFooterLink = (n: MenuNode): FooterLink => [n.label, n.href, n.openInNewTab];

export function Footer({
  initialCollections = [],
  initialStore,
  theme = DEFAULT_THEME,
  menus = [],
}: {
  initialCollections?: { name: string; slug: string }[];
  initialStore?: AppSettings["store"];
  theme?: StoreTheme;
  /** Admin footer menu: items with children become columns; flat items replace "More". */
  menus?: MenuNode[];
}) {
  const siteName = useSiteBranding((s) => s.siteName);
  const ensureLoaded = useSiteBranding((s) => s.ensureLoaded);
  const [store, setStore] = useState<Partial<AppSettings["store"]>>(
    initialStore || {},
  );
  const hasServerCollections = initialCollections.length > 0;
  const [collectionLinks, setCollectionLinks] = useState<
    ReadonlyArray<readonly [string, string]>
  >(() =>
    initialCollections.length
      ? initialCollections.map(
          (c) => [c.name, `/collections/${c.slug}`] as [string, string],
        )
      : collectionsFallback,
  );

  useEffect(() => {
    void ensureLoaded();
    const hasStoreSeed = Boolean(initialStore && Object.keys(initialStore).length);
    if (!hasStoreSeed) {
      api<{ store?: AppSettings["store"] }>("/settings")
        .then((s) => {
          setStore(s.store || {});
        })
        .catch(() => {});
    }
    if (hasServerCollections) return;
    api<{ id: string; name: string; slug: string }[] | { data?: { name: string; slug: string }[] }>(
      "/collections",
    )
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : Array.isArray((res as any)?.data)
            ? (res as any).data
            : [];
        if (!list.length) return;
        setCollectionLinks(
          list
            .slice(0, 12)
            .map(
              (c: { name: string; slug: string }) =>
                [c.name, `/collections/${c.slug}`] as [string, string],
            ),
        );
      })
      .catch(() => {});
  }, [ensureLoaded, hasServerCollections, initialStore]);

  const name = siteName || BRAND;
  const about =
    store?.footerAbout?.length
      ? store.footerAbout
      : [
          `${name} is your destination for fashion, beauty and lifestyle products from top brands.`,
          `Support: ${store?.supportHours || "Mon–Sat, 10AM – 7PM"}`,
        ];

  const cmsPolicyLinks = (store?.pages || [])
    .filter((p) => p.published !== false && p.showInFooter !== false && p.slug)
    .map((p) => [p.title, `/policies/${p.slug}`] as [string, string]);

  const policies: ReadonlyArray<readonly [string, string]> = [
    ["Contact Us", "/pages/contact"],
    ["Track Order", "/pages/track-order"],
    ...(cmsPolicyLinks.length
      ? cmsPolicyLinks
      : policiesFallback.slice(2).map(([a, b]) => [a, b] as [string, string])),
  ];

  const menuColumns = menus.filter((n) => n.children?.length);
  const menuFlat = menus.filter((n) => !n.children?.length).map(toFooterLink);
  const columnCount = 2 + menuColumns.length + 1;

  const phoneHref = store?.phone
    ? store.phoneHref || `tel:${store.phone.replace(/\s+/g, "")}`
    : "";
  const hasSocial = Boolean(store?.socialInstagram || store?.socialFacebook);

  return (
    <>
      <footer className="mt-auto overflow-hidden">
        {theme.footerContactBand ? (
        <div className="bg-[var(--footer-contact-bg)] text-white">
          <div className="mx-auto grid max-w-[1200px] gap-5 px-4 py-6 sm:grid-cols-3 sm:gap-8 lg:px-6 lg:py-8">
            <Link href="/pages/track-order" className="group flex items-start gap-3">
              <Package size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="block text-[13px] font-medium uppercase tracking-wide">
                  Track your order
                </span>
                <span className="mt-1 block text-[12px] text-white/70 group-hover:text-white">
                  Check delivery status anytime ›
                </span>
              </span>
            </Link>
            <div className="flex items-start gap-3">
              <Mail size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="block text-[13px] font-medium uppercase tracking-wide">
                  Write to us
                </span>
                {store?.email ? (
                  <a
                    href={`mailto:${store.email}`}
                    className="mt-1 block break-all text-[12px] text-white/70 hover:text-white hover:underline"
                  >
                    {store.email}
                  </a>
                ) : (
                  <Link
                    href="/pages/contact"
                    className="mt-1 block text-[12px] text-white/70 hover:text-white hover:underline"
                  >
                    Contact us ›
                  </Link>
                )}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Phone size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="block text-[13px] font-medium uppercase tracking-wide">
                  For any help, you may call us at
                </span>
                {store?.phone ? (
                  <a href={phoneHref} className="mt-1 block text-[13px] hover:underline">
                    {store.phone}
                  </a>
                ) : null}
                <span className="mt-0.5 block text-[12px] text-white/70">
                  ({store?.supportHours || "Mon–Sat, 10AM – 7PM"})
                </span>
              </span>
            </div>
          </div>
        </div>
        ) : null}

        <div className="bg-[var(--footer-links-bg)] text-white">
          <div className="mx-auto max-w-[1200px] px-4 py-10 lg:px-6">
            <div className="grid gap-10 lg:grid-cols-[minmax(220px,1fr)_minmax(0,3fr)]">
              <div>
                <BrandLogo
                  name={name || BRAND_NAME}
                  tagline={store?.footerTagline || "Fashion & Beauty"}
                  size="md"
                  href="/"
                  dark
                />
                <p className="mt-3 text-[12px] text-white/70">
                  A brand of <span className="text-white">{COMPANY_NAME}</span>
                </p>
                <div className="mt-4 space-y-2.5 text-[12px] leading-relaxed text-white/75">
                  {about.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>

              <div
                className={`grid grid-cols-2 gap-8 md:grid-cols-3 ${
                  columnCount >= 4 ? "xl:grid-cols-4" : ""
                }`}
              >
                <Col title="Shop" links={collectionLinks} />
                <Col title="Help" links={policies} />
                {menuColumns.map((n) => (
                  <Col
                    key={`${n.label}-${n.href}`}
                    title={n.label}
                    links={n.children!.map(toFooterLink)}
                  />
                ))}
                <Col title="More" links={menuFlat.length ? menuFlat : other} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--footer-trust-bg)]">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 lg:flex-row lg:items-center lg:px-6">
            {theme.footerTrust.length ? (
            <ul
              className={`grid flex-1 grid-cols-2 gap-x-4 gap-y-6 ${
                theme.footerTrust.length > 4 ? "lg:grid-cols-3" : "lg:grid-cols-4"
              }`}
            >
              {theme.footerTrust.map(({ title, body, icon }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white">
                    <ThemeIcon name={icon} size={20} strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block border-b border-line pb-1.5 text-[13px] font-semibold uppercase text-ink">
                      {title}
                    </span>
                    {body ? (
                      <span className="mt-1.5 block text-[12px] leading-snug text-muted">{body}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            ) : (
              <div className="flex-1" />
            )}
            {hasSocial ? (
              <div className="shrink-0 text-center lg:w-[200px]">
                <p className="text-[13px] font-semibold text-ink">
                  Show us some love <span className="text-brand">❤</span> on social media
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  {store?.socialInstagram && (
                    <a
                      href={store.socialInstagram}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-brand"
                      aria-label="Instagram"
                    >
                      <InstagramIcon size={15} />
                    </a>
                  )}
                  {store?.socialFacebook && (
                    <a
                      href={store.socialFacebook}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-brand"
                      aria-label="Facebook"
                    >
                      <FacebookIcon size={15} />
                    </a>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-[var(--footer-bottom-bg)] text-white">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-2.5 px-4 py-4 text-center text-[12px] lg:px-6">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-medium">
              <Link href="/policies/terms-of-service" className="hover:underline">
                Terms &amp; Conditions
              </Link>
              <Link href="/policies/shipping-policy" className="hover:underline">
                Shipping Policy
              </Link>
              <Link href="/policies/refund-policy" className="hover:underline">
                Return Policy
              </Link>
              <Link href="/policies/privacy-policy" className="hover:underline">
                Privacy Policy
              </Link>
              <Link href="/llms.txt" className="hover:underline">
                llms.txt
              </Link>
            </div>
            <p className="text-white/90">
              © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
              <span className="mx-1.5 text-white/60">·</span>
              {name || BRAND_NAME}
            </p>
            <PaymentMethodIcons />
          </div>
        </div>
      </footer>
      <WhatsAppFab />
      <CopilotLauncher />
    </>
  );
}
