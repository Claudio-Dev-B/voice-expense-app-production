// components/GoogleAuth.tsx - VERSÃO CORRIGIDA PARA PRODUÇÃO
import React from 'react';

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
  const handleGoogleLogin = async () => {
    try {
      console.log('🚀 Iniciando autenticação Google...');
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voice-expense-app-production-production.up.railway.app';
      console.log('🔗 API URL:', API_BASE_URL);
      
      // Configurar popup
      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const authUrl = `${API_BASE_URL}/api/auth/google/login`;
      console.log('📋 URL de autenticação:', authUrl);
      
      const authWindow = window.open(
        authUrl,
        'Google Login',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!authWindow) {
        alert('❌ Popup bloqueado! Por favor, permita popups para este site.');
        return;
      }

      // Escutar mensagens do popup
      const handleMessage = (event: MessageEvent) => {
        console.log('📨 Mensagem recebida:', {
          origin: event.origin,
          data: event.data,
          type: event.data?.type
        });

        // ✅ CORREÇÃO CRÍTICA: Lista de origens permitidas
        const allowedOrigins = [
          API_BASE_URL,
          'https://voice-expense-app-production-production.up.railway.app',
          'https://voice-expense-app-production.vercel.app',
          'http://localhost:8000',
          'http://localhost:5173',
          'https://localhost:5173',
          'http://127.0.0.1:5173',
          'https://127.0.0.1:5173'
        ];
        
        // ✅ Verificação flexível para desenvolvimento e produção
        const isAllowedOrigin = allowedOrigins.some(origin => {
          const isMatch = event.origin === origin || 
                         event.origin.startsWith(origin) ||
                         (import.meta.env.DEV && event.origin.includes('localhost')) ||
                         (import.meta.env.DEV && event.origin.includes('127.0.0.1'));
          
          if (isMatch) {
            console.log('✅ Origem permitida:', event.origin);
          }
          return isMatch;
        });
        
        if (!isAllowedOrigin) {
          console.warn('🚫 Origem não permitida:', event.origin);
          console.log('Origens permitidas:', allowedOrigins);
          return;
        }

        // Processar mensagens de sucesso
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          const { user, token } = event.data;
          
          console.log('✅ Login Google bem-sucedido:', {
            user: { id: user.id, email: user.email, name: user.name },
            tokenLength: token?.length
          });
          
          // Salvar token
          if (token) {
            localStorage.setItem('access_token', token);
            console.log('💾 Token salvo no localStorage');
          } else {
            console.error('❌ Token não recebido');
          }
          
          // Remover listener
          window.removeEventListener('message', handleMessage);
          clearInterval(popupCheckInterval);
          
          // Chamar callback de sucesso
          onSuccess({ user, token });
        } 
        // Processar mensagens de erro
        else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          console.error('❌ Erro no login Google:', event.data.error);
          alert('Erro ao fazer login com Google: ' + event.data.error);
          
          window.removeEventListener('message', handleMessage);
          clearInterval(popupCheckInterval);
        }
      };

      window.addEventListener('message', handleMessage);

      // Verificar se popup foi fechado
      const popupCheckInterval = setInterval(() => {
        if (authWindow.closed) {
          console.log('🔒 Popup fechado pelo usuário');
          clearInterval(popupCheckInterval);
          window.removeEventListener('message', handleMessage);
          
          // Verificar se já não recebemos uma mensagem de sucesso
          const token = localStorage.getItem('access_token');
          if (!token) {
            console.log('ℹ️ Popup fechado sem autenticação completa');
          }
        }
      }, 1000);

      // Timeout de segurança
      setTimeout(() => {
        if (authWindow && !authWindow.closed) {
          console.log('⏰ Timeout do popup - fechando automaticamente');
          authWindow.close();
          window.removeEventListener('message', handleMessage);
          clearInterval(popupCheckInterval);
        }
      }, 120000); // 2 minutos

    } catch (error) {
      console.error('💥 Erro crítico no login Google:', error);
      alert('Erro ao conectar com Google. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        {/* Logo */}
        <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🎤</span>
        </div>
        
        {/* Título */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          VoiceExpense
        </h1>
        <p className="text-gray-600 mb-8">
          Controle suas despesas por voz de forma inteligente
        </p>

        {/* Botão Google */}
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-white border border-gray-300 rounded-xl py-4 px-4 flex items-center justify-center space-x-3 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md mb-4"
        >
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">G</span>
          </div>
          <span className="font-medium text-gray-700">Entrar com Google</span>
        </button>

        {/* Informações */}
        <p className="text-xs text-gray-500">
          Ao continuar, você concorda com nossos Termos de Serviço
        </p>
        
        {/* Informação de debug */}
        {import.meta.env.DEV && (
          <div className="mt-6 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            <p className="font-semibold">🔧 Modo desenvolvimento</p>
            <p>API: {import.meta.env.VITE_API_URL || 'Não configurado'}</p>
            <p>Domínio: {window.location.origin}</p>
          </div>
        )}

        {/* Status de produção */}
        {!import.meta.env.DEV && (
          <div className="mt-4 p-2 bg-green-50 rounded-lg text-xs text-green-700">
            <p>🌐 Modo produção</p>
            <p>voice-expense-app-production.vercel.app</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleAuth;