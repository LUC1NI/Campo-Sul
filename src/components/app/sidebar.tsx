"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart, Package, FileText, BarChart3,
  Users, Leaf, LayoutDashboard, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "FUNCIONARIO"] },
  { href: "/vendas", label: "Vendas", icon: ShoppingCart, roles: ["ADMIN", "FUNCIONARIO"] },
  { href: "/estoque", label: "Estoque", icon: Package, roles: ["ADMIN", "FUNCIONARIO"] },
  { href: "/notas", label: "Notas / Recibos", icon: FileText, roles: ["ADMIN", "FUNCIONARIO"] },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["ADMIN"] },
  { href: "/usuarios", label: "Usuários", icon: Users, roles: ["ADMIN"] },
];

interface SidebarProps {
  role: string;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}

export function Sidebar({ role, collapsed = false, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const items = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className={cn(
      "flex-shrink-0 bg-verde-mata flex flex-col h-full transition-all duration-300 ease-in-out overflow-hidden",
      collapsed ? "w-14" : "w-56"
    )}>
      {/* Logo */}
      <div className={cn(
        "border-b border-white/10 flex items-center flex-shrink-0 transition-all duration-300",
        collapsed ? "justify-center py-4 px-0" : "justify-between px-5 py-5"
      )}>
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <Leaf className="w-4 h-4 text-bege" />
          </div>
          {!collapsed && (
            <span className="font-fraunces text-lg font-semibold text-white whitespace-nowrap">CampoSul</span>
          )}
        </Link>
        {!collapsed && onClose && (
          <button onClick={onClose} className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-4 space-y-0.5 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-all",
                collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn(
        "border-t border-white/10 flex items-center flex-shrink-0",
        collapsed ? "justify-center py-3" : "justify-between px-5 py-4"
      )}>
        {!collapsed && <p className="text-white/30 text-xs">v1.0.0</p>}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>
    </aside>
  );
}
