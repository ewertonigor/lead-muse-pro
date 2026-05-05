import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-[hsl(238,75%,60%)]", // indigo
  "bg-[hsl(160,65%,42%)]", // emerald
  "bg-[hsl(38,92%,50%)]",  // amber
  "bg-[hsl(346,77%,55%)]", // rose
  "bg-[hsl(200,85%,52%)]", // sky
  "bg-[hsl(265,70%,60%)]", // violet
  "bg-[hsl(174,65%,42%)]", // teal
  "bg-[hsl(22,90%,55%)]",  // orange
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getInitials(name?: string | null, email?: string | null): string {
  const n = (name ?? "").trim();
  if (n.length > 0) {
    const parts = n.split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || first.toUpperCase();
  }
  const e = (email ?? "").trim();
  if (e.length > 0) {
    const local = e.split("@")[0] ?? "";
    return (local[0] ?? "?").toUpperCase();
  }
  return "?";
}

const SIZE_MAP = {
  20: "h-5 w-5 text-[10px]",
  24: "h-6 w-6 text-[10px]",
  32: "h-8 w-8 text-xs",
  40: "h-10 w-10 text-sm",
} as const;

type Props = {
  email?: string | null;
  name?: string | null;
  size?: 20 | 24 | 32 | 40;
  className?: string;
};

export function UserAvatar({ email, name, size = 32, className }: Props) {
  const seed = (email ?? name ?? "?").toLowerCase();
  const color = PALETTE[hash(seed) % PALETTE.length];
  const initials = getInitials(name, email);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        SIZE_MAP[size],
        color,
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}