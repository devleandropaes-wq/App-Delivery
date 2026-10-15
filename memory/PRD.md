# PRD — A Sua Drogaria (Delivery)

## Problema original
Plataforma de delivery full-stack para a farmácia "A Sua Drogaria" (Duque de Caxias, RJ — 21 97921-6950): app/site do cliente + painel admin com senha, mesmo banco. Cores Azul Escuro / Vermelho Vivo / Branco, pt-BR. Kanban de pedidos com alerta sonoro, estoque manual com fotos, webhook para sistemas (Trier, InovaFarma, Linx Big) e importação de planilha Excel/CSV.

## Escolhas do usuário
- Pix: chave exibida na tela (sem gateway)
- Admin: senha única (ADMIN_PASSWORD no backend/.env)
- 20 produtos de demonstração no seed

## Arquitetura
- Backend FastAPI + MongoDB (`/app/backend/server.py`), JWT de admin, Emergent Object Storage para fotos, openpyxl para XLSX
- Frontend Expo Router: `/` vitrine, `/produto/[id]`, `/carrinho` (checkout), `/pedido/[code]` (confirmação + Pix), `/admin` login, `/admin/(tabs)/pedidos` Kanban, `/admin/(tabs)/estoque`
- Configurações em backend/.env: ADMIN_PASSWORD, PIX_KEY, PIX_NAME, STORE_PHONE, DELIVERY_FEE

## Implementado (15/10/2026)
- Vitrine por categorias, busca, carrinho persistente, preço original/promocional
- Checkout com nome, telefone, endereço, bairro, complemento; Pix / dinheiro / cartão
- Baixa de estoque atômica, código de pedido sequencial, botão de WhatsApp
- Admin: Kanban em tempo real (polling 4s) + som + vibração, modal de detalhes, avançar/voltar status
- Estoque: CRUD, upload de fotos, exclusão lógica, importação XLSX/CSV
- Webhook POST /api/webhook/products (chaves em pt/en, upsert por código de barras)
- Testes: backend 25/25, fluxos do frontend passaram

## Backlog
- P1: QR Code Pix "copia e cola" (BR Code) com valor do pedido
- P1: Rastreio de pedido pelo cliente na tela de confirmação
- P2: Cupons de desconto, taxa de entrega por bairro, autenticação do webhook por token
