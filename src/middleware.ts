import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { UserRole } from "@/types/database";

const HOME_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  professional: "/professional/dashboard",
  client: "/client/dashboard",
};

const AREA_BY_PREFIX: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/professional", roles: ["professional"] },
  { prefix: "/client", roles: ["client"] },
];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Sem configuracao do Supabase a aplicacao ainda precisa renderizar a tela
  // de instrucoes; a protecao real acontece no servidor e no RLS.
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const role = (user?.app_metadata?.role ?? null) as UserRole | null;

  if (pathname === "/login" || pathname === "/") {
    if (user && role) {
      return NextResponse.redirect(new URL(HOME_BY_ROLE[role], request.url));
    }
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const area = AREA_BY_PREFIX.find((entry) => pathname.startsWith(entry.prefix));
  if (!area) return response;

  if (!user || !role) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (!area.roles.includes(role)) {
    return NextResponse.redirect(new URL(HOME_BY_ROLE[role], request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todas as rotas exceto assets estaticos e a API (protegida por sessao
     * dentro de cada handler).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
