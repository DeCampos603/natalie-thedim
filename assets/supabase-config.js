// =====================================================================
// Configuração do Supabase — Revista Digital · Natalie Thedim
//
// Preencha os dois valores abaixo depois de criar o projeto Supabase
// (supabase.com → New Project, gratuito) e rodar supabase/01-schema.sql
// e supabase/02-rls.sql no SQL Editor dele.
//
// Onde achar: no painel do projeto → Project Settings → API.
//   url     = "Project URL"
//   anonKey = "anon public" (NÃO a "service_role" — essa nunca vai no site)
//
// Enquanto ficar vazio, o site funciona normalmente mas mostra um aviso
// nos formulários e nas listagens em vez de enviar/carregar de verdade.
// =====================================================================
window.SUPABASE_CONFIG = {
  url: '',     // [[PREENCHER: Project URL do Supabase]]
  anonKey: '', // [[PREENCHER: anon public key do Supabase]]
};
