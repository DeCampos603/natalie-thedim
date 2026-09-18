-- =====================================================================
-- Revista Digital · Natalie Thedim — Row Level Security
--
-- 🔴 ESTE ARQUIVO É A FRONTEIRA DE SEGURANÇA DO SITE.
-- A chave publishable (anon) fica exposta no JavaScript — é assim por
-- design. Quem protege os dados é o RLS. Tabela sem RLS = dado público
-- e ESCREVÍVEL por qualquer um que abrir o DevTools.
--
-- MODELO:
--  - Visitante anônimo (`anon`) pode ENVIAR (insert) e só LER o que já
--    está `status = 'aprovado'`.
--  - Qualquer conta autenticada (`authenticated`) é a Natalie moderando:
--    lê tudo (inclusive pendente/rejeitado) e pode aprovar/rejeitar.
--    Hoje só existe o login dela — ver nota no fim de 01-schema.sql.
--
-- Rode DEPOIS de 01-schema.sql.
-- =====================================================================

alter table public.historias     enable row level security;
alter table public.cartas        enable row level security;
alter table public.perguntas     enable row level security;
alter table public.diario_posts  enable row level security;

-- ---------------------------------------------------------------------
-- HISTÓRIAS
-- ---------------------------------------------------------------------
drop policy if exists "historias: publico envia"       on public.historias;
drop policy if exists "historias: publico le aprovadas" on public.historias;
drop policy if exists "historias: natalie le tudo"      on public.historias;
drop policy if exists "historias: natalie modera"       on public.historias;

create policy "historias: publico envia"
  on public.historias for insert to anon
  with check (status = 'pendente');

create policy "historias: publico le aprovadas"
  on public.historias for select to anon
  using (status = 'aprovado');

create policy "historias: natalie le tudo"
  on public.historias for select to authenticated
  using (true);

create policy "historias: natalie modera"
  on public.historias for update to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------
-- CARTAS
-- ---------------------------------------------------------------------
drop policy if exists "cartas: publico envia"        on public.cartas;
drop policy if exists "cartas: publico le aprovadas" on public.cartas;
drop policy if exists "cartas: natalie le tudo"      on public.cartas;
drop policy if exists "cartas: natalie modera"       on public.cartas;

create policy "cartas: publico envia"
  on public.cartas for insert to anon
  with check (status = 'pendente');

create policy "cartas: publico le aprovadas"
  on public.cartas for select to anon
  using (status = 'aprovado');

create policy "cartas: natalie le tudo"
  on public.cartas for select to authenticated
  using (true);

create policy "cartas: natalie modera"
  on public.cartas for update to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------
-- PERGUNTAS
-- Aqui "aprovado" = já respondida e publicada como FAQ. Pergunta sem
-- resposta pública não aparece — evita fila de perguntas soltas no ar.
-- ---------------------------------------------------------------------
drop policy if exists "perguntas: publico envia"        on public.perguntas;
drop policy if exists "perguntas: publico le aprovadas" on public.perguntas;
drop policy if exists "perguntas: natalie le tudo"      on public.perguntas;
drop policy if exists "perguntas: natalie modera"       on public.perguntas;

create policy "perguntas: publico envia"
  on public.perguntas for insert to anon
  with check (status = 'pendente');

create policy "perguntas: publico le aprovadas"
  on public.perguntas for select to anon
  using (status = 'aprovado');

create policy "perguntas: natalie le tudo"
  on public.perguntas for select to authenticated
  using (true);

create policy "perguntas: natalie modera"
  on public.perguntas for update to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------
-- DIÁRIO ANÔNIMO
-- Sem policy de UPDATE para `anon` — a reação passa pela função
-- `reagir_diario()` (security definer), não por UPDATE direto.
-- ---------------------------------------------------------------------
drop policy if exists "diario: publico envia"        on public.diario_posts;
drop policy if exists "diario: publico le aprovados" on public.diario_posts;
drop policy if exists "diario: natalie le tudo"      on public.diario_posts;
drop policy if exists "diario: natalie modera"       on public.diario_posts;

create policy "diario: publico envia"
  on public.diario_posts for insert to anon
  with check (status = 'pendente');

create policy "diario: publico le aprovados"
  on public.diario_posts for select to anon
  using (status = 'aprovado');

create policy "diario: natalie le tudo"
  on public.diario_posts for select to authenticated
  using (true);

create policy "diario: natalie modera"
  on public.diario_posts for update to authenticated
  using (true) with check (true);

-- =====================================================================
-- CONFERÊNCIA — rode depois de aplicar
-- =====================================================================

-- 1. Toda tabela pública precisa ter RLS ligado (rowsecurity = true).
select schemaname, tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
 order by tablename;

-- 2. Nenhuma policy pode ficar com qual/with_check nulos onde não devia.
select tablename, policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;
