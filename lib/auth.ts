import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "CMS Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim();
        const password = credentials?.password?.toString() ?? "";

        const adminEmail = process.env.CMS_ADMIN_EMAIL?.trim();
        const adminPassword = process.env.CMS_ADMIN_PASSWORD ?? "";
        const adminPasswordHash = process.env.CMS_ADMIN_PASSWORD_HASH?.trim();

        if (!adminEmail || (!adminPassword && !adminPasswordHash)) {
          return null;
        }

        if (email !== adminEmail) {
          return null;
        }

        const passwordOk = adminPasswordHash
          ? await compare(password, adminPasswordHash)
          : password === adminPassword;

        if (!passwordOk) {
          return null;
        }

        return {
          id: "cms-admin",
          email: adminEmail,
          name: "CMS Admin",
        };
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth: session, request }) {
      const pathname = request.nextUrl.pathname;
      if (pathname === "/admin/login") {
        return true;
      }
      if (pathname.startsWith("/admin")) {
        return Boolean(session);
      }
      return true;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
