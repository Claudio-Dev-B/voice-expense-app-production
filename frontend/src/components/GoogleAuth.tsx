// components/GoogleAuth.tsx - VERSÃO CORRIGIDA
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

  // ✅ Listen for auth redirects
  useEffect(() => {
    const handleAuthRedirect = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const error = urlParams.get('error');
      const user_id = urlParams.get('user_id');

      console.log('🔍 Verificando parâmetros de auth:', { token, error, user_id });

      if (token && user_id) {
        console.log('✅ Auth redirect success detected');
        handleAuthSuccess(token);
      } else if (error) {
        console.error('❌ Auth redirect error:', error);
        onError(`Authentication failed: ${error}`);
        
        // Clean URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleAuthRedirect();
  }, [onSuccess, onError]);

  // ✅ CORREÇÃO: Removido parâmetro userId não utilizado
  const handleAuthSuccess = async (token: string) => {
    try {
      setIsAuthenticating(true);
      console.log('🔄 Processando token de autenticação...');
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voice-expense-app-production-production.up.railway.app';
      
      // Verify token and get user info
      console.log('🔐 Verificando token no backend...');
      const response = await fetch(`${API_BASE_URL}/api/auth/verify?token=${token}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Token verification failed:', response.status, errorText);
        throw new Error('Token verification failed');
      }

      const data = await response.json();
      console.log('✅ Token verificado, dados do usuário:', data.user.email);
      
      // Save token
      localStorage.setItem('access_token', token);
      console.log('💾 Token salvo no localStorage');
      
      // Clean URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      console.log('✅ Authentication completed successfully');
      onSuccess({
        user: data.user,
        token: token
      });

    } catch (error) {
      console.error('❌ Auth success handling failed:', error);
      onError('Failed to complete authentication');
      
      // Clean URL parameters on error too
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      if (isAuthenticating) {
        console.log('⚠️ Autenticação já em andamento');
        return;
      }

      console.log('🚀 Starting Google authentication...');
      setIsAuthenticating(true);

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voice-expense-app-production-production.up.railway.app';
      
      // ✅ Open auth in same tab (no popup issues)
      console.log('🔗 Redirecionando para:', `${API_BASE_URL}/api/auth/google/login`);
      window.location.href = `${API_BASE_URL}/api/auth/google/login`;

    } catch (error) {
      console.error('❌ Google login error:', error);
      onError('Failed to start authentication');
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🎤</span>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          VoiceExpense
        </h1>
        <p className="text-gray-600 mb-8">
          Controle suas despesas por voz de forma inteligente
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={isAuthenticating}
          className="w-full bg-white border border-gray-300 rounded-xl py-4 px-4 flex items-center justify-center space-x-3 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
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

        <p className="text-xs text-gray-500 mb-4">
          Ao continuar, você concorda com nossos Termos de Serviço
        </p>

        {isAuthenticating && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              🔄 Redirecionando para autenticação...
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Você será redirecionado para o Google
            </p>
          </div>
        )}

        {/* Debug info */}
        {import.meta.env.DEV && (
          <div className="mt-4 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">
            <p><strong>Debug Info:</strong></p>
            <p>API: {import.meta.env.VITE_API_URL}</p>
            <p>Path: {window.location.pathname}</p>
            <p>Search: {window.location.search}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleAuth;