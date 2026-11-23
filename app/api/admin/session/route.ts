import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { COOKIE_NAME, verifyAdminToken } from '@/lib/conformidade/admin-auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return NextResponse.json({ authenticated: verifyAdminToken(token) });
}