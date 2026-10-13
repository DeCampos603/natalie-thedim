import { readFileSync } from 'node:fs';
import { getTursoClient } from './db.js';

try {
  console.log('🔄 Conectando ao Turso e aplicando o esquema SQL...');
  const db = getTursoClient();
  const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

  await db.executeMultiple(sql);

  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('✅ Tabelas criadas/verificadas com sucesso:');
  console.log('  ', tables.rows.map((x) => x.name).join(', '));

  const contentCount = await db.execute("SELECT COUNT(*) as total FROM site_content");
  console.log(`📝 Registros em site_content: ${contentCount.rows[0].total}`);
} catch (error) {
  console.error('❌ Falha na inicialização do Turso:', error.message);
  process.exit(1);
}
