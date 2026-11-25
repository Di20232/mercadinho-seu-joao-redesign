# ADR-0018: Tornar o sistema instalável (PWA) sem guardar dados no aparelho

- **Status:** Aceito
- **Data:** 24/11/2026 (commits `a60716d` e `b7cd290`, PRs #7 e #9)

## Contexto

Os funcionários usam o sistema no celular. Pelo navegador, ele parece um site e some entre as abas. Um app nativo seria outro código para manter. No Android, "Adicionar à tela inicial → Criar atalho", e os navegadores embutidos em outros apps, criam só um atalho com o selo do navegador (aconteceu no primeiro teste, em 24/11/2026).

## Decisão

- `public/manifest.webmanifest` (nome, ícones, `display: standalone`, início em `/app.html`) e ícones em `public/icons/`.
- `public/sw.js` (service worker) com **rede primeiro**: não guarda a API nem as páginas. O cache só tem a página `offline.html` e o visual dela, usados quando a rede falha.
- `public/js/pwa.js` registra o service worker e mostra o aviso "Instale o Mercadinho no celular": chama a instalação oficial do Chrome quando ela existe, e explica o caminho certo no iPhone (Safari) e nos navegadores embutidos (botão "Copiar link").
- Tudo servido pela própria origem, dentro da CSP `'self'` ([ADR-0009](0009-frontend-sem-cdn-e-csp-self.md)).

## Consequências

- Ganha: ícone próprio e tela cheia sem app nativo nem loja de aplicativos.
- Ganha: o caixa nunca vê estoque, preço ou venda velhos, porque nada de dados fica no cache.
- Perde: sem internet não se vende; a página offline só avisa.
- Perde: a instalação só funciona em HTTPS ou `localhost`; pelo IP da rede da loja em HTTP, não aparece.
- Perde: mudar a lista de arquivos de reserva exige trocar o nome do cache (`mercadinho-v1`) em `sw.js`, para o navegador baixar a versão nova.

## Alternativas consideradas

- Modo offline com fila de vendas: complexo (conflito de estoque ao sincronizar) e arriscado para um caixa.
- App nativo (Android): outro código, outra loja, outro processo de atualização.
