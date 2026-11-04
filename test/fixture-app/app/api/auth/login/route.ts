import { type NextRequest, NextResponse } from 'next/server';

/** Sends the person to an identity provider, naming where to come back to. */
export function GET(request: NextRequest): NextResponse {
  const back = `${request.nextUrl.origin}/api/auth/callback`;
  const login = new URL('https://identity.example.com/authorize');
  login.searchParams.set('redirect_uri', back);
  return NextResponse.redirect(login);
}
