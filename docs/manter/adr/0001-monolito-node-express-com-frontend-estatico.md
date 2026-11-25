# ADR-0001: Usar um monólito Node/Express que serve a API e um frontend estático sem framework

- **Status:** Aceito
- **Data:** 27/08/2026 (commit `5a358a3`)

## Contexto

Cliente pequeno, um desenvolvedor, hospedagem barata. O sistema tem poucas telas e poucos usuários simultâneos (o caixa e o dono). O operador não tem conhecimento técnico, então subir e atualizar precisa ser simples.

## Decisão

Um único processo Node.js com Express faz tudo: a API REST em `/api`, os arquivos estáticos de `public/` e o agendador do alerta diário. O frontend é HTML, CSS e JavaScript puros, um `<template>` por tela, sem React/Vue e **sem etapa de build**.

## Consequências

- Ganha: o mesmo código roda em desenvolvimento e produção; deploy é `node src/server.js`; nada de bundler; qualquer provedor que rode Node serve.
- Ganha: a API e as páginas ficam na mesma origem, o que simplifica cookie, CORS e CSRF.
- Perde: `public/js/app.js` concentra todas as telas (cerca de 1.500 linhas). Mudanças grandes no frontend ficam mais difíceis de isolar.
- Perde: não há testes automatizados de frontend; a tela é conferida à mão.
- Perde: escalar significa mais instâncias do mesmo processo, e o rate limit e o agendador passam a rodar duplicados (ver [dívida técnica](../../evoluir/roadmap-e-divida-tecnica.md)).

## Alternativas consideradas

- SPA com framework e API separada: mais peças para hospedar e manter, sem ganho para o tamanho do sistema.
- Renderização no servidor com templates: daria o mesmo resultado, mas exigiria um motor de templates e misturaria HTML com rotas.
