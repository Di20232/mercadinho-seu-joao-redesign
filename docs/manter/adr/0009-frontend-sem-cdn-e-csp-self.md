# ADR-0009: Servir fonte, ícones e scripts do próprio sistema, com CSP só `'self'`

- **Status:** Aceito
- **Data:** 26/10/2026 (commit `d1c77b7`, redesign). A CSP estrita existe desde 27/08/2026.

## Contexto

A Content Security Policy do Helmet (`src/app.js`) só aceita recursos da própria origem: `default-src`, `script-src` e `style-src` em `'self'`, imagens em `'self'` e `data:`. Isso bloqueia script injetado, mas também bloqueia CDN de fontes e bibliotecas. O redesign queria fonte própria, ícones e gráficos.

## Decisão

- Fonte Inter servida de `public/fonts/` (licença em `public/fonts/LICENSE-Inter.txt`).
- 49 ícones Lucide embutidos como sprite SVG em `public/js/icons.js`.
- Gráficos desenhados em SVG por código próprio (`public/js/ui.js`), sem biblioteca.
- Nenhum `<script>` ou `style` inline; todo JS e CSS em arquivo.

## Consequências

- Ganha: a CSP continua estrita; o sistema funciona sem internet para CDN (ex.: na rede da loja).
- Ganha: nenhuma dependência de frontend para atualizar.
- Perde: ícone novo precisa ser copiado à mão para `icons.js`.
- Perde: gráficos têm só os recursos que foram programados (área e barras).

## Alternativas consideradas

- Liberar CDNs na CSP: amplia a superfície de ataque e cria dependência externa em tempo de execução.
- Biblioteca de gráficos empacotada localmente: dezenas de kB para dois tipos de gráfico.
