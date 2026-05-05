import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, Plus } from "lucide-react";

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link to="/" className="font-semibold">
            Mini CRM SDR
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Kanban</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/campaigns">Campanhas</Link>
            </Button>
            <Button asChild size="sm" className="gap-1">
              <Link to="/leads/new">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo lead</span>
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/settings/funnel">Funil</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/custom-fields">Campos personalizados</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </nav>
        </div>
      </header>
      <main key={location.pathname} className="container py-6">
        {children}
      </main>
    </div>
  );
};