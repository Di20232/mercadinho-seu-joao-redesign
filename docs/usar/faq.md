# Perguntas frequentes e erros comuns

As mensagens entre aspas são as que o sistema mostra, exatamente como aparecem.

## Entrar no sistema

### "Login incorreto."

O e-mail ou o nome de usuário não existe, ou a conta está **desativada**. Confira a digitação. Se estiver certa, peça ao dono para conferir a conta em Usuários.

### "Senha incorreta."

O usuário existe, mas a senha não confere. Use **Esqueci minha senha** ou peça ao dono uma senha nova.

### "Muitas tentativas de login. Tente novamente em alguns minutos."

Foram 10 tentativas em 15 minutos a partir da mesma rede. Espere 15 minutos. Numa loja com vários computadores na mesma internet, as tentativas de todos contam juntas.

### Esqueci a senha e o e-mail não chegou

1. Confira a caixa de spam.
2. O link só é enviado se o servidor tiver o envio de e-mail configurado. Sem isso, nenhum e-mail sai, mas a tela mostra a mesma mensagem de sempre (é de propósito, para não revelar quem tem conta).
3. **Funcionário:** peça ao dono. Ele define uma senha nova em **Usuários → lápis → Nova senha**.
4. **Dono:** peça a quem cuida do sistema. Existe um comando para isso ([runbook](../sustentar/runbooks.md#dono-esqueceu-a-senha)).

### O link de redefinir senha diz "Link de recuperação inválido, expirado ou já utilizado."

O link vale 30 minutos e uma vez só. Pedir outro link cancela o anterior. Peça um novo e use o mais recente.

### O sistema me tirou e pediu para entrar de novo

Acontece quando: passaram 8 horas desde a entrada; a senha da conta foi trocada (por você, pelo dono ou pelo "esqueci minha senha"); ou a conta foi desativada.

### Uma aba sumiu ou apareceu na barra lateral

O dono mudou as suas permissões. Vale na hora; atualize a página para a barra refletir.

### "Servidor indisponível. Verifique se o sistema está aberto e tente novamente."

O navegador não conseguiu falar com o servidor. Avise quem cuida do sistema. Se o sistema roda num computador da loja, ele pode estar desligado ou o Docker pode estar fechado ([runbook](../sustentar/runbooks.md#o-sistema-não-abre-ou-o-login-dá-erro)).

### "Não foi possível concluir o login. Verifique se o banco de dados/servidor está rodando e tente novamente."

O servidor respondeu, mas falhou por dentro. Quase sempre é o banco de dados fora do ar. Mesmo caminho do item acima.

## Vendas

### Não encontro o produto na busca

A busca procura **só no nome**; acento e maiúsculas não importam ("cafe" acha "Café"). Não aparecem produtos desativados nem produtos **aguardando preço** (cadastrados pelo estoque e ainda sem preço). Se o produto não existe, alguém com permissão de cadastro precisa cadastrar.

### ""Biscoito 200g" ainda está aguardando preço e não pode ser vendido."

O produto foi cadastrado sem preço. O dono ou o financeiro definem o preço pelo aviso "Aguardando preço" no Painel ou pelo filtro de mesmo nome em Produtos.

### O leitor de código de barras não adiciona o produto

A busca da venda ainda não procura por código de barras. Digite o nome. Essa melhoria está no [roadmap](../evoluir/roadmap-e-divida-tecnica.md).

### "Estoque insuficiente para "Arroz Branco 5kg" (disponível: 3)."

O estoque registrado é menor que a quantidade da venda. Nada foi gravado. Diminua a quantidade ou, se a mercadoria está na prateleira, peça ao dono para registrar a entrada e tente de novo.

### ""Arroz Branco 5kg" é vendido por UN: use uma quantidade inteira."

Produto contado (UN, PCT, CX, DZ...) não aceita fração. Só KG, G, L, LT, ML, M e MT aceitam. Se o produto é vendido a granel, quem cadastra produtos troca a unidade dele para KG (ou a que servir).

### "Use no máximo 3 casas decimais na quantidade." ou "A quantidade de "..." é pequena demais: o item sairia por R$ 0,00."

A quantidade digitada é miúda demais. Confira o número (ex.: 0,350 kg, não 0,0003).

### "O valor da venda excede o limite permitido pelo sistema."

A venda passou de R$ 5.000.000,00, ou um item sozinho passou desse valor. Quase sempre é quantidade digitada errada.

### Vendi errado. Como desfaço?

Em **Vendas → Vendas recentes → Cancelar**. Quem fez a venda pode cancelar sozinho nos **10 primeiros minutos**. Depois disso, só quem tem "Cancelar qualquer venda" (dono e financeiro). O estoque volta e a venda sai dos totais. Não dá para editar uma venda: cancele e registre de novo.

### "Você só pode cancelar a sua própria venda até 10 minutos depois de fechá-la."

Passou o prazo, ou a venda é de outra pessoa. Peça ao dono ou ao financeiro.

### A internet caiu na hora de confirmar a venda

Clique em **Confirmar venda** de novo **sem mexer no carrinho**. Se a venda já tinha sido gravada, o sistema mostra a mesma venda e não baixa o estoque outra vez. Se você mexer no carrinho antes, conta como venda nova: confira em Vendas recentes se a primeira entrou.

### "Conflito ao registrar a venda; tente de novo." ou "Esta chave de idempotência já foi usada em outra venda."

Raro: duas confirmações da mesma venda se cruzaram. Confira em Vendas recentes se a venda entrou antes de tentar de novo.

### A venda que quero cancelar não está nas recentes

A tela mostra só as 15 últimas. Para uma mais antiga, quem cuida do sistema consegue cancelar ([runbook](../sustentar/runbooks.md#cancelar-uma-venda-que-não-aparece-nas-recentes)).

### "Venda já cancelada."

Alguém já cancelou essa venda. O estoque já foi devolvido uma vez e não volta de novo.

### Por que eu não vejo todas as vendas?

De propósito: sem a permissão "Ver as vendas de todos", cada pessoa vê só as vendas que ela mesma fez. O dono e o financeiro veem todas.

### Dá para dar desconto, escolher forma de pagamento ou calcular troco?

Não. O sistema cobra o preço de venda cadastrado e não registra forma de pagamento.

### Instalei no celular, mas virou um atalho com o selo do Google

Foi criado um atalho, não o app. No Android, abra o endereço no **Chrome** (não dentro do app do Google ou de redes sociais) e toque em **Instalar app** no aviso. Apague o atalho antigo.

### O app mostra "sem conexão"

O celular ou o computador está sem internet. O sistema precisa de conexão para vender: nada fica guardado no aparelho. Volte quando a conexão voltar (ou anote as vendas no papel).

### O comprovante não imprime direito

O botão Imprimir usa a impressora padrão do computador, pela janela de impressão do navegador. Confira a impressora escolhida nessa janela.

## Produtos e estoque

### Um produto sumiu da lista

Foi desativado. Quem cadastra produtos (dono, financeiro, estoque) vê os inativos na lista de Produtos, marcados "Inativo"; no lápis do produto, há o botão **Reativar produto**.

### "Já existe um produto com este código de barras."

Outro produto, ativo ou inativo, já usa esse código. Procure-o na lista de Produtos (para quem cadastra, os inativos também aparecem) e corrija um dos dois.

### "Só o dono ou o financeiro podem definir preços."

Quem tem só a permissão de cadastrar produtos não manda preço. Salve sem preço; o produto fica aguardando preço até o dono ou o financeiro definirem.

### "Essa data não existe no calendário."

A validade digitada não existe (ex.: 30/02). Corrija a data.

### "Essa operação deixaria o estoque negativo."

A perda informada é maior que o estoque registrado. Confira a quantidade.

### O estoque do sistema não bate com a prateleira

Conte a prateleira e ajuste:

- se o sistema tem **mais** do que a prateleira: **Estoque → Perda ou ajuste**, com o motivo "acerto de inventário";
- se tem **menos**: **Estoque → Entrada de mercadoria**, com a observação "acerto de inventário";
- muitos produtos de uma vez: **Importar**, com a coluna de estoque em "Substituir o saldo atual (balanço)".

### Um produto com estoque zero aparece em "Estoque baixo", mesmo sem mínimo cadastrado

A regra é "estoque igual ou abaixo do mínimo". Com mínimo 0 e estoque 0, a conta dá 0 ≤ 0, e o produto entra no alerta. Está certo: ele acabou.

### Um produto novo não aparece em "Vai acabar em 7 dias"

A previsão usa as vendas dos últimos 30 dias. Sem vendas, não há ritmo para calcular. Ver [glossário](glossario.md#previsão-de-esgotamento).

## Importação de planilha

### "Não foi possível ler este arquivo Excel..." ou "Formato .xls não é lido diretamente..."

Abra o arquivo no Excel ou no Google Planilhas e salve como `.xlsx` ou `.csv`.

### "A planilha tem 1500 linhas de dados. O limite por importação é 1000..."

Divida o arquivo em partes de até 1.000 linhas e importe uma de cada vez.

### "Arquivo maior que o limite de 5 MB."

Apague colunas e abas que não são de produtos, ou divida o arquivo.

### "Indique qual coluna da planilha tem o nome do produto."

O sistema não reconheceu a coluna de nome pelo cabeçalho. Escolha a coluna certa na etapa "Confira as colunas".

### Aviso: ""1.000" foi lido como 1..."

Na planilha, "1.000" pode ser mil (jeito brasileiro) ou um (jeito americano). O sistema leu como um. Se era mil, corrija na planilha para "1000" e leia de novo.

### "O código de barras 789... já pertence ao produto "...""

O código da linha é de outro produto já cadastrado. O sistema recusa para não sobrescrever o outro produto. Corrija o código na planilha.

### "Existe mais de um produto cadastrado com este nome..."

Há dois produtos com o mesmo nome no cadastro. Coloque o código de barras na planilha para o sistema saber qual atualizar.

### "Preço de venda é obrigatório para cadastrar um produto novo."

A linha é de um produto que ainda não existe e está sem preço de venda.

## Relatórios e painel

### A planilha do histórico do estoque termina com "ATENÇÃO: mostrando as 20.000 movimentações mais recentes..."

O histórico tem mais linhas do que o limite de uma planilha. Filtre por tipo (Entradas, Vendas, Perdas, Ajustes) para baixar o resto em partes.

### A venda feita à noite aparece no dia seguinte

É uma limitação conhecida. O servidor conta os dias pelo horário universal (UTC), três horas à frente de Brasília. Vendas feitas depois das 21h podem aparecer no dia seguinte nos relatórios e no gráfico, e "Vendas hoje" pode começar a contar às 21h do dia anterior quando o sistema roda em Docker ou na nuvem. A correção está no [roadmap](../evoluir/roadmap-e-divida-tecnica.md).

### "Sem permissão para executar esta ação."

Sua conta não tem a permissão daquela ação. O dono marca as permissões de cada pessoa em Usuários ([quem pode fazer o quê](manual-do-usuario.md#quem-pode-fazer-o-quê)). Usuários é só do dono.

### "Erro interno do servidor."

Falha inesperada no servidor. Anote o horário e o que estava fazendo e avise quem cuida do sistema. O detalhe fica registrado no log do servidor.
