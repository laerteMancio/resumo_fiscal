# Relatório Fiscal — Vercel

## Publicação pelo terminal no Windows
Instale Node.js 22.13 ou superior. Extraia o ZIP e abra o terminal na pasta que contém package.json. Execute:

```sh
npm install
npm run build
npx vercel login
npx vercel --prod
```

Escolha sua conta, crie o projeto relatorio-fiscal e confirme a pasta atual. A configuração Vite está em vercel.json. Não é necessário configurar variáveis de ambiente.

## Alternativa pelo GitHub
Envie o conteúdo desta pasta para um repositório no GitHub. Em https://vercel.com/new importe o repositório. Framework: Vite. Build: npm run build. Output: dist.

Os XMLs são processados na memória do navegador, sem envio ao servidor. Nenhum XML ou PDF de cliente acompanha este pacote.

## Atualização v1.1: Google, medição e marketing
1. Substitua os arquivos no projeto local. Não copie node_modules nem dist.
2. Execute npm install e npm run build.
3. Se usa GitHub conectado à Vercel: git add .; git commit -m "SEO e medicao de uso"; git push (execute cada comando separadamente).
4. Se usa CLI: npx vercel --prod.

### Google Search Console
Adicione a propriedade de prefixo de URL https://resumo-fiscal.vercel.app/ na sua conta do Search Console. Escolha verificação por arquivo HTML, baixe o arquivo fornecido e coloque-o em public/ sem alterar seu nome. Publique novamente e conclua a verificação. Envie sitemap.xml na seção Sitemaps e solicite a indexação da página inicial. Indexação e posição nos resultados não são garantidas.

### Google Analytics 4
Crie uma propriedade GA4 e um fluxo Web para https://resumo-fiscal.vercel.app/. Copie o ID de medição G-.... Em Vercel, Settings > Environment Variables, crie VITE_GA_MEASUREMENT_ID com esse valor para Production e publique novamente.
Antes da configuração, nenhuma medição GA4 é enviada e o aviso não aparece. Depois, o visitante escolhe permitir ou continuar sem medição. Recusa não impede usar a ferramenta. Medição começa após permissão.
Eventos: page_view; xml_import_completed; pdf_generated (report_format: summary/complete); share_clicked. Nunca enviar CNPJ, nome de empresa, nome de arquivo, chave, valores, período fiscal ou conteúdo XML. Desative a medição aprimorada do fluxo GA4 para evitar eventos automáticos extras. Dados técnicos e cookies de medição seguem a política do Google; não anuncie ausência de todo tipo de dado.
Veja acessos no relatório de tempo real; para uso, veja eventos. pdf_generated significa arquivo gerado/início do download, não comprovação de entrega ou leitura. Métricas cobrem visitantes que permitem medição e podem ser reduzidas por bloqueadores.

### Divulgação inicial
Compartilhe o link com clientes e escritórios contábeis: "Transforme seus XMLs NF-e e NFC-e em um relatório mensal gratuito. Processamento no navegador: https://resumo-fiscal.vercel.app/".
O conteúdo explicativo também está no HTML inicial para facilitar a leitura por buscadores. O aplicativo permanece na primeira tela.
