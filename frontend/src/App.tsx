// App.tsx - VERSÃO COMPLETA CORRIGIDA
import React, { useState, useEffect } from 'react';
import GoogleAuth from './components/GoogleAuth';
import OnboardingFlow from './components/OnboardingFlow';
import type { OnboardingData } from './components/OnboardingFlow';
import MainApp from './components/MainApp';
import { api, type OnboardingPayload } from './services/api';

interface User {
  id: number;
  email: string;
  name: string;
  picture?: string;
  onboarding_completed: boolean;
  user_type: string;
}

// Dados padrão para onboarding
const defaultOnboardingData: OnboardingData = {
  userType: 'pessoal',
  costCenters: ['Pessoal'],
  categories: ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Entretenimento', 'Outros']
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>(defaultOnboardingData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    console.log('🚀 App inicializando...');
    validateTokenAndLoadUser();
  }, []);

  // ✅ CORREÇÃO: Verificação de fallback no localStorage
  useEffect(() => {
    // Verificar se há dados de auth no localStorage (fallback)
    const checkLocalStorageAuth = () => {
      try {
        const authData = localStorage.getItem('voiceexpense_auth_data');
        if (authData) {
          console.log('🔍 Dados de auth encontrados no localStorage (fallback)');
          const parsedData = JSON.parse(authData);
          
          if (parsedData.type === 'GOOGLE_AUTH_SUCCESS') {
            console.log('✅ Processando auth do localStorage fallback');
            processAuthSuccess(parsedData);
            localStorage.removeItem('voiceexpense_auth_data');
          }
        }
      } catch (error) {
        console.error('Erro ao verificar localStorage auth:', error);
      }
    };

    // Verificar a cada 2 segundos por 30 segundos
    const interval = setInterval(checkLocalStorageAuth, 2000);
    const timeout = setTimeout(() => {
      console.log('⏰ Timeout da verificação do localStorage');
      clearInterval(interval);
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const validateTokenAndLoadUser = async () => {
    try {
      console.log('🔐 Validando token JWT...');
      
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.log('ℹ️ Nenhum token encontrado no localStorage');
        setLoading(false);
        return;
      }

      console.log('✅ Token encontrado, verificando backend...');

      // Verificar se o backend está respondendo
      try {
        await api.healthCheck();
        console.log('✅ Backend respondendo');
      } catch (healthError) {
        console.warn('⚠️ Backend não respondeu, continuando mesmo assim...');
        // Continuamos mesmo se o health check falhar
      }

      // Tentar buscar informações do usuário usando o token
      // Para isso, precisamos de uma rota que valide o token e retorne o usuário
      // Por enquanto, vamos usar uma abordagem alternativa
      
      // Se chegou aqui, assumimos que o token é válido
      // Mas não temos informações do usuário, então vamos forçar novo login
      console.log('ℹ️ Token presente mas sem informações do usuário - forçando novo login');
      localStorage.removeItem('access_token');
      setLoading(false);
      
    } catch (error) {
      console.error('💥 Erro ao validar token:', error);
      // Token inválido ou expirado - limpar e redirecionar para login
      localStorage.removeItem('access_token');
      setError('Sessão expirada. Faça login novamente.');
      setLoading(false);
    }
  };

  const processAuthSuccess = (authData: { user: User; token: string }) => {
    try {
      console.log('🎯 Processando sucesso de autenticação:', {
        userId: authData.user.id,
        userEmail: authData.user.email,
        tokenLength: authData.token?.length
      });

      const userData: User = {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.name,
        picture: authData.user.picture,
        onboarding_completed: authData.user.onboarding_completed,
        user_type: authData.user.user_type
      };
      
      setUser(userData);
      setError(null);

      // Se já completou onboarding, carregar dados
      if (authData.user.onboarding_completed) {
        console.log('📥 Usuário já completou onboarding, carregando dados...');
        loadUserOnboardingData(authData.user.id);
      } else {
        console.log('📝 Usuário precisa completar onboarding');
        setLoading(false);
      }
      
    } catch (error) {
      console.error('💥 Erro ao processar sucesso de auth:', error);
      setError('Erro ao processar login. Tente novamente.');
      setLoading(false);
    }
  };

  const loadUserOnboardingData = async (userId: number) => {
    try {
      console.log('📋 Carregando dados do usuário...');
      const userInfo = await api.getUserInfo(userId);
      
      const existingOnboardingData: OnboardingData = {
        userType: userInfo.user.user_type as 'pessoal' | 'empresarial' | 'pessoal_empresarial',
        costCenters: userInfo.cost_centers?.map((cc: any) => cc.name) || ['Pessoal'],
        categories: userInfo.categories?.map((cat: any) => cat.name) || ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Entretenimento', 'Outros']
      };
      
      setOnboardingData(existingOnboardingData);
      console.log('✅ Dados do usuário carregados com sucesso');
      
    } catch (error) {
      console.error('⚠️ Erro ao carregar dados do usuário, usando padrão:', error);
      // Usar dados padrão se não conseguir carregar
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (authData: { user: User; token: string }) => {
    try {
      console.log('🔑 Iniciando processo de login...');
      setError(null);
      setLoading(true);
      
      console.log('📨 Dados recebidos do Google Auth:', {
        userId: authData.user.id,
        email: authData.user.email,
        onboardingCompleted: authData.user.onboarding_completed
      });
      
      // O token já foi salvo no localStorage pelo GoogleAuth
      processAuthSuccess(authData);
      
    } catch (error) {
      console.error('💥 Erro no login:', error);
      setError(error instanceof Error ? error.message : 'Erro de conexão com o servidor');
      // Limpar token em caso de erro
      localStorage.removeItem('access_token');
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async (data: OnboardingData) => {
    if (!user?.id) {
      console.error('❌ ID do usuário não encontrado');
      setError('ID do usuário não encontrado');
      return;
    }

    try {
      console.log('📝 Completando onboarding para usuário:', user.id);
      setError(null);
      
      // Converter do formato frontend para o formato backend
      const onboardingPayload: OnboardingPayload = {
        user_id: user.id,
        user_type: data.userType,
        cost_centers: data.costCenters,
        categories: data.categories
      };
      
      console.log('📤 Enviando dados de onboarding para o backend...');
      await api.completeOnboarding(onboardingPayload);
      
      setOnboardingData(data);
      
      // Atualizar usuário local
      const updatedUser = { 
        ...user, 
        onboarding_completed: true,
        user_type: data.userType
      };
      setUser(updatedUser);
      
      console.log('✅ Onboarding completado com sucesso');
      
    } catch (error) {
      console.error('⚠️ Erro ao completar onboarding (usando fallback):', error);
      setError('Erro ao completar configuração. Tente novamente.');
      // Fallback: atualizar localmente mesmo se backend falhar
      setOnboardingData(data);
      const updatedUser = { 
        ...user, 
        onboarding_completed: true,
        user_type: data.userType
      };
      setUser(updatedUser);
    }
  };

  const handleLogout = () => {
    console.log('🚪 Efetuando logout...');
    setUser(null);
    setOnboardingData(defaultOnboardingData);
    setError(null);
    setRetryCount(0);
    // Remover token JWT e dados de fallback
    localStorage.removeItem('access_token');
    localStorage.removeItem('voiceexpense_auth_data');
    console.log('✅ Logout concluído');
  };

  const handleRetry = () => {
    console.log('🔄 Tentativa de reconexão:', retryCount + 1);
    setError(null);
    setRetryCount(prev => prev + 1);
    setLoading(true);
    
    const token = localStorage.getItem('access_token');
    if (token) {
      validateTokenAndLoadUser();
    } else {
      setLoading(false);
    }
  };

  const handleHardReset = () => {
    console.log('🔄 Reset completo do aplicativo');
    localStorage.clear();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
          <p className="text-sm text-gray-500 mt-2">Verificando autenticação</p>
          {retryCount > 0 && (
            <p className="text-xs text-gray-400 mt-1">Tentativa {retryCount}</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erro de Conexão</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="text-sm text-gray-500 mb-6">
            <p>Tentativas: {retryCount}</p>
            <p>Token: {localStorage.getItem('access_token') ? 'Presente' : 'Ausente'}</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              🔄 Tentar Novamente
            </button>
            <button
              onClick={handleHardReset}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              🗑️ Limpar Dados e Recarregar
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              🔐 Fazer Login Novamente
            </button>
          </div>
          {import.meta.env.DEV && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-xs text-yellow-700">
              <p><strong>Debug Info:</strong></p>
              <p>API: {import.meta.env.VITE_API_URL}</p>
              <p>Origin: {window.location.origin}</p>
              <p>LocalStorage: {JSON.stringify({
                token: !!localStorage.getItem('access_token'),
                authData: !!localStorage.getItem('voiceexpense_auth_data')
              })}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return <GoogleAuth onSuccess={handleGoogleLogin} />;
  }

  if (!user.onboarding_completed) {
    return (
      <OnboardingFlow 
        onComplete={handleOnboardingComplete} 
      />
    );
  }

  return (
    <MainApp 
      user={user} 
      onboardingData={onboardingData} 
      onLogout={handleLogout} 
    />
  );
};

export default App;