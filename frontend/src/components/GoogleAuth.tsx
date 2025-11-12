// components/GoogleAuth.tsx - VERSÃO FINAL
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
      console.log('Iniciando autenticação Google...');
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voice-expense-app-production-production.up.railway.app';
      
      // Configurar popup
      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const authWindow = window.open(
        `${API_BASE_URL}/api/auth/google/login`,
        'Google Login',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!authWindow) {
        alert('Popup bloqueado! Por favor, permita popups para este site.');
        return;
      }

      // Escutar mensagens do popup
      const handleMessage = (event: MessageEvent) => {
        // Verificar origem para segurança
        const allowedOrigins = [
          API_BASE_URL,
          'https://voice-expense-app-production-production.up.railway.app',
          'http://localhost:8000',
          'http://localhost:5173'
        ];
        
        if (!allowedOrigins.some(origin => event.origin.startsWith(origin))) {
          console.warn('Mensagem de origem não permitida:', event.origin);
          return;
        }

        console.log('Mensagem recebida:', event.data);

        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          const { user, token } = event.data;
          
          // Salvar token
          localStorage.setItem('access_token', token);
          
          console.log('Login Google bem-sucedido:', user);
          
          // Remover listener
          window.removeEventListener('message', handleMessage);
          
          // Chamar callback de sucesso
          onSuccess({ user, token });
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          console.error('Erro no login Google:', event.data.error);
          alert('Erro ao fazer login com Google: ' + event.data.error);
          
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Verificar se popup foi fechado
      const checkPopup = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', handleMessage);
          console.log('Popup fechado pelo usuário');
        }
      }, 500);

    } catch (error) {
      console.error('Erro no login Google:', error);
      alert('Erro ao conectar com Google. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">🎤</span>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          VoiceExpense
        </h1>
        <p className="text-gray-600 mb-8">
          Controle suas despesas por voz de forma inteligente
        </p>

        <button
          onClick={handleGoogleLogin}
          className="w-full bg-white border border-gray-300 rounded-xl py-3 px-4 flex items-center justify-center space-x-3 hover:bg-gray-50 transition-colors mb-4"
        >
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">G</span>
          </div>
          <span className="font-medium text-gray-700">Entrar com Google</span>
        </button>

        <p className="text-xs text-gray-500">
          Ao continuar, você concorda com nossos Termos de Serviço
        </p>
        
        {/* Informação de debug */}
        {import.meta.env.DEV && (
          <div className="mt-4 p-2 bg-yellow-100 rounded text-xs">
            <p>Modo desenvolvimento</p>
            <p>URL: {import.meta.env.VITE_API_URL || 'Não configurado'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleAuth;