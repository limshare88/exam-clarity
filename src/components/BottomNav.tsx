import { Link } from "@tanstack/react-router";
import { Home, BookOpen, Sparkles, Settings, Upload } from "lucide-react";

const ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/practice", label: "Practice", icon: BookOpen },
  { to: "/shop", label: "Shop", icon: Sparkles },
  { to: "/admin", label: "Upload", icon: Upload },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl items-stretch justify-between px-2 py-2">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-xs font-semibold tracking-wide text-muted-foreground transition-colors hover:bg-lavender"
              activeProps={{ className: "bg-lavender text-lavender-foreground" }}
            >
              <Icon className="h-6 w-6" aria-hidden />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
