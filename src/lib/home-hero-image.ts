import { getImageProps } from "next/image";

/** Must match HeroSlider — full-width banner. */
export const HOME_HERO_SIZES = "100vw";
/** Slightly leaner than default 75 — mobile LCP is the full-bleed banner. */
export const HOME_HERO_QUALITY = 70;

export function getHomeHeroImgProps(src: string, alt = "") {
  return getImageProps({
    src,
    alt,
    fill: true,
    sizes: HOME_HERO_SIZES,
    quality: HOME_HERO_QUALITY,
    priority: true,
  }).props;
}

/**
 * Server / ReactDOM.preload — optimized `/_next/image` URL (not raw Contabo).
 * Prefer the mobile banner URL: PSI + real users are mobile-first.
 */
export function homeHeroPreloadArgs(src: string) {
  const props = getHomeHeroImgProps(src);
  return {
    href: props.src,
    imageSrcSet: props.srcSet,
    imageSizes: props.sizes,
    fetchPriority: "high" as const,
  };
}
