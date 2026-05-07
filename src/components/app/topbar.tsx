"use client";

import { signOut } from "next-auth/react";
import { LogOut, User, Menu, PanelLeftClose, PanelLeftOpen, ExternalLink } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";

interface TopbarProps {
  user: { name: string; email: string; role: string };
  onMenuToggle?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function Topbar({ user, onMenuToggle, sidebarCollapsed, onToggleSidebar }: TopbarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="h-10 bg-white border-b border-border flex items-center justify-between px-3 desk:px-4 flex-shrink-0">
      <div className="flex items-center gap-1">
        {/* Mobile: hamburger */}
        <button
          className="desk:hidden p-1.5 -ml-1 rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
          onClick={onMenuToggle}
          aria-label="Abrir menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Desktop: collapse toggle */}
        {onToggleSidebar && (
          <button
            className="hidden desk:flex p-1.5 rounded-lg text-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen className="w-4 h-4" />
              : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Abrir em nova aba */}
      <button
        onClick={() => window.open(pathname, "_blank")}
        title="Abrir esta tela em nova aba"
        className="p-1.5 rounded-lg text-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-full bg-verde-mata/10 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-verde-mata" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="font-medium text-foreground text-xs">{user.name}</div>
            <div className="text-muted-foreground text-xs">{user.role === "ADMIN" ? "Administrador" : "Funcionário"}</div>
          </div>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-10 z-20 bg-white rounded-lg shadow-lg border border-border py-1 min-w-40">
              <div className="px-3 py-2 border-b border-border">
                <div className="text-xs font-medium text-foreground">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
