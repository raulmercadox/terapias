import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Convención `proxy` de Next 16 (reemplaza a `middleware`).
// El handler `.auth` de Auth.js protege las rutas según authConfig.
export default NextAuth(authConfig).auth;

export const config = {
  // Protege todo salvo API de auth, estáticos y archivos públicos.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)",
  ],
};
