export async function notifyCommercial(payload: {
  leadId: string;
  name: string;
  profession: string;
  selo: string;
  score: number;
  resumo: string;
}): Promise<void> {
  if (payload.selo === 'Aprovado') return;

  const webhook = process.env.COMMERCIAL_NOTIFY_WEBHOOK;
  if (!webhook) return;

  const body = {
    text: `🚨 Novo lead com ${payload.selo} (${payload.score}/100)\n` +
      `Nome: ${payload.name}\n` +
      `Profissão: ${payload.profession}\n` +
      `Resumo: ${payload.resumo}\n` +
      `Admin: https://www.veltrodigital.com.br/admin/reports`,
  };

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // notificação não deve quebrar o fluxo
  }
}
