import { getImageProps } from "next/image";

/** Must match ProductDetail main gallery `<Image sizes=… />`. */
export const PRODUCT_HERO_SIZES = "(max-width:1024px) 100vw, 50vw";
/** Must be listed in next.config `images.qualities`. */
export const PRODUCT_HERO_QUALITY = 90;

export function getProductHeroImgProps(src: string, alt = "") {
  return getImageProps({
    src,
    alt,
    fill: true,
    sizes: PRODUCT_HERO_SIZES,
    quality: PRODUCT_HERO_QUALITY,
    priority: true,
  }).props;
}

/** Server / ReactDOM.preload — uses optimized `/_next/image` URL, not the raw CDN. */
export function productHeroPreloadArgs(src: string) {
  const props = getProductHeroImgProps(src);
  return {
    href: props.src,
    imageSrcSet: props.srcSet,
    imageSizes: props.sizes,
    fetchPriority: "high" as const,
  };
}

/** Client navigation: start hero download before PDP mounts. */
export function warmProductHero(src: string) {
  if (typeof document === "undefined" || !src) return;
  try {
    const props = getProductHeroImgProps(src);
    const links = document.head.querySelectorAll('link[rel="preload"][as="image"]');
    for (const node of links) {
      if ((node as HTMLLinkElement).href === props.src) return;
    }
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = props.src;
    if (props.srcSet) link.setAttribute("imagesrcset", props.srcSet);
    if (props.sizes) link.setAttribute("imagesizes", props.sizes);
    link.fetchPriority = "high";
    document.head.appendChild(link);
  } catch {
    /* ignore invalid remote URLs */
  }
}
