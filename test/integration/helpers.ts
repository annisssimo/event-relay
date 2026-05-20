export async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 15_000,
  intervalMs = 200,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

export async function applyMigration(databaseUrl: string): Promise<void> {
  const { Client } = await import('pg');
  const fs = await import('fs');
  const path = await import('path');
  const sql = fs.readFileSync(
    path.join(__dirname, '../../migrations/001_init.sql'),
    'utf8',
  );
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
