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
  ('sec_whatsapp', 'whatsapp_numero', '+5521995160968', NULL),
  ('sec_consultorio', 'endereco_consultorio', 'Consultório no Jardim Botânico, Zona Sul - Rio de Janeiro / RJ (e Atendimento Online para todo o Brasil e exterior)', NULL);

