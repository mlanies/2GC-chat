# 🔒 Уведомление о безопасности

## ⚠️ Важная информация о конфигурации

### 🚫 Файлы, НЕ подлежащие коммиту в Git

Следующие файлы содержат чувствительную информацию и НЕ ДОЛЖНЫ быть добавлены в Git:

- **`wrangler.toml`** - содержит пароли и другие секреты
- Любые файлы с реальными паролями или API ключами

### ✅ Файлы для коммита

Эти файлы безопасны для публичного репозитория:

- **`wrangler.toml.example`** - шаблон конфигурации без секретов
- **`.gitignore`** - содержит правила исключения чувствительных файлов

## 🛡️ Что было сделано для безопасности

### 1. Удалена чувствительная информация
- ❌ Удален реальный пароль из конфигурации
- ❌ Удалено производственное имя приложения
- ✅ Оставлена только базовая конфигурация для разработки

### 2. Добавлена защита в Git
```gitignore
# Sensitive configuration files
wrangler.toml
```

### 3. Создан безопасный шаблон
Файл `wrangler.toml.example` содержит:
- Примеры значений вместо реальных секретов
- Комментарии с инструкциями
- Безопасную структуру для копирования

## 🔧 Настройка для разработчиков

### При клонировании репозитория:

1. **Скопируйте шаблон:**
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```

2. **Настройте свои значения:**
   - Измените имя приложения на уникальное
   - Установите свой пароль
   - Настройте другие параметры по необходимости

3. **НЕ коммитьте wrangler.toml:**
   - Файл автоматически игнорируется Git
   - Используйте только для локальной разработки

## 🚨 Что делать при утечке секретов

Если случайно был закоммичен файл с секретами:

### 1. Немедленные действия:
```bash
# Удалить файл из Git (но оставить локально)
git rm --cached wrangler.toml

# Закоммитить удаление
git commit -m "Remove sensitive configuration file"

# Отправить в репозиторий
git push
```

### 2. Смена скомпрометированных секретов:
- Смените пароль чата
- Обновите API ключи Cloudflare Turnstile
- Пересоздайте Cloudflare Worker с новым именем

### 3. Очистка истории Git (при необходимости):
```bash
# ОСТОРОЖНО: Переписывает историю Git
git filter-branch --force --index-filter \
'git rm --cached --ignore-unmatch wrangler.toml' \
--prune-empty --tag-name-filter cat -- --all
```

## 📚 Дополнительные ресурсы

- **Конфигурация**: [docs/development/CONFIGURATION.md](./docs/development/CONFIGURATION.md)
- **Безопасность**: [docs/security/SECURITY.md](./docs/security/SECURITY.md)
- **Настройка деплоя**: [docs/deployment/DEPLOYMENT.md](./docs/deployment/DEPLOYMENT.md)

## 🔗 Полезные ссылки

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Cloudflare: Workers security](https://developers.cloudflare.com/workers/platform/limits/)
- [Git: gitignore documentation](https://git-scm.com/docs/gitignore)
