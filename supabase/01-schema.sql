-- =====================================================================
-- Revista Digital · Natalie Thedim — esquema
-- Rode no SQL Editor do Supabase. Depois rode 02-rls.sql.
--
-- MODELO: conteúdo enviado por visitantes anônimos (Histórias, Cartas,
-- Perguntas, Diário) fica em `status = 'pendente'` até a Natalie aprovar
-- pelo painel (admin.html). Só o que está `aprovado` aparece no site
-- público. Isso não é um detalhe — é o requisito ético do projeto:
-- ninguém pode publicar relato sensível de terceiro sem revisão humana.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- HISTÓRIAS REAIS
-- ---------------------------------------------------------------------
create table if not exists public.historias (
  id             uuid primary key default gen_random_uuid(),
  texto          text not null check (char_length(texto) between 10 and 3000),
  status         text not null default 'pendente'
                 check (status in ('pendente', 'aprovado', 'rejeitado')),
  resposta_tipo  text check (resposta_tipo in ('video', 'audio', 'texto')),
  resposta_texto text,
  resposta_url   text,
  criado_em      timestamptz not null default now(),
  moderado_em    timestamptz
);

-- ---------------------------------------------------------------------
-- CARTAS QUE NUNCA ENVIEI
-- ---------------------------------------------------------------------
create table if not exists public.cartas (
  id             uuid primary key default gen_random_uuid(),
  destinatario   text check (char_length(destinatario) <= 60),
  texto          text not null check (char_length(texto) between 10 and 4000),
  status         text not null default 'pendente'
                 check (status in ('pendente', 'aprovado', 'rejeitado')),
  resposta_tipo  text check (resposta_tipo in ('video', 'audio', 'texto')),
  resposta_texto text,
  resposta_url   text,
  criado_em      timestamptz not null default now(),
  moderado_em    timestamptz
);

-- ---------------------------------------------------------------------
-- PERGUNTE PARA NATALIE
-- ---------------------------------------------------------------------
create table if not exists public.perguntas (
  id             uuid primary key default gen_random_uuid(),
  texto          text not null check (char_length(texto) between 5 and 1000),
  status         text not null default 'pendente'
                 check (status in ('pendente', 'aprovado', 'rejeitado')),
  resposta_tipo  text check (resposta_tipo in ('video', 'audio', 'texto')),
  resposta_texto text,
  resposta_url   text,
  criado_em      timestamptz not null default now(),
  respondida_em  timestamptz
);

-- ---------------------------------------------------------------------
-- DIÁRIO ANÔNIMO
-- Só o relato + uma reação (❤). Sem comentário — é a regra do mural.
-- ---------------------------------------------------------------------
create table if not exists public.diario_posts (
  id          uuid primary key default gen_random_uuid(),
  texto       text not null check (char_length(texto) between 3 and 280),
  status      text not null default 'pendente'
              check (status in ('pendente', 'aprovado', 'rejeitado')),
  reacoes     integer not null default 0,
  criado_em   timestamptz not null default now(),
  moderado_em timestamptz
);

-- ---------------------------------------------------------------------
-- Reagir a um post do diário sem precisar de policy de UPDATE aberta
-- para o público (evita que qualquer visitante zere ou fraude contagem).
-- Só incrementa post já aprovado.
-- ---------------------------------------------------------------------
create or replace function public.reagir_diario(post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.diario_posts
     set reacoes = reacoes + 1
   where id = post_id and status = 'aprovado';
end;
$$;

-- =====================================================================
-- CRIAR O LOGIN DA NATALIE (moderação)
--
-- 1. No painel do Supabase: Authentication → Users → Add user
--    (e-mail e senha dela).
-- 2. Pronto — não precisa cadastrar em nenhuma tabela. Qualquer conta
--    autenticada no projeto é tratada como administradora (02-rls.sql).
--    Se um dia mais de uma pessoa for moderar, crie uma tabela
--    `moderadores(id uuid references auth.users)` e troque `to
--    authenticated` pelas policies por essa allowlist — hoje não é
--    necessário: é só a Natalie.
-- =====================================================================
