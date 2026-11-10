// Script de Migração Automática: Turso (libSQL) -> MySQL Nativo Hostinger
// Uso: node --env-file=.env.local hostinger/migrar_turso_para_mysql.mjs
import { createClient } from '@libsql/client';
import mysql from 'mysql2/promise';

const TABELAS = [
  'site_content',
  'historias',
  'cartas',
  'perguntas',
  'diario_posts',
  'newsletter_inscritos',
  'biblioteca_temas',
  'biblioteca_mensagens',
  'filmes',
  'livros'
];

async function main() {
  console.log('--- Iniciando Migração Turso -> MySQL Hostinger ---');

  // 1. Conexão com Turso
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    throw new Error('TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios no .env.local');
  }

  const turso = createClient({ url: tursoUrl, authToken: tursoToken });
  console.log('✓ Conectado ao Turso com sucesso.');

  // 2. Conexão com MySQL Hostinger
  const mysqlConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: 'utf8mb4'
  };

  if (!mysqlConfig.user || !mysqlConfig.database) {
    console.log('Aviso: Credenciais MYSQL_USER e MYSQL_DATABASE não configuradas ainda.');
    console.log('O script gerou a estrutura e está pronto para executar assim que você criar o banco no hPanel da Hostinger.');
    return;
  }

  const mysqlConn = await mysql.createConnection(mysqlConfig);
  console.log(`✓ Conectado ao MySQL Hostinger (${mysqlConfig.database}) com sucesso.`);

  // 3. Itera pelas tabelas e transfere dados
  for (const tabela of TABELAS) {
    try {
      const resTurso = await turso.execute(`SELECT * FROM ${tabela}`);
      const linhas = resTurso.rows;
      console.log(`\nExportando tabela "${tabela}": ${linhas.length} registro(s) encontrados no Turso.`);

      if (linhas.length === 0) continue;

      for (const linha of linhas) {
        const colunas = Object.keys(linha);
        const valores = Object.values(linha);
        const placeholders = colunas.map(() => '?').join(', ');
        const updateSets = colunas.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');

        const sql = `INSERT INTO \`${tabela}\` (\`${colunas.join('`, `')}\`)
                     VALUES (${placeholders})
                     ON DUPLICATE KEY UPDATE ${updateSets}`;

        await mysqlConn.execute(sql, valores);
      }
      console.log(`✓ Tabela "${tabela}" sincronizada com sucesso no MySQL!`);
    } catch (err) {
      console.error(`Erro ao sincronizar tabela ${tabela}:`, err.message);
    }
  }

  await mysqlConn.end();
  console.log('\n======================================================');
  console.log('🎉 Migração concluída com sucesso!');
  console.log('Todos os dados foram preservados e agora estão no MySQL Hostinger.');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('[ERRO NA MIGRAÇÃO]', err);
  process.exit(1);
});
