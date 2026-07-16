import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

type Sql = NeonQueryFunction<false, false>;

let _sql: Sql | null = null;

/** Vercel Neon injeta DATABASE_URL ou POSTGRES_URL */
export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

export function isDbConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

export function getSql(): Sql {
  if (_sql) return _sql;
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      'Postgres não configurado. Defina DATABASE_URL (Neon / Vercel Storage).'
    );
  }
  _sql = neon(url);
  return _sql;
}
