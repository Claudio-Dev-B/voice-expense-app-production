// App.tsx - ATUALIZADO
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

  useEffect(() => {
    // Verificar se usuário já está logado (token JWT)
    const token = localStorage.getItem('access_token');
    if (token) {
      validateTokenAndLoadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const validateTokenAndLoadUser = async () => {
    try {
      // Verificar se o backend está respondendo
      await api.healthCheck();
      
      // Buscar informações do usuário atual
      // NOTA: Precisamos de uma rota que retorne o usuário baseado no token JWT
      // Por enquanto, vamos usar uma abordagem alternativa
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Token não encontrado');
      }
      
      // Tentar buscar usuário pelo token (precisamos implementar esta rota no backend)
      // Por enquanto, vamos redirecionar para login
      setLoading(false);
      
    } catch (error) {
      console.error('Erro ao validar token:', error);
      // Token inválido ou expirado - limpar e redirecionar para login
      localStorage.removeItem('access_token');
      setError('Sessão expirada. Faça login novamente.');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (authData: { user: User; token: string }) => {
    try {
      setError(null);
      setLoading(true);
      
      console.log('Dados recebidos do Google Auth:', authData);
      
      // O token já foi salvo no localStorage pelo GoogleAuth
      const userData: User = {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.name,
        picture: authData.user.picture,
        onboarding_completed: authData.user.onboarding_completed,
        user_type: authData.user.user_type
      };
      
      setUser(userData);

      // Se já completou onboarding, carregar dados
      if (authData.user.onboarding_completed) {
        try {
          const userInfo = await api.getUserInfo(authData.user.id);
          const existingOnboardingData: OnboardingData = {
            userType: userInfo.user.user_type as 'pessoal' | 'empresarial' | 'pessoal_empresarial',
            costCenters: userInfo.cost_centers?.map((cc: any) => cc.name) || ['Pessoal'],
            categories: userInfo.categories?.map((cat: any) => cat.name) || ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Entretenimento', 'Outros']
          };
          
          setOnboardingData(existingOnboardingData);
        } catch (error) {
          console.error('Erro ao carregar dados do usuário:', error);
          // Manter dados padrão se não conseguir carregar
        }
      }
      
    } catch (error) {
      console.error('Erro no login:', error);
      setError(error instanceof Error ? error.message : 'Erro de conexão com o servidor');
      // Limpar token em caso de erro
      localStorage.removeItem('access_token');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async (data: OnboardingData) => {
    if (!user?.id) {
      console.error('ID do usuário não encontrado');
      setError('ID do usuário não encontrado');
      return;
    }

    try {
      setError(null);
      
      // Converter do formato frontend para o formato backend
      const onboardingPayload: OnboardingPayload = {
        user_id: user.id,
        user_type: data.userType,
        cost_centers: data.costCenters,
        categories: data.categories
      };
      
      await api.completeOnboarding(onboardingPayload);
      
      setOnboardingData(data);
      
      // Atualizar usuário local
      const updatedUser = { 
        ...user, 
        onboarding_completed: true,
        user_type: data.userType
      };
      setUser(updatedUser);
      
    } catch (error) {
      console.error('Erro ao completar onboarding:', error);
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
    setUser(null);
    setOnboardingData(defaultOnboardingData);
    setError(null);
    // Remover token JWT
    localStorage.removeItem('access_token');
  };

  const handleRetry = () => {
    setError(null);
    const token = localStorage.getItem('access_token');
    if (token) {
      validateTokenAndLoadUser();
    } else {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <span className="ml-3 text-gray-600 mt-4 block">Carregando...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erro de Conexão</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tentar Novamente
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Fazer Login Novamente
            </button>
          </div>
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