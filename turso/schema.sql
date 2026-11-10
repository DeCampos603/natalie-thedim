-- Revista Digital · Natalie Thedim — esquema Turso (SQLite/libSQL).
-- Conteúdo público entra como 'pendente' e só aparece no site após aprovação da Natalie.
CREATE TABLE IF NOT EXISTS historias (
  id TEXT PRIMARY KEY,
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 10 AND 3000),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  resposta_tipo TEXT CHECK (resposta_tipo IN ('video','audio','texto')),
  resposta_texto TEXT, resposta_url TEXT,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  moderado_em TEXT
);
CREATE TABLE IF NOT EXISTS cartas (
  id TEXT PRIMARY KEY,
  destinatario TEXT CHECK (length(destinatario) <= 60),
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 10 AND 4000),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  resposta_tipo TEXT CHECK (resposta_tipo IN ('video','audio','texto')),
  resposta_texto TEXT, resposta_url TEXT,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  moderado_em TEXT
);
CREATE TABLE IF NOT EXISTS perguntas (
  id TEXT PRIMARY KEY,
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 5 AND 1000),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  resposta_tipo TEXT CHECK (resposta_tipo IN ('video','audio','texto')),
  resposta_texto TEXT, resposta_url TEXT,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  respondida_em TEXT
);
CREATE TABLE IF NOT EXISTS diario_posts (
  id TEXT PRIMARY KEY,
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 3 AND 280),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  reacoes INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  moderado_em TEXT
);
CREATE TABLE IF NOT EXISTS limite_envios (
  ip_hash TEXT NOT NULL,
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_limite ON limite_envios (ip_hash, criado_em);

-- Tabela para o Mini-CMS: Conteúdo Dinâmico do Site
CREATE TABLE IF NOT EXISTS site_content (
  id TEXT PRIMARY KEY,
  section_name TEXT NOT NULL UNIQUE,
  content_text TEXT NOT NULL,
  image_url TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_site_content_section ON site_content (section_name);

-- Carga inicial (Seed) com valores padrão do projeto da Natalie
INSERT OR IGNORE INTO site_content (id, section_name, content_text, image_url) VALUES
  ('sec_hero_title', 'hero_title', 'Não se trata de ter razão. Trata-se de compreender relações.', NULL),
  ('sec_hero_sub', 'hero_subtitle', 'Psicoterapia de casal e individual com acolhimento, escuta qualificada e reconstrução do diálogo seguro.', NULL),
  ('sec_sobre_mim', 'sobre_mim', 'Natalie Thedim Silvado Camardella · Psicóloga clínica formada e pós-graduada pela PUC-Rio, com mais de 20 anos de experiência clínica no Rio de Janeiro e atendimento online.', '/clientes/Natalie%20Thedim/foto-natalie-thedim.png'),
  ('sec_crp', 'crp_info', 'CRP 05/45482 (RJ)', NULL),
  ('sec_whatsapp', 'whatsapp_numero', '+5521989020364', NULL),
  ('sec_consultorio', 'endereco_consultorio', 'Consultório no Jardim Botânico, Zona Sul - Rio de Janeiro / RJ (e Atendimento Online para todo o Brasil e exterior)', NULL);

-- Atualização garantida do número oficial de atendimento WhatsApp
UPDATE site_content
SET content_text = '+5521989020364',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE section_name = 'whatsapp_numero';

-- Sementes clínicas aprovadas (para garantir que as páginas comunitárias nunca fiquem vazias)
INSERT OR IGNORE INTO historias (id, texto, status, resposta_tipo, resposta_texto, criado_em, moderado_em) VALUES
  ('seed_hist_1', 'Estamos juntos há 11 anos e, desde que nossa filha nasceu, parece que viramos dois colegas de quarto gerenciando boletos e horários. Não brigamos feio, mas o silêncio no jantar pesa mais do que qualquer discussão. Tenho medo de tocar no assunto e parecer ingrata.', 'aprovado', 'texto', 'Quando o casal é engolido pela logística da rotina, a conjugalidade costuma ser a primeira a ficar sem espaço. Nomear essa distância sem apontar culpados — "sinto falta de nós dois além das tarefas" — não é ingratidão, é um gesto de cuidado com o vínculo que sustenta a própria família.', '2026-03-10T14:20:00.000Z', '2026-03-11T10:00:00.000Z'),
  ('seed_hist_2', 'Toda vez que tento falar sobre algo que me magoou, meu parceiro se fecha ou diz que "já vem cobrança de novo". Acabo engolindo tudo para manter a paz, mas sinto que estou me afastando aos poucos.', 'aprovado', 'texto', 'A paz construída sobre o próprio silenciamento cobra um preço alto na intimidade. Na clínica sistêmica, observamos o ciclo: quanto mais um teme a crítica e se defende, mais o outro se sente invisível. Mudar a porta de entrada da conversa — falando da própria vulnerabilidade em vez da falha do outro — ajuda a desarmar esse alerta.', '2026-03-18T19:45:00.000Z', '2026-03-19T09:15:00.000Z');

INSERT OR IGNORE INTO cartas (id, destinatario, texto, status, resposta_tipo, resposta_texto, criado_em, moderado_em) VALUES
  ('seed_carta_1', 'Ao meu parceiro, depois de uma discussão que não precisava ter acontecido', 'Eu não estava brava por causa da louça nem pelo atraso. Eu só estava exausta e queria sentir que não estou carregando o mundo nas costas sozinha. Quando levantei a voz, na verdade eu queria pedir colo, mas não soube como descer a guarda.', 'aprovado', 'texto', 'Debaixo da maioria das irritações cotidianas mora um pedido de conexão que teve medo de aparecer desprotegido. Reconhecer o pedido por trás da queixa já transforma o lugar de onde você olha para a relação.', '2026-03-12T21:10:00.000Z', '2026-03-13T11:30:00.000Z'),
  ('seed_carta_2', 'Para quem eu fui antes de aprender a dizer não', 'Passei anos achando que amar era concordar com tudo e nunca dar trabalho. Hoje percebo que, ao esconder meus limites para ser aceita, ninguém podia amar quem eu realmente era.', 'aprovado', 'texto', 'Dizer "não" ao que nos fere é a única maneira de tornar verdadeiro o nosso "sim". Limites claros não afastam relações saudáveis — eles mostram onde o encontro real pode acontecer.', '2026-03-22T16:05:00.000Z', '2026-03-23T08:40:00.000Z');

INSERT OR IGNORE INTO perguntas (id, texto, status, resposta_tipo, resposta_texto, criado_em, respondida_em) VALUES
  ('seed_perg_1', 'Vale a pena procurar terapia de casal quando apenas um dos dois sente que a relação precisa de cuidado?', 'aprovado', 'texto', 'Muitas vezes os dois parceiros têm tempos diferentes de percepção do desgaste. Quando o convite deixa de soar como um "tribunal para apontar quem está errado" e passa a ser apresentado como um espaço seguro para melhorar a comunicação dos dois, a resistência costuma diminuir. E mesmo quando um parceiro opta por iniciar em psicoterapia individual, o movimento de um já altera toda a dança relacional.', '2026-03-14T11:00:00.000Z', '2026-03-15T15:20:00.000Z'),
  ('seed_perg_2', 'É possível reconstruir a confiança no relacionamento depois de uma quebra de combinado importante?', 'aprovado', 'texto', 'Sim, desde que haja disposição genuína de ambas as partes para olhar para a ferida sem minimizá-la. Reconstruir confiança não significa esquecer ou voltar ao que era antes, mas estabelecer um novo pacto sustentado por transparência consistente, escuta da dor e responsabilidade afetiva no dia a dia.', '2026-03-25T17:30:00.000Z', '2026-03-26T10:10:00.000Z');

INSERT OR IGNORE INTO diario_posts (id, texto, status, reacoes, criado_em, moderado_em) VALUES
  ('seed_diario_1', 'Hoje consegui ouvir meu marido até o fim sem interromper para me defender. Foi difícil segurar a ansiedade, mas a conversa terminou em abraço pela primeira vez em meses.', 'aprovado', 24, '2026-03-20T22:15:00.000Z', '2026-03-21T08:00:00.000Z'),
  ('seed_diario_2', 'Percebi na sessão desta semana que carrego a pressa da minha família de origem para dentro do meu casamento. Respirar antes de responder tem sido meu exercício diário.', 'aprovado', 19, '2026-03-24T18:40:00.000Z', '2026-03-25T09:00:00.000Z'),
  ('seed_diario_3', 'Pedi desculpas ao meu filho quando perdi a paciência ontem. Ver o olhinho dele aliviar me lembrou que reparar o erro ensina muito mais do que fingir perfeição.', 'aprovado', 31, '2026-03-28T20:05:00.000Z', '2026-03-29T09:30:00.000Z');


