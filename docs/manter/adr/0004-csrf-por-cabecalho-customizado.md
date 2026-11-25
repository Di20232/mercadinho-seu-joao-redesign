# ADR-0004: Defender contra CSRF exigindo o cabeçalho `X-Requested-With: fetch`

- **Status:** Aceito
- **Data:** 27/08/2026 (commit `5a358a3`)

## Contexto

Com a sessão em cookie ([ADR-0003](0003-sessao-jwt-em-cookie-revalidada-no-banco.md)), o navegador envia o cookie automaticamente. Um site malicioso poderia montar um formulário que posta para `/api/sales` em nome de quem está logado.

## Decisão

Toda requisição para `/api` com método diferente de `GET`, `HEAD` e `OPTIONS` precisa do cabeçalho `X-Requested-With: fetch`; sem ele, 403 "Requisição bloqueada." (`requireFetchHeader` em `src/auth.js`). O cliente `public/js/api.js` sempre envia o cabeçalho. Somado a isso, o cookie é `SameSite=Lax` e o CORS só aceita a própria origem e as de `CLIENT_ORIGIN`.

## Consequências

- Ganha: formulário HTML forjado não consegue definir cabeçalho customizado; `fetch` de outra origem com cabeçalho customizado dispara preflight, que o CORS recusa.
- Ganha: nada de token CSRF para gerar, guardar e renovar.
- Perde: qualquer cliente da API (script, teste, Postman) precisa lembrar do cabeçalho. Os testes usam `test/helpers/http.js`, que já o inclui.
- Perde: a proteção depende de o CORS continuar restrito. Abrir o CORS para `*` com credenciais quebraria a defesa.

## Alternativas consideradas

- Token CSRF sincronizado (double submit): mais robusto contra configurações erradas de CORS, mais código no cliente e no servidor.
- Só `SameSite=Strict`: quem chegasse ao sistema por um link externo (ex.: um e-mail ou um favorito em outro site) apareceria deslogado na primeira página, porque o navegador não manda o cookie nessa navegação.
