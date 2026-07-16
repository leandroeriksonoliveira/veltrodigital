import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifyAdminToken } from '@/lib/conformidade/admin-auth';
import { isDbConfigured } from '@/lib/conformidade/db';
import { getLeadBundle, listLeadsWithReports } from '@/lib/conformidade/repository';

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
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const bundle = await getLeadBundle(id);
      return NextResponse.json(bundle);
    }

    const rows = await listLeadsWithReports(100);
    const reports = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      profession: row.profession,
      profile_url: row.profile_url,
      site_url: row.site_url,
      input_type: row.input_type,
      created_at: row.created_at,
      score_geral: row.score_geral,
      selo: row.selo,
      resumo_para_time_comercial: row.resumo_para_time_comercial,
    }));

    return NextResponse.json({ reports });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Erro ao consultar banco';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
