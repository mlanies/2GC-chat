# 📁 Структура проекта

## 🗂️ Корневая директория

```
durable-chat-template/
├── 📚 docs/                    # Документация проекта
│   ├── 📖 README.md           # Главный индекс документации
│   ├── 🚀 deployment/         # Документация по деплою
│   ├── 🛠️ development/       # Документация по разработке
│   ├── 🎨 design/            # Документация по дизайну
│   └── 🔒 security/          # Документация по безопасности
├── 🔧 .github/                # GitHub Actions и конфигурация
├── 🌐 public/                 # Статические файлы
├── 💻 src/                    # Исходный код
├── 📦 package.json           # Зависимости и скрипты
├── ⚙️ wrangler.toml          # Конфигурация Cloudflare Workers
├── 🔧 tsconfig.json          # Конфигурация TypeScript
├── 🚫 .gitignore             # Исключения Git
└── 📖 README.md              # Главный README проекта
```

## 💻 Исходный код (src/)

```
src/
├── 🖥️ client/                # React клиент
│   ├── 🧩 components/        # React компоненты
│   │   ├── BotProtection.tsx # Защита от ботов
│   │   ├── ChannelsPanel.tsx # Панель каналов
│   │   ├── ChatInterface.tsx # Интерфейс чата
│   │   └── LoginForm.tsx     # Форма входа
│   ├── 🛠️ utils/            # Утилиты
│   │   ├── cookies.ts        # Работа с cookies
│   │   ├── format.ts         # Форматирование
│   │   └── security.ts       # Безопасность
│   ├── 📄 index.tsx          # Главный компонент
│   └── ⚙️ tsconfig.json      # TypeScript конфигурация
├── 🖥️ server/               # Серверная часть
│   ├── 🧩 handlers/          # Обработчики сообщений
│   │   └── messageHandlers.ts
│   ├── 🛠️ utils/            # Серверные утилиты
│   │   ├── authUtils.ts      # Аутентификация
│   │   ├── channelUtils.ts   # Управление каналами
│   │   └── turnstileUtils.ts # Cloudflare Turnstile
│   ├── 📄 index.ts           # Главный сервер
│   └── ⚙️ tsconfig.json      # TypeScript конфигурация
└── 🔗 shared.ts              # Общие типы
```

## 🌐 Статические файлы (public/)

```
public/
├── 🎨 css/                   # Стили
│   ├── normalize.css         # Нормализация CSS
│   └── skeleton.css          # Базовые стили
├── 📄 index.html             # HTML шаблон
├── 🎨 styles.css             # Основные стили
├── 🔧 sw.js                  # Service Worker
└── 🖼️ favicon.ico           # Иконка сайта
```

## 📚 Документация (docs/)

### 🚀 deployment/
- **DEPLOYMENT.md** - Инструкции по деплою в Cloudflare Workers
- Настройка GitHub Actions для автоматического деплоя
- Конфигурация Cloudflare Dashboard

### 🛠️ development/
- **LOCAL_SETUP.md** - Настройка локальной разработки
- **FINAL_CHANGES.md** - Финальные изменения проекта
- **REFACTORING_SUMMARY.md** - Резюме рефакторинга
- **FINAL_HEADER_UPDATES.md** - Обновления заголовков
- **HEADER_NOTICE_CHANGES.md** - Изменения уведомлений

### 🎨 design/
- **DESIGN_GUIDE.md** - Руководство по дизайну
- **DESIGN_SUMMARY.md** - Резюме дизайна

### 🔒 security/
- **SECURITY.md** - Документация по безопасности
- **setup-security.sh** - Скрипт настройки безопасности

## 🔧 Конфигурационные файлы

- **package.json** - Зависимости и скрипты npm
- **wrangler.toml** - Конфигурация Cloudflare Workers
- **tsconfig.json** - Конфигурация TypeScript
- **.gitignore** - Исключения для Git
- **.github/workflows/deploy.yml** - GitHub Actions для автоматического деплоя

## 🚀 Команды разработки

```bash
# Локальная разработка
npm run dev

# Деплой в продакшн
npm run deploy

# Сборка клиента
npm run build

# Проверка типов
npm run type-check
```

## 🔗 Полезные ссылки

- **GitHub Actions**: https://github.com/mlanies/durable-chat-template/actions
- **Cloudflare Dashboard**: https://dash.cloudflare.com/073ae0130b7cee5e55a1ac1a335431a8/workers/services/view/2gc-chat-secure/production/settings
- **Live Demo**: https://2gc-chat-secure.2gc.workers.dev
