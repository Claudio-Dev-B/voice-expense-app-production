// components/GoogleAuth.tsx - VERSÃO ATUALIZADA
import React, { useState, useEffect } from 'react';

interface User {
  id: number;
  email: string;
  name: string;
  picture?: string;
  onboarding_completed: boolean;
  user_type: string;
}

interface GoogleAuthProps {
  onSuccess: (authData: { user: User; token: string }) => void;
  onError: (error: string) => void;
}

const GoogleAuth: React.FC<GoogleAuthProps> = ({ onSuccess, onError }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Listen for auth redirects
  useEffect(() => {
    const checkAuthStatus = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const authSuccess = urlParams.get('auth_success');
      const authError = urlParams.get('auth_error');

      if (authSuccess === 'true' && token) {
        console.log('✅ Auth success detected');
        await handleAuthSuccess(token);
      } else if (authError) {
        console.error('❌ Auth error:', authError);
        handleAuthError(authError);
      }
    };

    checkAuthStatus();
  }, []);

  const handleAuthSuccess = async (token: string) => {
    try {
      setIsAuthenticating(true);
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voice-expense-app-production-production.up.railway.app';
      
      // Verify token and get user info
      const response = await fetch(`${API_BASE_URL}/api/auth/verify?token=${token}`);
      
      if (!response.ok) {
        throw new Error('Token verification failed');
      }

      const data = await response.json();
      
      // Save token
      localStorage.setItem('access_token', token);
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      onSuccess({
        user: data.user,
        token: token
      });

    } catch (error) {
      console.error('Auth success handling failed:', error);
      onError('Falha ao completar autenticação');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAuthError = (errorCode: string) => {
    const errorMessages: { [key: string]: string } = {
      'invalid_state': 'Sessão de autenticação inválida',
      'state_reused': 'Sessão já utilizada',
      'no_code': 'Código de autorização não recebido',
      'misconfigured': 'App não configurado corretamente',
      'token_failed': 'Falha na autenticação',
      'user_info': 'Não foi possível obter informações do usuário',
      'server_error': 'Erro no servidor',
      'access_denied': 'Acesso negado pelo Google'
    };

    const errorMessage = errorMessages[errorCode] || `Erro de autenticação: ${errorCode}`;
    onError(errorMessage);
    
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const handleGoogleLogin = async () => {
    try {
      if (isAuthenticating) return;

      setIsAuthenticating(true);
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voice-expense-app-production-production.up.railway.app';
      
      // Redirect to backend auth endpoint
      window.location.href = `${API_BASE_URL}/api/auth/google/login`;

    } catch (error) {
      console.error('Google login error:', error);
      onError('Falha ao iniciar autenticação');
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🎤</span>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">VoiceExpense</h1>
        <p className="text-gray-600 mb-8">Controle suas despesas por voz</p>

        <button
          onClick={handleGoogleLogin}
          disabled={isAuthenticating}
          className="w-full bg-white border border-gray-300 rounded-xl py-4 px-4 flex items-center justify-center space-x-3 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md mb-4 disabled:opacity-50"
        >
          {isAuthenticating ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          ) : (
            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">G</span>
            </div>
          )}
          <span className="font-medium text-gray-700">
            {isAuthenticating ? 'Processando...' : 'Entrar com Google'}
          </span>
        </button>

        <p className="text-xs text-gray-500">
          Ao continuar, você concorda com nossos Termos
        </p>
      </div>
    </div>
  );
};

export default GoogleAuth;