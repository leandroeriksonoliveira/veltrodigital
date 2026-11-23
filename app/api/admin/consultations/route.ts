import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifyAdminToken } from '@/lib/conformidade/admin-auth';
import { isDbConfigured } from '@/lib/conformidade/db';
import {
  consultationToListItem,
  consultationsToExcelCsv,
} from '@/lib/conformidade/export-consultations';
import {
  deleteLeadsByIds,
  listConsultationsByIds,
  listRecentConsultations,
  sanitizeLeadIds,
} from '@/lib/conformidade/repository';

function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

function csvResponse(csv: string) {
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

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Banco não configurado (DATABASE_URL / Neon na Vercel)' },
      { status: 503 }
    );
  }

  try {
    const limitRaw = req.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitRaw) || 200, 1), 500);
    const idsParam = req.nextUrl.searchParams.get('ids');
    const selectedIds = idsParam
      ? sanitizeLeadIds(idsParam.split(',').map((s) => s.trim()))
      : [];

    const wantsExport =
      req.nextUrl.searchParams.get('export') === 'excel' ||
      req.nextUrl.searchParams.get('format') === 'csv';

    if (wantsExport) {
      const rows =
        selectedIds.length > 0
          ? await listConsultationsByIds(selectedIds)
          : await listRecentConsultations(limit);
      if (selectedIds.length > 0 && rows.length === 0) {
        return NextResponse.json(
          { error: 'Nenhum dos registros selecionados foi encontrado.' },
          { status: 404 }
        );
      }
      return csvResponse(consultationsToExcelCsv(rows));
    }

    const rows = await listRecentConsultations(limit);
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

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Banco não configurado (DATABASE_URL / Neon na Vercel)' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String((body as { action?: string }).action || '');
    const ids = sanitizeLeadIds((body as { ids?: unknown }).ids);

    if (action === 'export') {
      if (!ids.length) {
        return NextResponse.json(
          { error: 'Selecione ao menos um registro para exportar.' },
          { status: 400 }
        );
      }
      const rows = await listConsultationsByIds(ids);
      if (!rows.length) {
        return NextResponse.json(
          { error: 'Nenhum dos registros selecionados foi encontrado.' },
          { status: 404 }
        );
      }
      return csvResponse(consultationsToExcelCsv(rows));
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Erro ao processar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Banco não configurado (DATABASE_URL / Neon na Vercel)' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const ids = sanitizeLeadIds((body as { ids?: unknown }).ids);
    if (!ids.length) {
      return NextResponse.json(
        { error: 'Selecione ao menos um registro para excluir.' },
        { status: 400 }
      );
    }

    const deleted = await deleteLeadsByIds(ids);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Erro ao excluir';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}