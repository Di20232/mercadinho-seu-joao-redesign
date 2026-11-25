# Glossário de negócio

Termos que aparecem nas telas, as regras que o sistema aplica e como cada número é calculado. Entre parênteses, onde a regra está no código, para quem precisar conferir.

## Termos

| Termo | Significado |
|---|---|
| **Dono / Administrador** | A única conta com todas as permissões e a única que mexe em Usuários. No código: `role = ADMIN`. |
| **Equipe** | Todas as outras contas. Vendem e fazem o que o dono marcou. No código: `role = CASHIER` mais a lista `permissions`. |
| **Permissão** | Algo que a pessoa pode fazer além de vender: ver as vendas de todos (`sales.viewAll`), cancelar qualquer venda (`sales.cancel`), ver faturamento e relatórios (`reports.view`), definir preços (`prices.manage`), cadastrar produtos (`products.manage`), mexer no estoque (`stock.manage`). (`src/permissions.js`) |
| **Tipo de pessoa** | Conjunto pronto de permissões: **Financeiro** (vendas de todos, cancelar, relatórios, preços), **Estoque** (produtos e estoque), **Caixa** (nenhuma além de vender). Permissões fora de um conjunto pronto aparecem como **Personalizado**. |
| **Caixa** | Pessoa da equipe sem permissão extra: vende, consulta e cancela a própria venda nos 10 primeiros minutos. |
| **Aguardando preço** | Produto sem preço de custo ou de venda, cadastrado por quem não define preços. Não pode ser vendido nem aparece na busca do caixa. |
| **Chave de idempotência** | Código que a tela de vendas manda junto com cada confirmação. Repetir a confirmação do mesmo carrinho (ex.: depois de a internet cair) devolve a venda já gravada em vez de registrar outra. No código: cabeçalho `Idempotency-Key`. |
| **Nome de usuário** | Login curto criado sozinho: primeiro nome sem acento + 4 números (ex.: `diego1239`). Se os de 4 números acabarem para um nome muito comum, usa 6. (`src/username.js`) |
| **Produto ativo / inativo** | Inativo é o produto "removido". Não aparece em vendas novas nem para o caixa, mas continua no banco com todo o histórico, e o dono pode reativar. |
| **Unidade** | Como o produto é contado: UN, KG, PCT, CX, L... Texto livre de até 10 letras. Decide se a venda aceita fração: só KG, G, L, LT, ML, M e MT aceitam (`src/units.js`); as outras pedem quantidade inteira. Não muda nenhum outro cálculo. |
| **Estoque atual** | Quantidade registrada no sistema. Aceita até 3 casas decimais (venda a peso). Nunca fica negativa e nunca passa de 50.000.000. |
| **App instalado** | O sistema aberto como aplicativo no celular (PWA), com ícone próprio. É o mesmo sistema do navegador e precisa de internet. |
| **Estoque mínimo** | Quantidade a partir da qual o produto é considerado "Estoque baixo". Definido pelo dono em cada produto. |
| **Movimentação** | Registro de qualquer mudança de estoque: tipo, quantidade, saldo anterior, saldo novo, motivo, quem fez e quando. Não se edita nem se apaga. |
| **Entrada** | Movimentação que soma ao estoque: compra, estoque inicial do cadastro, importação somando ao saldo. No código: `ENTRY`. |
| **Venda** (movimentação) | Saída de estoque de cada item vendido. No código: `SALE`. |
| **Perda** | Saída registrada pelo dono: vencido, quebrado, consumo interno. Motivo obrigatório. No código: `LOSS`. |
| **Ajuste** | Correção de saldo: devolução por cancelamento de venda, importação que substitui o saldo. No código: `ADJUSTMENT`. |
| **Venda cancelada** | Venda desfeita pelo dono. Continua guardada, mas fica fora de todos os totais e relatórios, e o estoque dos itens volta. |
| **Comprovante** | Resumo da venda mostrado depois de confirmar, com botão de imprimir. Não é documento fiscal. |
| **Importação** | Cadastro ou atualização de produtos a partir de planilha, em etapas, com conferência antes de gravar. |
| **Capital parado** | Dinheiro preso em produto que não vende. |
| **Ticket médio** | Valor médio de cada venda. |

## Regras

| Regra | Detalhe |
|---|---|
| Preço da venda | Sempre o preço de venda cadastrado no momento em que a venda é confirmada. O que a tela mostra no carrinho é só uma prévia: quem calcula o total é o servidor. (`src/routes/sales.js`) |
| Venda tudo ou nada | Se um item não tiver estoque, a venda inteira é recusada e nada é gravado. |
| Produto repetido na venda | A tela soma a quantidade numa linha só. O servidor recusa a mesma venda com o mesmo produto em duas linhas. |
| Limites de uma venda | 1 a 100 produtos diferentes; até 10.000 de cada, com no máximo 3 casas decimais; quantidade inteira para unidades contadas; nenhum item por R$ 0,00; total até R$ 5.000.000,00. |
| Busca de produto | Pelo nome, ignorando acento e maiúsculas. |
| Limites de um produto | Preços até R$ 1.000.000,00; preço de venda maior que zero; estoque mínimo e quantidades de entrada até 1.000.000. |
| Preço | Só o dono e quem tem "Definir preços" informam preço. Quem só cadastra produtos não pode mandar preço nem para apagar. Sem preço de custo **ou** sem preço de venda, o produto fica aguardando preço. |
| Repetir a confirmação | Com o mesmo carrinho, devolve a mesma venda (não duplica nem baixa o estoque de novo). Com carrinho diferente, é outra venda. |
| Código de barras | Opcional, mas único: dois produtos não têm o mesmo código, nem se um deles estiver inativo. |
| Validade | Opcional. Precisa ser uma data que existe (30/02 é recusado). |
| Desativar produto | Não apaga nada. O histórico de vendas e de estoque continua ligado ao produto. |
| Cancelamento | Quem tem "Cancelar qualquer venda": qualquer venda, a qualquer hora. Os demais: só a própria venda, até 10 minutos depois de confirmada. Uma vez por venda. Devolve o estoque mesmo de produto já desativado. |
| Ver vendas | Sem "Ver as vendas de todos", cada pessoa vê e abre só as próprias vendas. |
| Contas novas | Sempre da equipe, venham do "Criar conta" (sem permissões e **desligada** até o dono liberar) ou da tela Usuários (com as permissões que o dono marcar). Há um só dono. |
| Permissões | Só o dono marca. Valem na hora, mesmo com o sistema aberto. |
| Desativar conta | Corta o acesso na hora, inclusive de quem está com o sistema aberto. O dono não desativa a si mesmo. |
| Senha | Mínimo de 8 caracteres. Trocar a senha encerra as sessões abertas da conta. |
| Sessão | Dura 8 horas. |
| Link de nova senha | Vale 30 minutos, uma vez só; pedir outro cancela o anterior. |
| Data "Até" nos relatórios | Inclui o dia inteiro. |
| Dia nos relatórios | Contado em horário universal (UTC). Ver [limitação conhecida](faq.md#a-venda-feita-à-noite-aparece-no-dia-seguinte). |

## Cálculos

### Margem

**Margem = preço de venda − preço de custo.**
No formulário de produto aparece também em porcentagem: margem ÷ preço de venda × 100. Exemplo: venda R$ 24,90 e custo R$ 18,50 dão margem de R$ 6,40, ou 25,7%. Só quem define preços vê custo e margem. Produto aguardando preço não tem margem.

### Total da venda

**Total = soma de (preço de venda × quantidade) de cada item**, arredondada em centavos.

### Vendas hoje e Vendas no mês (Painel)

Soma das vendas não canceladas desde a meia-noite (hoje) ou desde o dia 1º (mês), no relógio do servidor. Em Docker ou na nuvem, o relógio do servidor é UTC.

### Ticket médio

**Ticket médio = total vendido ÷ número de vendas.** No Painel, do mês corrente. Nos Relatórios, do período escolhido.

### Estoque baixo

O produto entra no alerta quando **estoque atual ≤ estoque mínimo**. Só produtos ativos.

### Previsão de esgotamento

Para cada produto ativo (`src/forecast.js`):

1. **Venda média diária** = tudo o que saiu por venda nos últimos **30 dias** ÷ 30. A janela muda pela configuração `FORECAST_WINDOW_DAYS`.
2. **Dias até esgotar** = estoque atual ÷ venda média diária, arredondado para o número inteiro mais próximo. Sem nenhuma venda na janela, não há previsão ("Sem consumo").

Exemplo: 45 unidades vendidas em 30 dias dão 1,5 por dia. Com 9 em estoque, acaba em 6 dias.

**Vai acabar em 7 dias** (Painel e e-mail diário) = produtos que **não** estão em "Estoque baixo" e têm previsão de até 7 dias.

Limitação: a venda cancelada continua contando na média, porque o cálculo olha as saídas por venda e o cancelamento entra como ajuste. Está na [dívida técnica](../evoluir/roadmap-e-divida-tecnica.md).

### Vencendo em breve

Produtos ativos com validade **até hoje + 7 dias**. No Painel, entram também os já vencidos. No e-mail diário, só os que ainda não venceram. Os 7 dias mudam pela configuração `EXPIRY_ALERT_DAYS`.

### Produtos parados e capital parado

**Produto parado** = produto ativo, com estoque maior que zero e **nenhuma venda nos últimos 60 dias**.
**Capital parado = estoque atual × preço de custo** (produto sem custo conta como zero).
Exemplo: 12 pacotes com custo de R$ 7,90 prendem R$ 94,80.
Painel e Relatórios usam 60 dias. A API aceita de 1 a 365 dias.

### Mais vendidos

Ranking por **faturamento** (soma dos subtotais) das vendas não canceladas do período. O Painel mostra os 5 primeiros do mês; os Relatórios, os 10 primeiros do período.

### Melhor dia

Nos Relatórios, o dia do período com maior total vendido.

## E-mail de alerta diário

Se o envio de e-mail estiver configurado, todo dia às **8h** (relógio do servidor, ajustável por `LOW_STOCK_ALERT_HOUR`) o sistema manda para os endereços de `ALERT_EMAIL_TO` um texto com três listas: estoque abaixo do mínimo, previsão de esgotar em até 7 dias e produtos perto do vencimento. Dia sem nenhum alerta, sem e-mail. Em Docker ou na nuvem o relógio é UTC: 8h UTC são 5h em Brasília.
