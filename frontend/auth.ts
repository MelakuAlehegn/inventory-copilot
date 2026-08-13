import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { SignJWT } from "jose";

declare module "next-auth" {
  interface Session {
    backendToken: string;
    user: { name?: string | null; email?: string | null; image?: string | null };
  }
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const jwtSecret = new TextEncoder().encode(
  process.env.AUTH_JWT_SECRET ?? "dev-secret-change-in-production"
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Verify email/password against the backend, which owns the users table.
      async authorize(credentials) {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(credentials?.email ?? ""),
            password: String(credentials?.password ?? ""),
          }),
        });
        if (!res.ok) return null;
        const user = await res.json(); // { id, email, name }
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" }, // required for the Credentials provider
  pages: { signIn: "/login" },
  callbacks: {
    async session({ session, token }) {
      // Mint a compact HS256 Bearer token for the FastAPI backend (same for both providers).
      const backendToken = await new SignJWT({
        sub: token.sub ?? "",
        email: token.email ?? "",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(jwtSecret);

      session.backendToken = backendToken;
      return session;
    },
  },
});
