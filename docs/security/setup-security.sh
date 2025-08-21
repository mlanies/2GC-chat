#!/bin/bash

# Скрипт для настройки безопасности чата
echo "🔒 Настройка безопасности чата"
echo "================================"

# Проверяем, установлен ли wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler не установлен. Установите его с помощью: npm install -g wrangler"
    exit 1
fi

echo "📝 Настройка секретов..."
echo ""

# Запрашиваем пароль чата
echo "Введите пароль для чата (будет сохранен как секрет):"
read -s CHAT_PASSWORD
echo ""

# Запрашиваем ключи Cloudflare Turnstile
echo "Введите Site Key для Cloudflare Turnstile:"
read TURNSTILE_SITE_KEY

echo "Введите Secret Key для Cloudflare Turnstile:"
read -s TURNSTILE_SECRET_KEY
echo ""

# Устанавливаем секреты
echo "🔐 Устанавливаем секреты..."

# Устанавливаем CHAT_PASSWORD
echo "$CHAT_PASSWORD" | wrangler secret put CHAT_PASSWORD --name 2gc-chat-secure
if [ $? -eq 0 ]; then
    echo "✅ CHAT_PASSWORD установлен"
else
    echo "❌ Ошибка установки CHAT_PASSWORD"
fi

# Устанавливаем TURNSTILE_SITE_KEY
echo "$TURNSTILE_SITE_KEY" | wrangler secret put TURNSTILE_SITE_KEY --name 2gc-chat-secure
if [ $? -eq 0 ]; then
    echo "✅ TURNSTILE_SITE_KEY установлен"
else
    echo "❌ Ошибка установки TURNSTILE_SITE_KEY"
fi

# Устанавливаем TURNSTILE_SECRET_KEY
echo "$TURNSTILE_SECRET_KEY" | wrangler secret put TURNSTILE_SECRET_KEY --name 2gc-chat-secure
if [ $? -eq 0 ]; then
    echo "✅ TURNSTILE_SECRET_KEY установлен"
else
    echo "❌ Ошибка установки TURNSTILE_SECRET_KEY"
fi

echo ""
echo "🎉 Настройка безопасности завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Запустите: wrangler deploy --name 2gc-chat-secure"
echo "2. Проверьте работу приложения"
echo "3. Убедитесь, что HTTPS работает корректно"
echo ""
echo "🔍 Для проверки конфигурации используйте: wrangler deploy --dry-run --name 2gc-chat-secure"
