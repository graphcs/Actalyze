import NextAuth, { NextAuthOptions, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";

// Whitelist of authorized emails
const AUTHORIZED_EMAILS = [
  "johnmahan7@gmail.com",
  "dan@datasyinc.com",
  "johnmaheswaran@datasyinc.com",
];

const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt", // Use JWT for session management (required for serverless)
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Check if email is in whitelist
      if (user.email && AUTHORIZED_EMAILS.includes(user.email.toLowerCase())) {
        return true;
      }

      // Block unauthorized users - they'll be redirected via the error page
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.authorized = user.email ? AUTHORIZED_EMAILS.includes(user.email.toLowerCase()) : false;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // If redirecting back to base URL after auth, send to dashboard
      if (url === baseUrl || url.startsWith(baseUrl + '/api/auth')) {
        return `${baseUrl}/dashboard`;
      }
      // Allow callback URLs on same origin
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // Allow relative paths
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // Default to dashboard
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    error: '/waitlist', // Unauthorized users redirected here
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
