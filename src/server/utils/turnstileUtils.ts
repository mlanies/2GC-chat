export interface TurnstileResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export async function verifyTurnstileToken(
  token: string, 
  secretKey: string, 
  remoteIp?: string
): Promise<TurnstileResponse> {
  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] Turnstile verification failed: ${response.status} ${response.statusText}`);
      return {
        success: false,
        'error-codes': ['request_failed']
      };
    }

    const result: TurnstileResponse = await response.json();
    
    console.log(`[${new Date().toISOString()}] Turnstile verification result:`, {
      success: result.success,
      challenge_ts: result.challenge_ts,
      hostname: result.hostname,
      error_codes: result['error-codes']
    });

    return result;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Turnstile verification error:`, error);
    return {
      success: false,
      'error-codes': ['network_error']
    };
  }
}

export function getTurnstileErrorMessage(errorCodes: string[]): string {
  const errorMessages: Record<string, string> = {
    'missing-input-secret': 'Отсутствует секретный ключ',
    'invalid-input-secret': 'Неверный секретный ключ',
    'missing-input-response': 'Отсутствует токен ответа',
    'invalid-input-response': 'Неверный токен ответа',
    'bad-request': 'Некорректный запрос',
    'timeout-or-duplicate': 'Токен истек или уже использован',
    'internal-error': 'Внутренняя ошибка сервера',
    'request_failed': 'Ошибка запроса к серверу Turnstile',
    'network_error': 'Ошибка сети'
  };

  if (errorCodes && errorCodes.length > 0) {
    return errorCodes.map(code => errorMessages[code] || `Неизвестная ошибка: ${code}`).join(', ');
  }

  return 'Неизвестная ошибка';
}
