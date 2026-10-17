import {
  Briefcase,
  Coins,
  Flame,
  Gem,
  Gift,
  Heart,
  House,
  Leaf,
  Package,
  RotateCcw,
  Shield,
  Sparkles,
  Sun,
  Truck,
  type LucideIcon,
} from "lucide-react";

/** Suggestions are admin / collection driven, so the icon is picked from keywords; first match wins. */
const RULES: [RegExp, LucideIcon][] = [
  [/best\s*sell|popular|trending|top\b/i, Flame],
  [/money|wealth|dhan|prosper|rich|finance|paisa|paise/i, Coins],
  [/love|relationship|marriage|shaadi|partner|girlfriend|boyfriend|wife|husband/i, Heart],
  [/home|house|office|decor/i, House],
  [/gift|present|parents|mother|father/i, Gift],
  [/protect|evil\s*eye|nazar|negativ|raksha/i, Shield],
  [/career|job|business|success|naukri/i, Briefcase],
  [/health|peace|calm|stress|anxiety|sleep|heal/i, Leaf],
  [/jewel|bracelet|ring|necklace|earring/i, Gem],
  [/combo|bundle|set\b/i, Package],
  [/deliver|shipping|track|order/i, Truck],
  [/return|refund|exchange|replace/i, RotateCcw],
  [/luck|courage|energy|power/i, Sun],
];

export function suggestionIcon(text: string): LucideIcon {
  return RULES.find(([re]) => re.test(text))?.[1] ?? Sparkles;
}
