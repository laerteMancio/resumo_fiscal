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
