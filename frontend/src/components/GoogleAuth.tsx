// components/GoogleAuth.tsx - VERSÃO COM LOCALSTORAGE EVENTS
import React, { useEffect } from 'react';

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
}

const GoogleAuth: React.FC<GoogleAuthProps> = ({ onSuccess }) => {
  // ✅ NOVO: Escutar eventos de localStorage
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'voiceexpense_auth_result' && event.newValue) {
        try {
          console.log('📨 Evento de localStorage recebido:', event.newValue);
          const authData = JSON.parse(event.newValue);
          
          if (authData.type === 'GOOGLE_AUTH_SUCCESS') {
            console.log('✅ Auth success via localStorage event');
            localStorage.setItem('access_token', authData.token);
            localStorage.removeItem('voiceexpense_auth_result');
            
            onSuccess({
              user: authData.user,
              token: authData.token
            });
          }
        } catch (error) {
          console.error('Erro ao processar evento de storage:', error);
        }
      }
    };

    // Escutar eventos de storage (funciona entre abas/popups)
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [onSuccess]);

  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      console.log('🔄 Verificando status de autenticação...');
      const token = localStorage.getItem('access_token');
      
      if (token) {
        console.log('✅ Token encontrado no localStorage');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao verificar auth status:', error);
      return false;
    }
  };

  const handleGoogleLogin = async () => {
    let popupCheckInterval: number | null = null;
    let popupTimeout: number | null = null;

    try {
      console.log('🚀 Iniciando autenticação Google...');
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voice-expense-app-production-production.up.railway.app';
      console.log('🔗 API URL:', API_BASE_URL);
      
      // Verificar se já está autenticado
      const isAlreadyAuthenticated = await checkAuthStatus();
      if (isAlreadyAuthenticated) {
        console.log('ℹ️ Usuário já autenticado');
        return;
      }

      // ✅ NOVA ESTRATÉGIA: Usar uma nova aba em vez de popup
      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const authUrl = `${API_BASE_URL}/api/auth/google/login`;
      console.log('📋 URL de autenticação:', authUrl);
      
      const authWindow = window.open(
        authUrl,
        'google_auth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!authWindow) {
        alert('❌ Popup bloqueado! Por favor, permita popups para este site.');
        return;
      }

      // ✅ ESTRATÉGIA MISTA: postMessage + localStorage events
      const handleMessage = (event: MessageEvent) => {
        console.log('📨 Mensagem recebida de:', event.origin, event.data);

        // Aceitar de qualquer origem para teste
        if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          processAuthSuccess(event.data);
        }
      };

      window.addEventListener('message', handleMessage);

      // Verificar se a janela foi fechada
      popupCheckInterval = window.setInterval(() => {
        if (authWindow.closed) {
          console.log('🔒 Popup fechado, verificando resultado...');
          checkAuthResult();
        }
      }, 1000);

      // Timeout de segurança
      popupTimeout = window.setTimeout(() => {
        if (authWindow && !authWindow.closed) {
          console.log('⏰ Timeout - fechando popup');
          authWindow.close();
        }
        cleanup();
      }, 120000);

      const cleanup = () => {
        window.removeEventListener('message', handleMessage);
        if (popupCheckInterval) clearInterval(popupCheckInterval);
        if (popupTimeout) clearTimeout(popupTimeout);
      };

      const processAuthSuccess = (authData: any) => {
        console.log('✅ Auth success via postMessage');
        localStorage.setItem('access_token', authData.token);
        cleanup();
        onSuccess({
          user: authData.user,
          token: authData.token
        });
      };

      const checkAuthResult = () => {
        console.log('🔍 Verificando resultado da autenticação...');
        
        // Verificar localStorage após popup fechar
        const authResult = localStorage.getItem('voiceexpense_auth_result');
        const authData = localStorage.getItem('voiceexpense_auth_data');
        
        if (authResult) {
          try {
            const result = JSON.parse(authResult);
            if (result.type === 'GOOGLE_AUTH_SUCCESS') {
              console.log('✅ Auth success via localStorage check');
              localStorage.setItem('access_token', result.token);
              localStorage.removeItem('voiceexpense_auth_result');
              cleanup();
              onSuccess({
                user: result.user,
                token: result.token
              });
              return;
            }
          } catch (error) {
            console.error('Erro ao processar auth result:', error);
          }
        }

        if (authData) {
          try {
            const data = JSON.parse(authData);
            if (data.type === 'GOOGLE_AUTH_SUCCESS') {
              console.log('✅ Auth success via auth_data fallback');
              localStorage.setItem('access_token', data.token);
              localStorage.removeItem('voiceexpense_auth_data');
              cleanup();
              onSuccess({
                user: data.user,
                token: data.token
              });
              return;
            }
          } catch (error) {
            console.error('Erro ao processar auth data:', error);
          }
        }

        // Se não encontrou nada, verificar token diretamente
        const token = localStorage.getItem('access_token');
        if (token) {
          console.log('✅ Token encontrado diretamente no localStorage');
          cleanup();
          // Precisamos buscar informações do usuário
          fetchUserInfo(token);
        } else {
          console.log('❌ Nenhum método de auth funcionou');
          cleanup();
        }
      };

      const fetchUserInfo = async (token: string) => {
        try {
          // Tentar buscar informações do usuário com o token
          console.log('🔍 Buscando informações do usuário...');
          // Isso precisaria de um endpoint no backend
          // Por enquanto, vamos mostrar erro
          alert('Autenticação incompleta. Por favor, tente novamente.');
        } catch (error) {
          console.error('Erro ao buscar user info:', error);
        }
      };

    } catch (error) {
      console.error('💥 Erro crítico no login Google:', error);
      alert('Erro ao conectar com Google. Tente novamente.');
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
          className="w-full bg-white border border-gray-300 rounded-xl py-4 px-4 flex items-center justify-center space-x-3 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md mb-4"
        >
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">G</span>
          </div>
          <span className="font-medium text-gray-700">Entrar com Google</span>
        </button>

        <p className="text-xs text-gray-500 mb-4">
          Ao continuar, você concorda com nossos Termos de Serviço
        </p>

        {/* Informações do sistema */}
        <div className="space-y-2 text-xs">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-700">
            <p>🔄 Sistema de autenticação melhorado</p>
            <p>Múltiplas estratégias de fallback</p>
          </div>
          {import.meta.env.DEV && (
            <div className="p-2 bg-yellow-50 rounded-lg text-yellow-700">
              <p>🔧 Modo desenvolvimento</p>
              <p>API: {import.meta.env.VITE_API_URL}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleAuth;