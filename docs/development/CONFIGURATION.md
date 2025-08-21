# ⚙️ Конфигурация проекта

## 🔧 Настройка wrangler.toml

### 1. Создание конфигурационного файла

Скопируйте пример конфигурации:

```bash
cp wrangler.toml.example wrangler.toml
```

### 2. Настройка основных параметров

Отредактируйте `wrangler.toml`:

```toml
name = "your-unique-app-name"
main = "src/server/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENABLE_BOT_PROTECTION = "true"

[env.production]
vars = { 
  ENABLE_BOT_PROTECTION = "true",
  CHAT_PASSWORD = "your-secure-password-here"
}

[[env.production.durable_objects.bindings]]
name = "CHAT"
class_name = "Chat"

[[durable_objects.bindings]]
name = "CHAT"
class_name = "Chat"
```

### 3. Настройка переменных окружения

#### Обязательные переменные:

- **`name`** - уникальное имя вашего Worker'а
- **`CHAT_PASSWORD`** - пароль для доступа к чату

#### Опциональные переменные:

- **`ENABLE_BOT_PROTECTION`** - включить/выключить защиту от ботов (`"true"` или `"false"`)

### 4. Секреты Cloudflare

Для продакшена настройте секреты через Wrangler CLI:

```bash
# Пароль чата
wrangler secret put CHAT_PASSWORD

# Ключи Cloudflare Turnstile (для защиты от ботов)
wrangler secret put TURNSTILE_SITE_KEY
wrangler secret put TURNSTILE_SECRET_KEY
```

## 🔒 Безопасность

### ⚠️ Важные правила:

1. **Никогда не коммитьте `wrangler.toml` в Git** - файл добавлен в `.gitignore`
2. **Используйте сильные пароли** - минимум 12 символов
3. **Не делитесь конфигурацией** - содержит чувствительную информацию
4. **Используйте разные пароли** для разработки и продакшена

### 🛡️ Рекомендации по паролям:

```bash
# Генерация безопасного пароля (macOS/Linux)
openssl rand -base64 32

# Или используйте менеджер паролей
```

## 🚀 Окружения

### Development (локальная разработка)

```toml
[vars]
ENABLE_BOT_PROTECTION = "false"  # Отключить для удобства разработки
```

### Production (продакшен)

```toml
[env.production]
vars = { 
  ENABLE_BOT_PROTECTION = "true",
  CHAT_PASSWORD = "your-secure-password"
}
```

## 🔧 Команды

```bash
# Локальная разработка
npm run dev

# Деплой в продакшен
npm run deploy

# Просмотр секретов
wrangler secret list
```

## 🆘 Устранение неполадок

### Проблема: Worker не запускается

**Решение:**
1. Проверьте синтаксис `wrangler.toml`
2. Убедитесь, что имя Worker'а уникально
3. Проверьте наличие всех обязательных переменных

### Проблема: Ошибка аутентификации

**Решение:**
1. Проверьте `CHAT_PASSWORD` в конфигурации
2. Убедитесь, что пароль совпадает с тем, что вы вводите
3. Для продакшена проверьте настройку секретов

### Проблема: Защита от ботов не работает

**Решение:**
1. Настройте ключи Turnstile через `wrangler secret put`
2. Убедитесь, что `ENABLE_BOT_PROTECTION = "true"`
3. Проверьте логи Cloudflare

## 📚 Дополнительная информация

- **Документация Wrangler**: https://developers.cloudflare.com/workers/wrangler/
- **Durable Objects**: https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
- **Cloudflare Turnstile**: https://developers.cloudflare.com/turnstile/
