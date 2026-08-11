import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { SignJWT } from "jose";

declare module "next-auth" {
  interface Session {
    backendToken: string;
    user: { name?: string | null; email?: string | null; image?: string | null };
  }
}

const jwtSecret = new TextEncoder().encode(
  process.env.AUTH_JWT_SECRET ?? "dev-secret-change-in-production"
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async session({ session, token }) {
      // Mint a compact HS256 Bearer token for the FastAPI backend
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
