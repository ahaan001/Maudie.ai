import NextAuth from 'next-auth';

// Lightweight JWT-only config for Edge middleware — no Node.js imports (no crypto, no pg).
// The full auth config with Credentials provider lives in src/lib/auth/config.ts.
const { auth } = NextAuth({
  providers: [],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
});

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (!req.auth) {
    if (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/projects') ||
      pathname.startsWith('/settings') ||
      pathname.startsWith('/profile')
    ) {
      return Response.redirect(new URL('/login', req.url));
    }
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*', '/settings/:path*', '/profile', '/profile/:path*'],
};
