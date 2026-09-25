# 🌸 Revista Digital — Psicóloga Natalie Thedim

Site de várias páginas para a psicóloga clínica **Natalie Thedim** (PUC-Rio, CRP 05/45482),
terapeuta de casal e família: landing page de conversão + o início de uma "revista digital" de
relacionamentos.

## 🚀 Link oficial (GitHub Pages)

[https://decampos603.github.io/natalie-thedim/](https://decampos603.github.io/natalie-thedim/)

## 🧭 Páginas

**Funcionais (com Supabase, quando configurado):**
`historias.html` · `cartas.html` · `pergunte.html` · `diario.html` — formulário de envio real +
listagem do que já foi aprovado pela Natalie em `admin.html` (painel de moderação).

**Reais, sem backend:**
`biblioteca.html` (índice de temas) · `exercicios.html` (o Termômetro do Casamento funciona de
verdade, no navegador).

**Visão futura, ainda sem conteúdo real** (visual pronto, não funcional):
`e-se.html` · `casos.html` · `emocoes.html` · `filme.html` · `livro.html` · `podcast.html` ·
`youtube.html` · `instagram.html` · `terapeutas.html`.

## ⚠️ Pendências antes de divulgar

- **Confirmar o número oficial do WhatsApp** usado nos botões de agendamento.
- **Ligar o Supabase** para Histórias, Cartas, Pergunte e Diário funcionarem de verdade — ver
  `supabase/01-schema.sql`, `supabase/02-rls.sql` e `assets/supabase-config.js`.
- As 9 páginas de "visão futura" precisam de conteúdo real da Natalie (ou de integração com
  APIs do YouTube/Instagram) antes de sair do estágio conceitual.

## Deploy (Vercel + Turso)

Site estático + funções serverless em `api/` (Node) usando Turso (libSQL).
Variáveis de ambiente na Vercel: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET` (32+ caracteres), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
Esquema do banco: `turso/schema.sql` (aplicar com `npm run init-db`). Painel de moderação: `/admin`.
