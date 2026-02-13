# Бот «Конструкт» для Telegram

Сервис помогает собрать официальный запрос в управляющую компанию по 402-ФЗ.

## Деплой на Vercel

1. **Подключи репозиторий** к [Vercel](https://vercel.com) (GitHub/GitLab/Bitbucket) или задеплой через CLI:
   ```bash
   npx vercel
   ```

2. **Добавь переменную окружения** в настройках проекта Vercel:
   - `BOT_TOKEN` = твой токен от @BotFather

3. **После деплоя** зарегистрируй webhook — открой в браузере:
   ```
   https://твой-проект.vercel.app/api/setup-webhook
   ```
   Должен вернуться JSON с `"ok": true` и `webhook_url`.

4. Готово. Отправь боту `/start` в Telegram.

## Структура

- `api/webhook.js` — обработчик входящих сообщений от Telegram
- `api/setup-webhook.js` — эндпоинт для установки webhook (вызвать один раз после деплоя)
