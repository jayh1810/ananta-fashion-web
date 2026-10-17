import {
  BadgeCheck,
  CircleHelp,
  Gift,
  Heart,
  Mail,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  ShieldCheck,
  Star,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { ThemeIcon as ThemeIconName } from "@/lib/theme";

const ICONS: Record<ThemeIconName, LucideIcon> = {
  package: Package,
  help: CircleHelp,
  phone: Phone,
  mail: Mail,
  store: Store,
  gift: Gift,
  map: MapPin,
  badge: BadgeCheck,
  returns: RotateCcw,
  shield: ShieldCheck,
  truck: Truck,
  star: Star,
  heart: Heart,
};

export function ThemeIcon({
  name,
  size = 15,
  strokeWidth = 1.75,
  className,
}: {
  name: ThemeIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Icon = ICONS[name] || CircleHelp;
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden
    />
  );
}
