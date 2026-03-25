# Versão offline direta

Esta versão foi ajustada para abrir com duplo clique no `index.html`, sem VS Code, Live Server ou Python.

# Portal de Vendas Cozinha da Gabriela

MVP inicial da plataforma multiusuário para vendedores parceiros da Cozinha da Gabriela.

## O que já está nesta primeira versão

- Login e criação de cadastro para vendedores
- Aprovação / bloqueio / inativação de vendedores
- Limite inicial de 20 vendedores ativos
- Painel do vendedor com:
  - dashboard
  - clientes
  - compras de mercadoria
  - vendas
  - financeiro
  - informativos
- Painel do administrador com:
  - visão geral da rede
  - gestão de vendedores
  - publicação de informativos
- Gráficos visuais com Chart.js
- Estrutura separada em projeto próprio

## Estrutura de dados usada

### `users/{uid}`
Campos principais:
- `uid`
- `name`
- `email`
- `phone`
- `city`
- `role` → `admin` ou `vendor`
- `status` → `pending`, `active`, `blocked`, `inactive`

### `clients`
- `ownerId`
- `name`
- `phone`
- `city`
- `notes`

### `purchases`
- `ownerId`
- `productName`
- `quantity`
- `unitCost`
- `total`
- `paymentType`
- `dueDate`
- `status`

### `sales`
- `ownerId`
- `clientId`
- `clientName`
- `productName`
- `quantity`
- `unitPrice`
- `total`
- `paymentType`
- `dueDate`
- `status`

### `expenses`
- `ownerId`
- `description`
- `category`
- `amount`
- `dueDate`
- `status`

### `notices`
- `title`
- `body`
- `audience`
- `pinned`
- `createdByUid`
- `createdByName`

### `settings/platform`
- `maxActiveVendors`

## Como configurar

1. Crie um **novo projeto Firebase** só para este portal.
2. Ative **Authentication > Email/Password**.
3. Crie o **Cloud Firestore** em modo produção.
4. Abra o arquivo `js/firebase-config.js` e cole a configuração do novo app web.
5. Publique os arquivos na hospedagem que quiser ou use Firebase Hosting.

## Como criar o primeiro administrador

A forma mais simples é:

1. Crie um usuário normalmente pelo cadastro.
2. Vá ao Firestore.
3. Abra o documento em `users/{uid}` desse usuário.
4. Altere:
   - `role: 'admin'`
   - `status: 'active'`

Depois disso, esse login já entra como administrador.

## Observações importantes

- O limite inicial está em **20 vendedores ativos** e pode ser alterado em `js/config.js`.
- O sistema foi pensado para um começo enxuto, bonito e objetivo.
- Esta é a primeira base. No próximo passo, o ideal é evoluir:
  - catálogo administrável de produtos
  - relatórios por período
  - filtros avançados
  - baixa parcial de recebimentos
  - painel mais detalhado de estoque

