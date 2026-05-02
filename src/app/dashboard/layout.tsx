// Este arquivo é um layout passthrough — o layout real está em src/components/app/app-layout.tsx
// Cada rota protegida importa AppLayout diretamente.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
