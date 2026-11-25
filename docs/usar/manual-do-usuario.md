# Manual do usuário

Para quem usa o sistema no dia a dia: o dono do mercadinho e a equipe (caixa, estoque, financeiro). Explica cada tela, quem pode fazer o quê e os fluxos principais.

Primeira vez? Comece pelo [início rápido](inicio-rapido.md). Dúvida pontual? Veja o [FAQ](faq.md). Termos e cálculos estão no [glossário](glossario.md).

## Quem pode fazer o quê

Existe **um dono** (o administrador) e o resto da **equipe**. **Todo mundo vende.** Além de vender, cada pessoa da equipe faz só o que o dono marcou para ela em **Usuários**.

### Permissões

| Permissão (como aparece na tela) | O que libera |
|---|---|
| Ver as vendas de todos | Lista de vendas com as vendas de toda a equipe, não só as próprias |
| Cancelar qualquer venda | Cancelar qualquer venda, a qualquer momento |
| Ver faturamento e relatórios (e exportar) | Vendas do dia e do mês no Painel, gráficos, produtos parados e a aba **Relatórios** |
| Definir preços, ver custo e lucro, importar planilha | Preço de custo e de venda, margem, o aviso "Aguardando preço" e a aba **Importar**. Também cadastra e edita produtos |
| Cadastrar e editar produtos (sem preço) | Cadastrar, editar, desativar e reativar produtos. Produto cadastrado assim fica **aguardando preço** |
| Dar entrada, registrar perda e ver o histórico do estoque | A aba **Estoque** |

### Tipos de pessoa

Ao criar uma conta, o dono escolhe um tipo, que já marca as permissões. Depois dá para marcar ou desmarcar uma a uma; aí o tipo vira "Personalizado".

| | Dono | Financeiro | Estoque | Caixa |
|---|:---:|:---:|:---:|:---:|
| Vender e imprimir comprovante | ✅ | ✅ | ✅ | ✅ |
| Cancelar a **própria** venda até 10 minutos depois | ✅ | ✅ | ✅ | ✅ |
| Consultar produtos, estoque e preço de venda | ✅ | ✅ | ✅ | ✅ |
| Alertas de estoque baixo, falta próxima e validade | ✅ | ✅ | ✅ | ✅ |
| Ver as vendas de todos | ✅ | ✅ | ❌ | ❌ |
| Cancelar qualquer venda | ✅ | ✅ | ❌ | ❌ |
| Faturamento, gráficos e Relatórios | ✅ | ✅ | ❌ | ❌ |
| Preços, custo, margem e Importar | ✅ | ✅ | ❌ | ❌ |
| Cadastrar e editar produtos | ✅ | ✅ (com preço) | ✅ (sem preço) | ❌ |
| Estoque: entradas, perdas e histórico | ✅ | ❌ | ✅ | ❌ |
| **Usuários**: criar contas e marcar permissões | ✅ | ❌ | ❌ | ❌ |

Quem decide é o servidor, não só a tela: se alguém tentar uma ação sem permissão, recebe "Sem permissão para executar esta ação." Quando o dono muda as permissões de alguém, vale **na hora**, mesmo com o sistema aberto.

O dono tem todas as permissões e é o único que mexe em **Usuários**. Há um só dono; toda conta nova (criada pelo dono ou pelo "Criar conta" da tela de entrada) é da equipe.

## Telas de acesso

### Entrar

Endereço inicial do sistema. Informe o **e-mail** ou o **nome de usuário** e a senha.

- O nome de usuário é criado sozinho no cadastro: primeiro nome, sem acento, mais quatro números (ex.: `diego1239`).
- O olho ao lado da senha mostra o que foi digitado.
- Se já houver uma sessão aberta no navegador, a tela pula direto para o sistema.
- A sessão dura **8 horas**. Depois disso o sistema pede para entrar de novo.
- Depois de 10 tentativas erradas em 15 minutos, a tela bloqueia novas tentativas por alguns minutos.
- Conta ainda não liberada pelo dono, ou desligada por ele: com a senha certa, aparece "Sua conta ainda não foi liberada, ou foi desativada. Fale com o dono do mercadinho." Com a senha errada, aparece só "Login incorreto."

### Criar conta

Link "Criar conta" na tela de entrada. Pede nome, e-mail, senha (mínimo de 8 caracteres) e a confirmação. A conta nasce como **caixa** (só vende) e **desligada**: a tela mostra o nome de usuário criado e avisa que o dono precisa liberar o acesso. A pessoa só entra depois que o dono liga a conta em Usuários; ali ele também marca outras permissões, se quiser. Assim, com o sistema na internet, um estranho não consegue se cadastrar e sair vendendo. Limite de 5 cadastros por hora a partir da mesma rede.

### Esqueci minha senha

1. Na tela de entrada, clique em **Esqueci minha senha** e informe o e-mail da conta.
2. A resposta é sempre a mesma ("Se o e-mail estiver cadastrado, ..."), exista o e-mail ou não. Isso é proposital: ninguém descobre por ali quem tem conta.
3. Chega um e-mail com um link. Ele vale por **30 minutos** e funciona **uma vez só**. Um pedido novo cancela o link anterior.
4. No link, escolha a nova senha. Todas as sessões abertas daquela conta, em qualquer aparelho, são encerradas.

O e-mail só sai se o servidor tiver o envio configurado. Sem isso, há outros caminhos (ver [FAQ](faq.md#esqueci-a-senha-e-o-e-mail-não-chegou)).

## A tela principal

- **Barra lateral** com as abas. Todos veem Painel, Vendas e Produtos. Sob "Gestão" aparecem só as abas que a pessoa pode usar: Estoque, Importar, Relatórios; Usuários só para o dono.
- A barra pode ser **recolhida** pelo botão "Recolher menu", no pé dela. O sistema lembra a escolha naquele navegador.
- No celular, a barra vira um menu aberto pelo botão ☰.
- No topo: o nome da tela, seu nome, seu nome de usuário e o tipo (`@diego1239 · dono`, `· equipe` ou `· caixa`), o botão de **tema claro/escuro** (sem escolha, segue o tema do aparelho) e o botão **Sair**.

## Painel

Primeira tela depois de entrar. Resume o que pede atenção.

**Todos veem:**

- **Estoque baixo**: produtos com estoque igual ou abaixo do mínimo cadastrado.
- **Vai acabar em 7 dias**: produtos que ainda não estão abaixo do mínimo, mas que, no ritmo de venda dos últimos 30 dias, acabam em até 7 dias.
- **Vencendo em breve**: produtos com validade nos próximos 7 dias, incluindo os já vencidos ("Vencido", "Vence hoje", "em 3 dia(s)").

**Quem define preços vê também:**

- **Aguardando preço**: produtos que o estoque cadastrou sem preço. O botão **Definir preço** abre o produto direto. Enquanto não tiver preço, o produto não aparece no caixa.

**Quem vê faturamento vê também:**

- **Vendas hoje**: total e quantidade desde a meia-noite.
- **Vendas no mês**: total e quantidade desde o dia 1º.
- **Ticket médio**: total do mês dividido pelo número de vendas do mês.
- **Alertas de estoque**: soma das três listas de alerta.
- Gráfico **Vendas dos últimos 14 dias** e as barras **Mais vendidos no mês** (os 5 que mais faturaram).
- **Produtos parados**: produtos com estoque e nenhuma venda nos últimos 60 dias, com o dinheiro parado em cada um.

Quem não vê faturamento recebe, no lugar dos indicadores de dinheiro, a contagem das três listas de alerta. Como cada número é calculado: [glossário](glossario.md#cálculos).

## Vendas

Tela do balcão. Funciona inteira pelo teclado.

### Registrar uma venda

1. Digite parte do **nome** do produto no campo de busca. Acento e maiúsculas não importam: "cafe", "CAFE" e "café" acham "Café". Aparecem até 8 resultados, com estoque (verde, amarelo se no mínimo, vermelho se zerado), categoria e preço. Produtos aguardando preço não aparecem.
2. Escolha com o mouse ou com as setas **↑ ↓** e **Enter**. **Esc** fecha a lista.
3. O produto entra nos **Itens da venda** com quantidade 1. Escolher o mesmo produto de novo soma mais uma unidade.
4. Ajuste a quantidade com **−** e **+** ou digitando. Fração (até 3 casas, ex.: 0,350) só para produto vendido por peso, volume ou comprimento: unidade KG, G, L, LT, ML, M ou MT. Nas demais (UN, PCT, CX, DZ...) a quantidade é inteira: se digitar fração, a tela arredonda na conta (confira o subtotal), e o servidor recusa fração que chegue por outro caminho.
5. A lixeira remove o item.
6. O **Resumo da venda** mostra itens, unidades e o total.
7. Clique em **Confirmar venda**.

Ao confirmar, o estoque de cada item sai na hora e a venda aparece em **Vendas recentes**. Abre o **comprovante**, com **Imprimir** (usa a impressora do computador) e **Nova venda**.

A venda é gravada inteira ou não é gravada. Se um item não tiver estoque suficiente, nada é registrado e aparece a mensagem com o nome do produto e quanto há disponível.

Se a internet cair bem na hora de confirmar e aparecer erro, clique em **Confirmar venda** de novo **sem mexer no carrinho**: se a venda já tinha sido gravada, o sistema mostra a mesma venda em vez de registrar outra. Mexer no carrinho conta como venda nova.

**Atenção:**

- A busca é **só pelo nome**. Ler o código de barras com leitor não adiciona o produto ([roadmap](../evoluir/roadmap-e-divida-tecnica.md)).
- O preço cobrado é sempre o preço de venda cadastrado no momento da venda. Não há desconto, forma de pagamento nem cálculo de troco no sistema.
- Limites de uma venda: até 100 produtos diferentes, até 10.000 unidades de cada um e até R$ 5.000.000,00 no total. Um item que sairia por R$ 0,00 (quantidade pequena demais) é recusado.
- Dois caixas vendendo os mesmos produtos ao mesmo tempo não se atrapalham: um espera o outro por uma fração de segundo, e o histórico do estoque grava os saldos em sequência.

### Vendas recentes e cancelamento

A lista mostra as **15 últimas** vendas: data e hora, vendedor, quantidade de itens e total. Quem não tem "Ver as vendas de todos" vê só as próprias.

O botão **Cancelar** aparece:

- em qualquer venda, para quem tem **Cancelar qualquer venda** (dono e financeiro);
- na **própria venda, até 10 minutos depois de confirmada**, para todos (para desfazer um engano no balcão).

O cancelamento:

- devolve ao estoque tudo o que foi vendido, mesmo que o produto tenha sido desativado depois;
- registra a devolução no histórico do estoque como "Ajuste", com o motivo "Cancelamento da venda ...";
- tira a venda dos totais, do painel e dos relatórios;
- não pode ser desfeito, e a mesma venda não pode ser cancelada duas vezes.

Só as 15 vendas da lista podem ser canceladas pela tela. Para uma venda mais antiga, peça a quem cuida do sistema ([runbook](../sustentar/runbooks.md#cancelar-uma-venda-que-não-aparece-nas-recentes)).

## Produtos

Catálogo com busca pelo nome e os filtros **Todos / Estoque baixo** e, para quem cadastra produtos, **Aguardando preço**. A lista mostra 20 produtos por página.

Cada linha traz nome, código de barras (ou unidade), categoria, estoque (vermelho quando está no mínimo ou abaixo), estoque mínimo, preço de venda (ou o selo "Aguardando preço") e validade (vermelho se vencido, amarelo se vence em até 7 dias). Quem define preços vê também a coluna **Custo**. Quem cadastra produtos vê também os desativados, marcados como "Inativo".

### Cadastrar um produto

Botão **Novo produto** (dono, financeiro e estoque). Campos:

| Campo | Obrigatório | Observação |
|---|:---:|---|
| Nome | sim | até 150 caracteres |
| Categoria | não | sugere as categorias já usadas, para não nascer "Mercearia" e "mercearia" |
| Código de barras | não | não pode repetir o de outro produto |
| Preço de venda | sim, para quem define preços | maior que zero |
| Preço de custo | sim, para quem define preços | pode ser zero |
| Unidade | sim | texto curto: UN, KG, PCT, CX... (padrão UN) |
| Validade | não | |
| Estoque mínimo | não | abaixo ou igual a isso, o produto entra nos alertas |
| Estoque inicial | não | só no cadastro; entra no histórico como entrada "Estoque inicial no cadastro" |

Quem define preços vê, enquanto digita, a **margem** em reais e em porcentagem do preço de venda (verde se positiva, vermelha se o custo é maior que a venda).

Quem cadastra **sem** permissão de preço (o tipo Estoque) não vê os campos de preço. O produto nasce **aguardando preço**: não aparece no caixa até o dono ou o financeiro definir o preço (pelo aviso no Painel ou pelo filtro "Aguardando preço" em Produtos).

### Editar, desativar e reativar

O lápis na linha abre o mesmo formulário. O estoque **não** se altera aqui: isso é feito na tela Estoque, para ficar registrado no histórico.

- **Desativar produto**: ele some das vendas e da lista de quem não cadastra produtos. Nada é apagado: o histórico de vendas continua.
- **Reativar produto**: aparece no lugar do botão de desativar quando o produto está inativo.

## Estoque

Para quem tem a permissão de estoque (dono e estoque). Toda mudança de estoque passa por aqui e fica registrada com data, quem fez, quantidade, saldo anterior e saldo novo. Não existe forma de editar ou apagar uma movimentação.

### Entrada de mercadoria

Para compra ou reposição. Escolha o produto, informe a quantidade que chegou e, se quiser, uma observação (ex.: "nota 1234, fornecedor X"). Antes de gravar, o formulário mostra o saldo atual e como fica ("16 UN → 28 UN").

### Perda ou ajuste

Para produto vencido, quebrado ou consumo interno. Escolha o produto, a quantidade a **remover** e o **motivo** (obrigatório). Fica registrado como "Perda". O sistema não deixa o estoque ficar negativo.

A tela só remove. Para corrigir um estoque que está abaixo do real (ex.: depois de uma contagem), use uma entrada com a observação "acerto de inventário", ou a importação de planilha com a opção de substituir o saldo.

### Histórico de movimentações

Lista de tudo o que mexeu no estoque, mais recente primeiro, 20 por página, com filtro **Todas / Entradas / Vendas / Perdas / Ajustes**. O botão de planilha baixa em Excel até as 20.000 movimentações mais recentes do filtro escolhido, com data e hora de Brasília em cada linha (no Excel a coluna é data, então ordena e filtra); se houver mais, a última linha da planilha avisa quantas ficaram de fora.

| Tipo | Quando aparece |
|---|---|
| Entrada | Entrada de mercadoria, estoque inicial no cadastro, importação somando ao saldo |
| Venda | Cada item de cada venda |
| Perda | Perda registrada nesta tela |
| Ajuste | Cancelamento de venda, importação que substitui o saldo |

## Importar

Para quem define preços (dono e financeiro). Cadastra ou atualiza muitos produtos de uma vez a partir de uma planilha. **Nada é gravado antes da última confirmação.**

1. **Escolha a planilha.** Arraste o arquivo, clique para escolher ou cole os dados copiados do Excel ou do Google Planilhas. Aceita `.xlsx`, `.xlsm`, `.csv`, `.txt` e `.tsv`, até 5 MB e 1.000 linhas. Arquivos `.xls` e `.ods` precisam ser salvos antes como `.xlsx` ou `.csv`. Há um **modelo** em Excel para baixar, já com as colunas certas. A pasta `planilhas-teste/` do projeto tem duas planilhas de exemplo, uma boa e uma com erros, para treinar.
2. **Confira as colunas.** O sistema reconhece as colunas pelo cabeçalho (ex.: "EAN", "VLR VENDA", "QTDE", "VENCIMENTO") e mostra um exemplo real de cada uma. Corrija o que ele não acertou. A coluna de nome é obrigatória.
3. **Escolha como aplicar:**
   - *Produtos:* cadastrar novos e atualizar existentes, só cadastrar novos, ou só atualizar existentes.
   - *Identificar o produto por:* código de barras (e nome quando faltar o código) ou só pelo nome.
   - *Coluna de estoque:* usar só no cadastro de produtos novos, **substituir** o saldo atual (balanço) ou **somar** ao saldo atual (entrada de mercadoria).
4. **Confira o que será gravado.** Cada linha aparece como criar, atualizar, ignorar ou erro, com o motivo, o preço antigo e o novo, o estoque antigo e o novo. Num produto que já existe, as observações dizem também o que mais a linha muda: nome, categoria, unidade, estoque mínimo e validade (ex.: Nome muda de "Arroz 5kg" para "Arroz Tipo 1"). Validade que já passou também gera aviso. **Avisos** não impedem a gravação. **Erros** impedem: a linha não é gravada.
5. **Confirme.** O resultado mostra quantos produtos foram criados, atualizados e ignorados, e lista as linhas que não puderam ser gravadas.

Proteções:

- Valores escritos do jeito brasileiro funcionam: "R$ 12,50", "1.234,56", "31/12/2026".
- "1.000" numa coluna de número gera aviso, porque pode ser mil ou um.
- Um código de barras que já é de outro produto é recusado, nunca sobrescrito.
- Duas linhas com o mesmo código (ou o mesmo nome sem código) no arquivo viram erro.
- Cada linha é gravada sozinha: uma linha com problema não desfaz as outras.
- Toda mudança de estoque feita pela importação entra no histórico do estoque.

## Relatórios

Para quem vê faturamento (dono e financeiro). Escolha o período: **Hoje**, **7 dias**, **30 dias** (padrão), **Este mês**, **Tudo**, ou as datas **De** e **Até** com **Aplicar**. A data "Até" conta o dia inteiro.

- **Indicadores:** total vendido, número de vendas, ticket médio e melhor dia.
- **Vendas por dia:** gráfico do período, com os dias sem venda em zero.
- **Mais vendidos:** os 10 produtos que mais faturaram no período, com quantidade e valor.
- **Resumo por dia:** tabela com o total e a quantidade de vendas de cada dia.
- **Capital parado em estoque:** produtos sem venda nos últimos 60 dias (não depende do período escolhido).

Os botões de planilha baixam o resumo por dia e os mais vendidos em Excel. Vendas canceladas não entram em nenhum relatório.

**Enviar por e-mail:** manda o relatório do período escolhido para um endereço (vem preenchido com o seu e-mail). Vai um resumo no corpo (total, vendas, ticket médio, 5 mais vendidos, produtos parados) e um Excel com uma aba por relatório: resumo, vendas por dia, mais vendidos (50), produtos parados e previsão de estoque. Só funciona com o envio de e-mail configurado no servidor; são até 10 envios a cada 15 minutos.

## Instalar no celular

O sistema pode virar um app no celular, com ícone próprio e tela cheia. Quando ele é aberto no celular pelo navegador, aparece o aviso **Instale o Mercadinho no celular**:

- No Android, use o **Chrome** e toque em **Instalar app**. Pelo menu "Adicionar à tela inicial → Criar atalho", ou de dentro de outros apps (Google, redes sociais), sai só um atalho com o selo do navegador. O aviso explica o caminho quando a instalação direta não está disponível, e o botão **Copiar link** ajuda a abrir no Chrome.
- No iPhone, use o Safari: **Compartilhar → Adicionar à Tela de Início**.
- **Agora não** esconde o aviso.

O app não funciona sem internet: sem conexão, ele mostra uma página avisando, e nada de estoque, preço ou venda fica guardado no aparelho. A instalação só aparece com o sistema publicado em HTTPS (ou em `localhost`).

## Usuários (só o dono)

Lista de contas com nome, nome de usuário, e-mail, tipo (Dono, Financeiro, Estoque, Caixa ou Personalizado) e situação.

- **Novo usuário**: nome, e-mail, senha (mínimo de 8 caracteres, com medidor de força), **tipo de pessoa** e as permissões. A conta nova começa como Caixa; escolher outro tipo marca as permissões dele, e dá para ajustar uma a uma.
- **Editar** (lápis): troca o nome, as permissões, liga ou desliga a conta e define uma nova senha (deixe em branco para manter). A conta do dono não tem permissões para marcar: ele tem todas.
- Mudar permissões, desligar a conta ou trocar a senha de alguém vale **na hora**, mesmo de quem está com o sistema aberto. Trocar a senha encerra as sessões abertas da pessoa.
- O dono troca a própria senha do mesmo jeito, no lápis da própria conta; depois disso o sistema pede para entrar de novo.
- O dono não consegue desativar a própria conta, para não ficar trancado fora do sistema.
- O e-mail de uma conta não se altera depois de criada, e contas não são apagadas, só desativadas.
- Quem se cadastrou pelo "Criar conta" aparece aqui **desligado**. Para liberar, abra o lápis da pessoa e ligue a conta.

## Uso no celular e no notebook do caixa

As telas se ajustam a celular (a partir de 375 px de largura), notebook e monitor. No celular, o menu fica no botão ☰ e as tabelas rolam para o lado. Na tela de Vendas, o carrinho e as vendas recentes viram cartões, sem rolar: cada item mostra nome, preço, quantidade, subtotal e a lixeira.
