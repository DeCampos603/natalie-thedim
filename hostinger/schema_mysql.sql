-- ============================================================================
-- Banco de Dados MySQL Nativo da Hostinger · Natalie Thedim (CRP 05/45482)
-- Compatível com MySQL 8.0+ / MariaDB 10.5+ (Padrão Hostinger hPanel)
-- Conjunto de Caracteres: utf8mb4 (suporte total a acentos, pontuação e emojis)
-- ============================================================================

CREATE TABLE IF NOT EXISTS historias (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  texto TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  resposta_tipo VARCHAR(20) NULL,
  resposta_texto TEXT NULL,
  resposta_url VARCHAR(500) NULL,
  criado_em VARCHAR(32) NOT NULL DEFAULT '',
  moderado_em VARCHAR(32) NULL,
  INDEX idx_hist_status (status),
  INDEX idx_hist_criado (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cartas (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  destinatario VARCHAR(120) NULL,
  texto TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  resposta_tipo VARCHAR(20) NULL,
  resposta_texto TEXT NULL,
  resposta_url VARCHAR(500) NULL,
  criado_em VARCHAR(32) NOT NULL DEFAULT '',
  moderado_em VARCHAR(32) NULL,
  INDEX idx_cartas_status (status),
  INDEX idx_cartas_criado (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS perguntas (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  texto TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  resposta_tipo VARCHAR(20) NULL,
  resposta_texto TEXT NULL,
  resposta_url VARCHAR(500) NULL,
  criado_em VARCHAR(32) NOT NULL DEFAULT '',
  respondida_em VARCHAR(32) NULL,
  INDEX idx_perg_status (status),
  INDEX idx_perg_criado (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS diario_posts (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  texto VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  reacoes INT NOT NULL DEFAULT 0,
  criado_em VARCHAR(32) NOT NULL DEFAULT '',
  moderado_em VARCHAR(32) NULL,
  INDEX idx_diario_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS limite_envios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_hash VARCHAR(64) NOT NULL,
  criado_em INT NOT NULL,
  INDEX idx_limite (ip_hash, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_content (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  section_name VARCHAR(64) NOT NULL UNIQUE,
  content_text MEDIUMTEXT NOT NULL,
  image_url VARCHAR(500) NULL,
  updated_at VARCHAR(32) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS newsletter_inscritos (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  nome VARCHAR(150) NULL,
  origem VARCHAR(50) DEFAULT 'site_principal',
  consentimento_lgpd TINYINT(1) DEFAULT 1,
  criado_em VARCHAR(32) NOT NULL DEFAULT '',
  INDEX idx_news_criado (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS biblioteca_temas (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  tema_chave VARCHAR(100) NOT NULL UNIQUE,
  pilar VARCHAR(100) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  texto MEDIUMTEXT NOT NULL,
  perguntas TEXT NOT NULL,
  icone VARCHAR(20) DEFAULT '💬',
  resumo TEXT NULL,
  ordem INT DEFAULT 0,
  atualizado_em VARCHAR(32) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS biblioteca_mensagens (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  tema_chave VARCHAR(100) NOT NULL,
  nome VARCHAR(150) NULL,
  email VARCHAR(191) NULL,
  whatsapp VARCHAR(50) NULL,
  mensagem TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  resposta TEXT NULL,
  consentimento_lgpd TINYINT(1) DEFAULT 1,
  criado_em VARCHAR(32) NOT NULL DEFAULT '',
  INDEX idx_bibmsg_tema (tema_chave),
  INDEX idx_bibmsg_criado (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS filmes (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  direcao_ano VARCHAR(100) NOT NULL,
  badge VARCHAR(100) DEFAULT 'Destaque',
  sinopse TEXT NOT NULL,
  perguntas TEXT NOT NULL,
  reflexao MEDIUMTEXT NOT NULL,
  ordem INT DEFAULT 0,
  criado_em VARCHAR(32) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS livros (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  autor_ano VARCHAR(100) NOT NULL,
  badge VARCHAR(100) DEFAULT 'Clássico Sistêmico',
  sinopse TEXT NOT NULL,
  licao MEDIUMTEXT NOT NULL,
  citacao TEXT NOT NULL,
  ordem INT DEFAULT 0,
  criado_em VARCHAR(32) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed inicial de conteúdo
INSERT INTO site_content (id, section_name, content_text, image_url, updated_at) VALUES
  ('sec_nome', 'nome_profissional', 'Natalie Thedim', NULL, NOW()),
  ('sec_hero_title', 'hero_title', 'Não se trata de ter razão. Trata-se de compreender relações.', NULL, NOW()),
  ('sec_hero_sub', 'hero_subtitle', 'Psicoterapia de casal e individual com acolhimento, escuta qualificada e reconstrução do diálogo seguro.', NULL, NOW()),
  ('sec_sobre_mim', 'sobre_mim', 'Natalie Thedim Silvado · Psicóloga clínica formada e pós-graduada pela PUC-Rio, com mais de 20 anos de experiência clínica no Rio de Janeiro e atendimento online.', 'assets/foto-natalie-thedim.png', NOW()),
  ('sec_crp', 'crp_info', 'CRP 05/45482 (RJ)', NULL, NOW()),
  ('sec_whatsapp', 'whatsapp_numero', '+5521989020364', NULL, NOW()),
  ('sec_email', 'email_contato', 'psicologa@nataliethedim.com.br', NULL, NOW()),
  ('sec_consultorio', 'endereco_consultorio', 'Consultório no Jardim Botânico, Zona Sul - Rio de Janeiro / RJ (e Atendimento Online para todo o Brasil e exterior)', NULL, NOW())
ON DUPLICATE KEY UPDATE content_text = VALUES(content_text), updated_at = VALUES(updated_at);
