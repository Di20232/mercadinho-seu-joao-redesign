# Material de treinamento

Roteiros e exercícios guiados para ensinar o sistema. **Ainda não há vídeos gravados**: cada módulo abaixo serve de roteiro para gravar (tela do computador + narração), com a duração sugerida.

## Antes de treinar: ambiente de prática

Treine num ambiente de demonstração, **nunca no sistema de produção da loja**: os exercícios fazem vendas, perdas e cancelamentos que mexeriam nos números reais.

Quem cuida do sistema prepara o ambiente local com dados de exemplo (detalhes no [guia de desenvolvimento](../manter/guia-de-desenvolvimento.md)):

```powershell
docker compose up -d --build
```
```powershell
docker compose exec app npm run seed
```
```powershell
docker compose exec app npm run seed:products
```
```powershell
docker compose exec app npm run simulate:sales
```

Isso cria o dono (com o e-mail e a senha do `.env`), 24 produtos de exemplo com validades variadas e cerca de duas semanas de vendas entre dois vendedores, uma delas a funcionária de demonstração "Maria Caixa". Endereço: `http://localhost:3100`.

Para treinar cada tipo de pessoa, crie também uma conta de teste de cada tipo (Financeiro, Estoque, Caixa). A senha delas está no topo de `prisma/seedPerfis.js`; o script se recusa a rodar em produção:

```powershell
docker compose exec app npm run seed:perfis
```

## Módulo 1: Caixa (30 minutos)

Público: funcionários do balcão. Pré-requisito: conta de funcionário criada pelo dono.

| Passo | Mostrar | Fala-chave |
|---|---|---|
| 1 | Tela de entrada, e-mail ou nome de usuário, olho da senha | "Seu login curto é o que aparece no topo, com @." |
| 2 | Painel do caixa: estoque baixo, vai acabar, vencendo | "Se vir algo vencendo, avise o dono." |
| 3 | Vendas: busca por nome, setas, Enter | "A busca é pelo nome; acento e maiúscula não importam." |
| 4 | Carrinho: − e +, lixeira; fração só em produto por KG, L etc. | "O total aqui é prévia; o sistema confirma o preço ao gravar." |
| 5 | Confirmar venda, comprovante, Imprimir, Nova venda | |
| 6 | Erro de estoque insuficiente | "Nada foi gravado. Ajuste e confirme de novo." |
| 7 | Vendas recentes (só as próprias), botão Cancelar | "Errou? Você tem 10 minutos para cancelar. Depois, chame o dono ou o financeiro." |
| 8 | Produtos: buscar e ver estoque e preço | |
| 9 | Tema escuro, Sair | "Sempre saia ao trocar de turno." |

### Exercícios do caixa

1. Venda 2 "Arroz Branco 5kg" e 1 "Feijão Carioca 1kg". **Esperado:** total igual a 2 × preço do arroz + preço do feijão; comprovante com 2 itens.
2. Coloque "Água Mineral 1,5L" duas vezes pela busca. **Esperado:** uma linha só, com quantidade 2.
3. Tente vender 999 unidades de "Molho de Tomate 340g". **Esperado:** "Estoque insuficiente para "Molho de Tomate 340g" (disponível: ...)" e nenhuma venda gravada.
4. Procure "cafe" e depois "CAFÉ". **Esperado:** as duas acham "Café Torrado e Moído 500g".
4b. Coloque "Arroz Branco 5kg" e digite 1,5 na quantidade. **Esperado:** o subtotal é o de 2 unidades: produto por UN só aceita inteiro e a tela arredonda (o número digitado continua 1,5 no campo, mas a conta usa 2).
5. Encontre o login curto de você mesmo no topo da tela, saia e entre usando ele.
6. Faça uma venda e cancele em Vendas recentes logo em seguida. **Esperado:** "Venda cancelada e estoque devolvido." (Depois de 10 minutos o botão some.)

## Módulo 2: Estoque (30 minutos)

Público: quem recebe mercadoria e cuida das prateleiras. Pré-requisito: módulo 1 e conta do tipo Estoque.

| Passo | Mostrar |
|---|---|
| 1 | Barra lateral com a aba Estoque; sem Relatórios nem Importar |
| 2 | Estoque: entrada com prévia do saldo, perda com motivo, histórico e filtros |
| 3 | Produtos: novo produto **sem** campos de preço; selo "Aguardando preço" |
| 4 | Por que o produto novo não aparece na venda até ter preço |

### Exercícios do estoque

1. Cadastre "Biscoito Teste 200g" com estoque inicial 12. **Esperado:** produto com o selo "Aguardando preço" e uma entrada "+12" no histórico.
2. Procure "Biscoito Teste" na tela de Vendas. **Esperado:** não aparece.
3. Registre perda de 2 com motivo "embalagem rasgada". **Esperado:** "Perda", "−2", "12 → 10".

## Módulo 3: Dono e financeiro (60 minutos)

Público: o dono e quem for do financeiro. Pré-requisito: módulo 1. Os itens 4 e 8 são só do dono (estoque e usuários).

| Passo | Mostrar |
|---|---|
| 1 | Painel: KPIs, gráfico de 14 dias, mais vendidos, produtos parados, **Aguardando preço** |
| 2 | Produtos: novo produto, margem ao vivo, categoria sugerida, estoque inicial; filtro "Aguardando preço" |
| 3 | Editar produto, desativar, ver "Inativo", reativar |
| 4 | Estoque: entrada com prévia do saldo, perda com motivo, histórico e filtros, planilha |
| 5 | Vendas recentes: vendas de todos, cancelar e conferir a devolução no histórico do estoque |
| 6 | Importar: baixar modelo, preencher 3 linhas, conferir colunas, opções, prévia, confirmar |
| 7 | Relatórios: períodos, indicadores, gráfico, mais vendidos, capital parado, planilhas |
| 8 | Usuários: criar uma pessoa de cada tipo, ajustar uma permissão ("Personalizado"), desligar conta, trocar senha, trocar a própria senha |

### Exercícios do dono e do financeiro

1. No Painel, em **Aguardando preço**, clique em **Definir preço** no "Biscoito Teste 200g" do módulo 2 e informe venda R$ 4,00 e custo R$ 5,00. **Esperado:** margem em vermelho, R$ −1,00; o produto sai do aviso e passa a aparecer na busca da venda.
2. (Dono) Dê entrada de 5 unidades nele com a observação "nota 1". **Esperado:** no histórico, "Entrada", "+5", saldo "10 → 15".
3. (Dono) Registre perda de 1 com motivo "amassado". **Esperado:** "Perda", "−1", "15 → 14".
4. Peça a um caixa para vender 1 unidade e, 11 minutos depois, cancele você. **Esperado:** o caixa já não tem o botão; você tem; no histórico, "Venda −1" e depois "Ajuste +1" com motivo "Cancelamento da venda ..."; estoque de volta a 14; a venda some dos Relatórios.
5. Importe a planilha modelo sem mudar nada, com "Cadastrar novos e atualizar existentes". **Esperado:** prévia com 2 produtos a criar; depois de confirmar, os dois aparecem em Produtos e, como o modelo tem estoque, há duas entradas "Importação de planilha (estoque inicial)" no histórico.
6. Importe de novo o mesmo arquivo com "Somente cadastrar novos". **Esperado:** as 2 linhas como "ignorar", nada gravado.
7. (Dono) Crie a conta de um funcionário, entre com ela em outra janela anônima, desligue a conta pela tela Usuários e atualize a janela do funcionário. **Esperado:** ele volta para a tela de entrada.
8. Em Relatórios, escolha "Hoje" e baixe a planilha do resumo. **Esperado:** arquivo `.xlsx` com a venda do exercício 4 fora (foi cancelada).

## Módulo 4: Quem cuida do sistema (90 minutos)

Público: quem vai dar suporte técnico. Segue a ordem da [transferência de conhecimento](../aceite/transferencia-de-conhecimento.md): subir o ambiente local, rodar os testes, ler a arquitetura, simular os incidentes dos [runbooks](../sustentar/runbooks.md) (Docker fechado, porta ocupada, senha do dono perdida) e fazer um backup e uma restauração em banco de teste.

## Avaliação

O treinamento está concluído quando a pessoa faz os exercícios do seu módulo sem ajuda. Anote dúvidas que aparecerem: elas viram perguntas novas no [FAQ](faq.md).
