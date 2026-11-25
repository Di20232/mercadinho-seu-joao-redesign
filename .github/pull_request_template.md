## O que muda

<!-- Uma ou duas frases: o que e por quê. -->

## Como foi conferido

- [ ] `npm test` passando no banco de teste (quantos: __/__)
- [ ] Telas conferidas no navegador (se mudou o frontend): 375 px, notebook, tema claro e escuro
- [ ] Migration nova lida e aplicada no banco de teste (se houver)

## Documentação (docs as code)

Atualize no mesmo PR o que esta mudança afeta. Tabela completa em `docs/README.md`, seção "Quando o código muda, qual documento muda junto".

- [ ] Manual, FAQ ou novidades (`docs/usar/`), se o usuário percebe a mudança
- [ ] Requisitos e regras (`docs/manter/requisitos-e-regras.md`), se mudou uma regra ou permissão
- [ ] `docs/manter/api.md` e `docs/manter/openapi.yaml`, se mudou uma rota
- [ ] Modelo de dados e guias de migração, se mudou o banco
- [ ] ADR novo, se foi uma decisão de arquitetura
- [ ] Deploy e variáveis (`docs/sustentar/`), se mudou configuração
- [ ] Dependências, SBOM e compatibilidade (`docs/evoluir/`), se mudou dependência
- [ ] Changelog (`docs/evoluir/changelog.md`), com **⚠ Quebra** se for o caso
- [ ] Nada a atualizar (explique por quê):

## Segurança

- [ ] Nenhum `.env`, senha, token ou cookie no diff
