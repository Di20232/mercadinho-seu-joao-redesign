# Teste do sistema inteiro — Semana 13 (24 e 25/11/2026)

Tarefa do ClickUp: [Testar o sistema inteiro](https://app.clickup.com/t/86e3pu0un).
Código testado: branch `claude/busca-sem-acento` (inclui os PRs #4 e #5). As correções estão em `claude/correcoes-teste-sistema`.

Ambiente: banco separado `mercadinho_joao_test_manual` (recriado do zero, com o seed, 24 produtos e 100 vendas simuladas), servidor local na porta 3001. O banco de desenvolvimento não foi tocado. Contas de perfil criadas com `npm run seed:perfis`.

## Roteiro e resultado

| Parte | Como | Resultado |
|---|---|---|
| Testes automáticos | `npm test` | 55/55 antes; **58/58** depois das correções |
| Caixa: vender | Tela de Vendas: 2 arrozes + 1 leite = R$ 55,70; arroz adicionado duas vezes somou na mesma linha | ok |
| Caixa: cancelar a própria venda | Venda de R$ 3,50 cancelada; "estoque devolvido" | ok |
| Caixa: o que enxerga | Menu só Painel, Vendas, Produtos; painel sem faturamento; vendas só as próprias; API sem preço de custo | ok |
| Dono: estoque | Extrato: arroz 20→18, leite 14→13, biscoito 30→29 e 29→30 no cancelamento | ok |
| Dono: relatório | Hoje: R$ 55,70 em 1 venda (cancelada fora); mais vendidos: arroz 2, leite 1; tela igual à API | ok |
| Permissões dos 3 perfis | Script com 10 rotas × 3 perfis (caixa, estoque, financeiro) | **30/30** conforme esperado |
| Importação (planilha boa) | `planilhas-teste/produtos-para-importar.xlsx`: 29 cadastrados; 11 barrados por já existirem com outro código de barras | ok |
| Importação (planilha com erros) | `planilhas-teste/produtos-com-erros.xlsx`: nome vazio, preço "abc", estoque negativo e 31/02 barrados; prejuízo e sem código viram aviso | ok, com achado 2 |
| Exportação | 5 relatórios em CSV e XLSX; BOM presente (acentos abrem no Excel) | ok, com achado 4 |
| Contas | Cadastro, senha curta, "esqueci a senha" (mesma resposta com e-mail existente ou não), link de uso único, sessão antiga derrubada, senha nova | ok, com achado 5 |
| Planilha real do Seu João | Não encontrada nesta máquina | **pendente** |

## Achados

| # | Achado | Situação |
|---|---|---|
| 1 | Validade aparecia **um dia antes** (gravada como meia-noite UTC e lida no fuso local); selo de vencido e "dias para vencer" também; o alerta diário pulava o produto que vence hoje | corrigido em `fedb477` |
| 2 | Conferência da importação não mostrava troca de nome (a linha "Arroz Tipo 1 5kg (repetido)" renomeou o produto e baixou o mínimo de 10 para 5 sem aviso) | corrigido em `e1bf58f` |
| 3 | Importação aceitava validade já vencida sem avisar | corrigido em `e1bf58f` (aviso, não erro; desde `f33e8fc`, pelo dia de Brasília) |
| 4 | Planilha de movimentações: "Data/Hora" sem hora, no fuso do servidor, e tipo em inglês (`ENTRY`) | corrigido em `04bca1a`; no XLSX a Data/Hora é data, e não texto, desde `8c4e3ed` |
| 5 | O cadastro público cria um caixa ativo na hora: publicado na internet, qualquer pessoa poderia entrar e registrar vendas | Diego decidiu (25/11): a conta nasce **desativada** até o dono liberar. Feito em `08843e7` ([ADR-0020](docs/manter/adr/0020-cadastro-publico-nasce-desativado.md)) |

Cada correção tem teste automático que falha no código antigo e passa no novo, e as de tela foram conferidas no navegador.

## Não coberto

- Importação com a planilha real do Seu João (arquivo não está na máquina).
- Celular de verdade (a revisão de layout foi no modo celular do navegador, na Semana 12).
- Envio real de e-mail (SMTP ainda sem configuração).
- Impressão física do comprovante.
