import React, { useState, useEffect } from 'react';
import { BotProtectionMessage } from '../../shared';

interface BotProtectionProps {
  onSuccess: () => void;
  turnstileSiteKey?: string;
  challenge?: any;
  socket: any;
  error?: string;
  onErrorClear?: () => void;
}

export function BotProtection({ 
  onSuccess, 
  turnstileSiteKey, 
  challenge,
  socket,
  error: serverError,
  onErrorClear
}: BotProtectionProps) {
  // Очищаем поле ввода при получении ошибки
  useEffect(() => {
    if (serverError) {
      setCustomAnswer('');
    }
  }, [serverError]);
  const [currentStep, setCurrentStep] = useState(1);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 3;

  const handleTurnstileSuccess = (token: string) => {
    setTurnstileToken(token);
    setError('');
  };

  const handleTurnstileError = () => {
    setError('Ошибка проверки Cloudflare. Попробуйте еще раз.');
    setTurnstileToken(null);
  };

  const handleTurnstileExpired = () => {
    setError('Проверка Cloudflare истекла. Выполните ее снова.');
    setTurnstileToken(null);
  };

  // Проверяем, загрузился ли Turnstile
  useEffect(() => {
    const checkTurnstile = () => {
      if ((window as any).turnstile) {
        // Инициализируем виджет
        if (turnstileSiteKey) {
          (window as any).turnstile.render('.cf-turnstile', {
            sitekey: turnstileSiteKey,
            callback: handleTurnstileSuccess,
            'error-callback': handleTurnstileError,
            'expired-callback': handleTurnstileExpired,
          });
        }
      } else {
        setTimeout(checkTurnstile, 100);
      }
    };
    
    checkTurnstile();
  }, [turnstileSiteKey]);

  // Глобальные функции для Turnstile (должны быть доступны в window)
  useEffect(() => {
    (window as any).onTurnstileSuccess = handleTurnstileSuccess;
    (window as any).onTurnstileError = handleTurnstileError;
    (window as any).onTurnstileExpired = handleTurnstileExpired;
    
    return () => {
      delete (window as any).onTurnstileSuccess;
      delete (window as any).onTurnstileError;
      delete (window as any).onTurnstileExpired;
    };
  }, []);

  const verifyStep = async () => {
    if (currentStep === 1) {
      await verifyTurnstile();
    } else if (currentStep === 2) {
      await verifyCustomChallenge();
    }
  };

  const verifyTurnstile = async () => {
    if (!turnstileToken) {
      setError('Пожалуйста, выполните проверку Cloudflare.');
      return;
    }

    setAttempts(prev => prev + 1);
    setIsLoading(true);

    try {
      // Отправляем токен на сервер для проверки
      const botProtectionMessage: BotProtectionMessage = {
        type: "turnstile_verify",
        token: turnstileToken
      };
      
      // Отправляем сообщение через WebSocket
      socket.send(JSON.stringify(botProtectionMessage));
      
      // Переходим к следующему шагу
      setCurrentStep(2);
      setIsLoading(false);
      setError('');
    } catch (error) {
      if (attempts >= maxAttempts) {
        setError('Слишком много неудачных попыток. Попробуйте позже.');
      } else {
        setError(`Ошибка проверки. Осталось попыток: ${maxAttempts - attempts}`);
      }
      setIsLoading(false);
    }
  };

  const verifyCustomChallenge = async () => {
    if (!customAnswer.trim()) {
      setError('Пожалуйста, введите ответ на задачу.');
      return;
    }

    setAttempts(prev => prev + 1);
    setIsLoading(true);

    try {
      // Отправляем ответ на сервер
      const botProtectionMessage: BotProtectionMessage = {
        type: "custom_challenge",
        answer: customAnswer.trim()
      };
      
      socket.send(JSON.stringify(botProtectionMessage));
      
      // НЕ вызываем onSuccess здесь - ждем ответа от сервера
      // onSuccess будет вызван из основного компонента при получении bot_protection_success
      setIsLoading(false);
      setError('');
    } catch (error) {
      if (attempts >= maxAttempts) {
        setError('Слишком много неудачных попыток. Попробуйте позже.');
      } else {
        setError(`Ошибка проверки. Осталось попыток: ${maxAttempts - attempts}`);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="bot-protection-container">
      <div className="bot-protection-box">
        <div className="protection-header">
          <h2>Защита от ботов</h2>
          <p>Пожалуйста, пройдите проверку безопасности</p>
        </div>

        <div className="step-indicator">
          <div className={`step ${currentStep >= 1 ? 'active' : currentStep > 1 ? 'completed' : 'pending'}`}>
            <span>1</span>
            <span>Cloudflare</span>
          </div>
          <div className={`step ${currentStep >= 2 ? 'active' : 'pending'}`}>
            <span>2</span>
            <span>Задача</span>
          </div>
        </div>

        <div className="step-content">
          {currentStep === 1 && (
            <div className="turnstile-container">
              <h3>Шаг 1: Проверка Cloudflare</h3>
              <p>Нажмите на кнопку ниже для проверки</p>
              
              <div className="cf-turnstile"></div>
              
              <button 
                onClick={verifyStep}
                disabled={!turnstileToken || isLoading}
                className="verify-button"
              >
                {isLoading ? 'Проверяем...' : 'Продолжить'}
              </button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="challenge">
              <h3>Шаг 2: Решите задачу</h3>
              
              {challenge && (
                <div className="question">
                  <p><strong>Вопрос:</strong> {challenge.question}</p>
                  {challenge.hint && (
                    <p className="hint">Подсказка: {challenge.hint}</p>
                  )}
                </div>
              )}
              
              <input
                type="text"
                value={customAnswer}
                onChange={(e) => setCustomAnswer(e.target.value)}
                placeholder="Введите ваш ответ..."
                className="answer-input"
                disabled={isLoading}
              />
              
              <button 
                onClick={verifyStep}
                disabled={!customAnswer.trim() || isLoading}
                className="verify-button"
              >
                {isLoading ? 'Проверяем...' : 'Завершить'}
              </button>
            </div>
          )}
        </div>

        {(error || serverError) && (
          <div className="error-message">
            <span>{error || serverError}</span>
            {onErrorClear && (
              <button 
                onClick={onErrorClear}
                className="clear-error-button"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
