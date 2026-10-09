# Resumo Fiscal — assinaturas Hotmart (v2)

Projeto React/Vite original com autenticação Supabase, autorização no backend Vercel e integração Hotmart 2.0.0. Preserve o domínio atual. Este pacote não foi publicado nem conectado às suas contas.

## O que está pronto

- Cadastro com confirmação do e-mail, login, logout e recuperação de senha.
- Planos mensal/anual, mesmos recursos e solicitações ilimitadas.
- Liberação pelo e-mail confirmado, igual ao da compra na Hotmart.
- Administradores cadastrados por UUID no banco, nunca por campo editável do usuário.
- Webhook com Hottok, produto/plano permitido, idempotência e transação SQL.
- Pagamentos separados por transação: um atraso na nova cobrança não apaga o período já pago; reembolso/chargeback revoga a transação correspondente.
- Cancelar renovação mantém o acesso até o vencimento do pagamento existente; expiração é verificada pelo servidor em cada solicitação.
- Painel do administrador mostra os últimos 200 pagamentos e quantidade total de solicitações autorizadas de geração.
- XMLs e dados fiscais continuam no navegador. O backend recebe apenas autenticação e registra a solicitação, sem CNPJ, valores ou nomes de arquivo.

## 1. Supabase

1. Crie um projeto em https://supabase.com/dashboard.
2. Execute `supabase/schema.sql` no SQL Editor uma única vez. O script é para banco novo; não deve ser reexecutado sobre tabelas existentes.
3. Em Authentication > Providers, habilite Email e **Confirm email**. Cadastro público deve permanecer habilitado; criar conta não concede assinatura.
4. Em Authentication > URL Configuration, Site URL: `https://resumo-fiscal.vercel.app`; Redirect URLs: `https://resumo-fiscal.vercel.app` e `http://localhost:5173` para desenvolvimento. Não use curingas amplos em produção.
5. Configure SMTP próprio em produção e ajuste os modelos de confirmação/recuperação. O usuário recebe o e-mail de confirmação ao se cadastrar, não um convite automático após comprar.
6. Cadastre sua conta no app, confirme o e-mail e copie o UUID em Authentication > Users. Execute, substituindo o exemplo:

```sql
insert into public.administrators (user_id) values ('UUID-DA-SUA-CONTA');
```

As tabelas têm RLS habilitado e nenhum acesso público. Guarde a chave service_role somente na Vercel, nunca no navegador ou em repositório.

## 2. Hotmart

Cadastre o produto por assinatura e crie os planos mensal e anual com os preços escolhidos. Anote produto ID, plano ID de cada opção e URLs dos checkouts. Não coloque IDs de oferta no lugar dos IDs de plano.

Cadastre webhook em Ferramentas > Webhook, versão **2.0.0**, produto Resumo Fiscal, URL:

`https://resumo-fiscal.vercel.app/api/hotmart-webhook`

Selecione: PURCHASE_APPROVED, PURCHASE_COMPLETE, PURCHASE_REFUNDED, PURCHASE_CHARGEBACK, PURCHASE_CANCELED, PURCHASE_DELAYED, PURCHASE_EXPIRED e SUBSCRIPTION_CANCELLATION. Copie o token da aba de autenticação para HOTMART_HOTTOK.

A aprovação deve conter `data.purchase.date_next_charge` em milissegundos. O sistema recusa uma aprovação sem vencimento, sem plano configurado ou sem código do assinante, em vez de inventar prazo. Confira o payload real do seu produto antes de vender. Notificações de teste com IDs fictícios serão rejeitadas; configure uma implantação de testes com os IDs correspondentes, sem misturar dados de produção.

Na entrega/orientação ao comprador inclua: “Acesse https://resumo-fiscal.vercel.app, clique em Criar conta e use o mesmo e-mail da compra. Confirme seu e-mail e entre. O acesso é liberado após a confirmação do pagamento.” O gerenciamento da cobrança fica na Hotmart.

## 3. Vercel

Use o projeto Vercel existente e envie este código para o repositório já vinculado ou execute `vercel` em ambiente autenticado. Não substitua só a pasta dist: as funções em api/ são necessárias.

Configure estas variáveis (modelo em `.env.example`):

| Variável | Valor |
| --- | --- |
| VITE_SUPABASE_URL | URL do projeto Supabase |
| VITE_SUPABASE_ANON_KEY | Chave anon pública do Supabase |
| VITE_HOTMART_MONTHLY_URL | Checkout mensal |
| VITE_HOTMART_ANNUAL_URL | Checkout anual |
| VITE_GA_MEASUREMENT_ID | ID atual do Analytics, se usado |
| SUPABASE_URL | Mesma URL Supabase, no backend |
| SUPABASE_SERVICE_ROLE_KEY | Chave privada service_role |
| HOTMART_HOTTOK | Token privado do webhook |
| HOTMART_PRODUCT_ID | ID numérico do produto |
| HOTMART_MONTHLY_PLAN_ID | ID do plano mensal |
| HOTMART_ANNUAL_PLAN_ID | ID do plano anual |

Depois de configurar, faça um novo deploy. As variáveis VITE_ entram no bundle durante o build. Nunca dê o prefixo VITE_ às três credenciais privadas. Separe projetos Supabase/configuração Hotmart de testes e produção.

## 4. Validação antes de liberar as vendas

- Cadastro, confirmação de e-mail, login, saída, recuperação e troca de senha.
- Conta sem pagamento bloqueada; administrador com acesso.
- Compra mensal/anual real de testes com e-mail confirmado libera o app.
- Mesmo evento reenviado não cria outro pagamento.
- Renovação gera novo período; atraso não remove o período pago anterior.
- Cancelamento mantém o restante do período; reembolso/chargeback revoga o pagamento.
- Vencimento bloqueia nova solicitação sem depender de tarefas agendadas.
- Console de rede não recebe XML nem dados fiscais.
- Painel e geração de PDF, incluindo erro de conexão, não autorizam acesso quando o servidor falha.

```bash
npm ci
npm test
npm run build
```

`npm run dev` serve apenas o frontend. Para testar também as funções api/ localmente, use Vercel CLI (`vercel dev`) com variáveis locais. As regras SQL foram testadas localmente com PostgreSQL embarcado (PGlite), incluindo duplicidade, atraso, cancelamento, reembolso, renovação, eventos antigos, rollback, expiração e bloqueio de acesso público. O teste completo de auth/webhook depende dos serviços configurados. Testes automatizados locais cobrem token, normalização dos eventos, IDs permitidos, vencimento, permissão administrativa, autenticação confirmada e falha fechada.

## Limites desta versão

A autorização e os registros são validados no servidor, mas a geração do PDF permanece no navegador. Um usuário técnico pode extrair/adaptar o JavaScript e contornar a interface local. Esta versão controla o acesso normal ao serviço; não oferece proteção contra cópia do código. Para impedir a geração contornando o cliente, será necessário mover uma parte indispensável da geração para o servidor e rever a política de processamento de dados fiscais.

A contagem representa **solicitações autorizadas**, não confirmação de download. Não há limite mensal, bloqueio de compartilhamento de senha, sincronização retroativa de compras nem reconciliação automática com a API Hotmart. Eventos perdidos precisam ser reenviados pelo painel Hotmart. Trocar o e-mail na Hotmart/conta requer conferência manual para manter a associação.

Eventos são ordenados por transação; reembolso/chargeback é terminal para aquela transação. Os eventos armazenam apenas ID/tipo/data, não o payload completo. Contas, e-mail/assinatura e histórico de solicitações são dados persistentes; ajuste sua política de privacidade e rotina de exclusão à operação comercial.

## Documentação consultada

- https://developers.hotmart.com/docs/pt-BR/tutorials/use-webhook-for-subscriptions/
- https://developers.hotmart.com/docs/pt-BR/2.0.0/webhook/cancel-subscription-webhook/
- https://developers.hotmart.com/docs/es/2.0.0/webhook/purchase-webhook/
- https://supabase.com/docs/reference/javascript/auth-getuser

A extração do RAR original preservou o aplicativo e os arquivos de configuração. Materiais de divulgação e node_modules não são necessários para a implantação e não acompanham este ZIP.
