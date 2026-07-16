import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPassword, createAdminToken, COOKIE_NAME } from '@/lib/conformidade/admin-auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password || '');
  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
  }
  const token = createAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
