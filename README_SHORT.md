# 💬 Durable Chat Template

**Современное веб-приложение для создания защищенных чатов в реальном времени**

## 🎯 Что это?

Готовый шаблон для быстрого развертывания безопасных чат-приложений на Cloudflare Workers с использованием Durable Objects.

## ✨ Ключевые возможности

- 🔐 **Парольная защита** + защита от ботов
- 💬 **Real-time сообщения** через WebSockets
- 📱 **Push-уведомления** и адаптивный дизайн
- 🗂️ **Многоканальность** - создание и управление каналами
- 🔒 **Шифрование** сообщений и безопасные сессии
- ⚡ **Мгновенный деплой** на Cloudflare Workers

## 🚀 Быстрый старт

```bash
# 1. Клонировать и установить
git clone <repository>
npm install

# 2. Настроить конфигурацию
cp wrangler.toml.example wrangler.toml
# Отредактировать wrangler.toml

# 3. Запустить
npm run dev      # Локально
npm run deploy   # В продакшен
```

## 🏗️ Технологии

- **Backend**: Cloudflare Workers + Durable Objects + PartyServer
- **Frontend**: React 18 + TypeScript + PartySocket
- **Безопасность**: AES-GCM + PBKDF2 + Cloudflare Turnstile
- **Деплой**: Wrangler CLI + GitHub Actions

## 📚 Документация

- 📖 [Полная документация](./docs/README.md)
- ⚙️ [Конфигурация](./docs/development/CONFIGURATION.md)
- 🔒 [Безопасность](./docs/security/SECURITY.md)
- 🚀 [Деплой](./docs/deployment/DEPLOYMENT.md)

## 🎯 Для кого?

- **Разработчики** - нуждающиеся в готовом чат-решении
- **Стартапы** - для быстрого MVP
- **Команды** - для внутренней коммуникации
- **Образовательные проекты** - для обучения real-time технологиям

---

**Готов к продакшену** ✅ | **Полная документация** ✅ | **Автоматический деплой** ✅
