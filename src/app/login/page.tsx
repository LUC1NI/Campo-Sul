"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Leaf, Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [showPass, setShowPass] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setErro("");
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setErro("E-mail ou senha incorretos. Após 5 tentativas erradas, o acesso fica bloqueado por 15 minutos.");
      } else if (result?.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setErro("Erro ao conectar. Tente novamente.");
      }
    } catch {
      setErro("Erro inesperado. Verifique sua conexão e tente novamente.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-verde-mata to-verde-claro p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-verde-mata">
              <Leaf className="h-7 w-7 text-bege" />
            </div>
            <h1 className="font-fraunces text-2xl font-bold text-verde-mata">CampoSul</h1>
            <p className="mt-1 text-sm text-foreground/60">Acesso ao sistema</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/80">E-mail</label>
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                autoFocus
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm transition-all focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
                placeholder="seu@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/80">Senha</label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 pr-10 text-sm transition-all focus:border-verde-mata focus:outline-none focus:ring-2 focus:ring-verde-mata/30"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {erro && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-verde-mata py-2.5 font-medium text-white transition-colors hover:bg-verde-claro disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-white/60 transition-colors hover:text-white/90">
            ← Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
