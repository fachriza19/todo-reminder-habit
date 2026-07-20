import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

/**
 * Better Auth server config (PRD §4).
 * Email/password + Google OAuth, backed by the same Turso DB via Drizzle.
 * No email verification / password reset in MVP (locked decision).
 * Sign-up is open (locked decision).
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Trust both local hosts in dev (Chrome resolves localhost->IPv6, so testing
  // often happens on 127.0.0.1). Production trusts BETTER_AUTH_URL by default.
  trustedOrigins:
    process.env.NODE_ENV === "development"
      ? ["http://localhost:3100", "http://127.0.0.1:3100"]
      : [],
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  session: {
    // Cache session data in a signed cookie so getSession() skips the Turso
    // round-trip on most requests. Trade-off: a revoked session stays usable
    // for up to maxAge seconds on cached reads.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  // Ensures Set-Cookie headers work from Server Actions / route handlers.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
