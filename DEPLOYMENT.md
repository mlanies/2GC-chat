# 🚀 Автоматический деплой в Cloudflare Workers

## Настройка GitHub Actions для автоматического деплоя

### 1. Создание API токена Cloudflare

1. Перейдите в [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Нажмите "Create Token"
3. Выберите "Custom token"
4. Настройте права доступа:
   - **Account Resources:** All accounts
   - **Zone Resources:** All zones
   - **Permissions:**
     - Account: Workers Scripts (Edit)
     - Account: Workers Routes (Edit)
     - Account: Workers KV Storage (Edit)
     - Account: Workers Durable Objects (Edit)
5. Сохраните токен

### 2. Настройка GitHub Secrets

1. Перейдите в ваш GitHub репозиторий
2. Нажмите Settings → Secrets and variables → Actions
3. Добавьте следующие secrets:

```
CLOUDFLARE_API_TOKEN = ваш_api_токен_из_шага_1
CLOUDFLARE_ACCOUNT_ID = 073ae0130b7cee5e55a1ac1a335431a8
```

### 3. Настройка Cloudflare Workers

1. Перейдите в [Cloudflare Dashboard](https://dash.cloudflare.com/073ae0130b7cee5e55a1ac1a335431a8/workers/services/view/2gc-chat-secure/production/settings)
2. В разделе "Settings" → "Variables" добавьте:
   - `CHAT_PASSWORD` = `password123`
   - `ENABLE_BOT_PROTECTION` = `true`

### 4. Настройка Durable Objects

1. В том же разделе Settings перейдите в "Durable Objects"
2. Убедитесь, что Durable Object `Chat` настроен правильно

### 5. Автоматический деплой

После настройки:
- Каждый push в ветку `main` автоматически запустит деплой
- Деплой будет происходить через GitHub Actions
- Результат будет виден в [Cloudflare Dashboard](https://dash.cloudflare.com/073ae0130b7cee5e55a1ac1a335431a8/workers/services/view/2gc-chat-secure/production/settings)

## Ручной деплой

Если нужно деплоить вручную:

```bash
npm run deploy
```

## Проверка деплоя

После деплоя ваш чат будет доступен по адресу:
- `https://2gc-chat-secure.2gc.workers.dev`
- `https://durable-chat-template.2gc.workers.dev`

## Мониторинг

- **GitHub Actions:** https://github.com/mlanies/durable-chat-template/actions
- **Cloudflare Dashboard:** https://dash.cloudflare.com/073ae0130b7cee5e55a1ac1a335431a8/workers/services/view/2gc-chat-secure/production/settings
