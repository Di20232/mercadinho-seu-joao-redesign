# Novidades do sistema

O que mudou para quem usa, em linguagem do dia a dia. A lista técnica completa está no [changelog](../evoluir/changelog.md).

## 25/11/2026

- **Saiu o "Enviar por e-mail" dos Relatórios.** Para mandar os números a alguém, baixe a planilha e anexe no seu e-mail.
- **Cadastro com liberação do dono.** Quem cria conta pela tela "Criar conta" fica esperando: o dono libera em Usuários. Antes, a pessoa já entrava vendendo.
- **Validade com a data certa.** A validade aparecia um dia antes (26/11 virava 25/11), e o produto que vence hoje ficava fora do e-mail diário.
- **Importação avisa o que muda.** Na conferência, a linha que troca nome, categoria, unidade, mínimo ou validade de um produto que já existe aparece com aviso, assim como validade vencida.
- **Planilha do histórico com hora.** A planilha do histórico do estoque traz data e hora de Brasília; no Excel a coluna continua sendo data, para ordenar e filtrar.
- **Vendas no celular sem cortes.** Com produtos no carrinho, a tela de Vendas passava da borda do celular e escondia o subtotal e o botão de remover. Agora cada item do carrinho e cada venda recente aparece como um cartão, sem rolar para o lado.

## 24/11/2026

- **Busca sem acento.** "cafe", "CAFE" e "café" acham "Café", na venda e em Produtos.
- **App no celular.** O sistema pode ser instalado como aplicativo, com ícone próprio. O aviso "Instale o Mercadinho no celular" mostra o caminho certo no Android (Chrome) e no iPhone (Safari). Sem internet, aparece uma página avisando.
- **Telas no celular e no notebook do caixa.** As telas se ajustam a celular (375 px) e a notebook, com botões maiores para o dedo. No celular, o menu abre pelo botão ☰ e as tabelas rolam para o lado.
- **Venda mais segura:** dois caixas vendendo os mesmos produtos ao mesmo tempo não dão mais erro; produto contado (UN, PCT, CX) só aceita quantidade inteira; item que sairia por R$ 0,00 é recusado.
- **Gráfico do Painel** não sobrepõe mais as datas do último dia.
- A planilha do histórico do estoque traz o tipo em português (Entrada, Venda, Perda, Ajuste) e até 20.000 linhas, avisando quando corta.

## 13/11/2026

- A previsão de "dias até acabar" mostra número inteiro.

## 06/11/2026: relatório por e-mail

- **Enviar relatório por e-mail**, em Relatórios: resumo no corpo e um Excel com uma aba por relatório.
- Planilhas exportadas não desalinham mais quando o texto tem ponto e vírgula ou aspas.
- O primeiro acesso depois de o sistema ficar parado não dá mais erro nem demora.
- Planilha de exemplo com 300 produtos em `planilhas-teste/`.

## 06/11/2026: permissões por pessoa

- **Cada pessoa faz só o que o dono marcar.** Em Usuários, o dono escolhe o tipo de pessoa (**Financeiro**, **Estoque** ou **Caixa**) e pode ajustar cada permissão. Todos continuam vendendo. Contas que já existiam continuam só vendendo, como antes.
- **Produto aguardando preço.** Quem é do estoque cadastra o produto sem preço; o dono ou o financeiro recebem o aviso no Painel e definem o preço. Até lá, o produto não aparece no caixa.
- **O caixa cancela a própria venda** nos 10 primeiros minutos, para desfazer um engano no balcão.
- Duas planilhas de exemplo na pasta `planilhas-teste/` para treinar a importação.

## 30/10/2026

- **Venda não duplica** quando a internet cai na hora de confirmar: confirmar de novo o mesmo carrinho mostra a venda que já tinha entrado.

## 26/10/2026: visual novo

- **Visual novo em todas as telas**, com barra lateral que recolhe, **tema escuro** e animações (que respeitam a opção "reduzir movimento" do aparelho).
- **Painel** com indicadores (vendas hoje, no mês, ticket médio, alertas), gráfico dos últimos 14 dias e os mais vendidos do mês.
- **Vendas** pelo teclado: setas e Enter na busca, carrinho com − e +, comprovante com botão de imprimir.
- **Produtos**: filtro "Estoque baixo", validade vencida em vermelho, formulário com a margem calculada enquanto você digita e sugestão de categorias.
- **Estoque**: mostra o saldo antes e depois ("16 UN → 28 UN") antes de gravar; histórico com filtro por tipo e botão de planilha.
- **Importar**: etapas numeradas e área para soltar o arquivo.
- **Relatórios**: períodos rápidos (o padrão passou a ser **30 dias**; antes era "tudo"), indicadores, gráfico por dia e ranking com barras.
- **Usuários**: selos de perfil e situação e medidor de força da senha.
- As confirmações ("Cancelar esta venda?", "Desativar produto?") abrem numa janela do próprio sistema. **Esc** fecha só a confirmação.

## 23/10/2026

- **Planilhas para baixar** em Relatórios (resumo por dia, mais vendidos) e no histórico do Estoque.

## 16/10/2026

- Trocar a senha encerra as sessões abertas da conta em outros aparelhos.
- O administrador não nasce mais com uma senha padrão.

## 14/10/2026

- **Novo nome: Mercadinho do João.**
- **Entrar com o nome de usuário** (ex.: `diego1239`), além do e-mail.
- O sistema abre em qualquer endereço da rede da loja (outra porta, IP do computador), não só no endereço configurado.

## 02/10/2026

- **Criar conta** na tela de entrada (a conta nasce como funcionário).
- **Esqueci minha senha**, com link que vale 30 minutos.
- Listas com páginas e **comprovante de venda**.

## 08/09/2026

- **Importar produtos** de planilha Excel ou CSV, ou colando do Excel.

## 27/08/2026

- Primeira versão: vendas, produtos, estoque com histórico, previsão de esgotamento, produtos parados, alertas de validade, relatórios e usuários.
