import React, { useEffect } from 'react';

interface ModernThemeProviderProps {
  children: React.ReactNode;
}

export function ModernThemeProvider({ children }: ModernThemeProviderProps) {
  useEffect(() => {
    // Автоматически применяем современную тему при загрузке
    const link = document.getElementById('theme-stylesheet') as HTMLLinkElement;
    
    if (!link) {
      const newLink = document.createElement('link');
      newLink.id = 'theme-stylesheet';
      newLink.rel = 'stylesheet';
      newLink.href = '/styles-modern.css';
      document.head.appendChild(newLink);
    }
    
    localStorage.setItem('chat-theme', 'modern');
  }, []);

  return <>{children}</>;
}
