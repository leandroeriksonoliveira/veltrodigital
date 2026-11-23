import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifyAdminToken } from '@/lib/conformidade/admin-auth';
import { isDbConfigured } from '@/lib/conformidade/db';
import {
  consultationToListItem,
  consultationsToExcelCsv,
} from '@/lib/conformidade/export-consultations';
import { listRecentConsultations } from '@/lib/conformidade/repository';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Banco não configurado (DATABASE_URL / Neon na Vercel)' },
      { status: 503 }
    );
  }

  try {
    const limitRaw = req.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitRaw) || 200, 1), 500);
    const rows = await listRecentConsultations(limit);

    const wantsExport =
      req.nextUrl.searchParams.get('export') === 'excel' ||
      req.nextUrl.searchParams.get('format') === 'csv';

    if (wantsExport) {
      const csv = consultationsToExcelCsv(rows);
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="consultas-sites-${stamp}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({
      total: rows.length,
      consultations: rows.map(consultationToListItem),
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Erro ao consultar banco';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}