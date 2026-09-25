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
