import { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Plus, Sparkles } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Kanban", end: true },
  { to: "/campaigns", label: "Campanhas", end: false },
  { to: "/dashboard", label: "Dashboard", end: false },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const userMeta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  const fullName = userMeta.full_name || userMeta.name || "";
  const displayName = fullName || (user?.email?.split("@")[0] ?? "");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-14 items-center gap-6">
          <Link to="/" className="flex items-center gap-1.5 shrink-0">
            <Sparkles className="h-[22px] w-[22px] text-primary" strokeWidth={2.25} />
            <span className="text-base font-semibold tracking-tight">SDR.ai</span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-6 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "relative py-3 text-sm transition-colors",
                    isActive
                      ? "font-semibold text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm" className="gap-1">
              <Link to="/leads/new">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo lead</span>
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Conta"
                >
                  <UserAvatar email={user?.email} name={fullName} size={32} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
                  <span className="text-sm font-semibold leading-tight">{displayName || "Usuário"}</span>
                  {user?.email && (
                    <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Configurações
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/settings/funnel">Funil</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/custom-fields">Campos personalizados</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav className="container flex items-center gap-4 overflow-x-auto border-t py-2 md:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "shrink-0 text-sm transition-colors",
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main key={location.pathname} className="container py-6">
        {children}
      </main>
    </div>
  );
};
