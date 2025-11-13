// App.tsx - VERSÃO COMPLETA E CORRIGIDA
import React, { useState, useEffect } from 'react';
import GoogleAuth from './components/GoogleAuth';
import OnboardingFlow from './components/OnboardingFlow';
import type { OnboardingData } from './components/OnboardingFlow';
import MainApp from './components/MainApp';
import { api } from './services/api';

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
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      console.log('🔐 Verificando autenticação existente...');
      const token = localStorage.getItem('access_token');
      
      if (token) {
        console.log('✅ Token encontrado, verificando...');
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://voice-expense-app-production-production.up.railway.app';
        const response = await fetch(`${API_BASE_URL}/api/auth/verify?token=${token}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Usuário autenticado:', data.user.email);
          setUser(data.user);
          await loadUserData(data.user.id);
          return;
        } else {
          console.log('❌ Token inválido, removendo...');
          localStorage.removeItem('access_token');
        }
      } else {
        console.log('ℹ️ Nenhum token encontrado');
      }
    } catch (error) {
      console.error('❌ Erro na verificação de auth:', error);
      localStorage.removeItem('access_token');
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async (userId: number) => {
    try {
      console.log('📥 Carregando dados do usuário...');
      const userInfo = await api.getUserInfo(userId);
      
      const userOnboardingData: OnboardingData = {
        userType: userInfo.user.user_type as 'pessoal' | 'empresarial' | 'pessoal_empresarial',
        costCenters: userInfo.cost_centers?.map((cc: any) => cc.name) || ['Pessoal'],
        categories: userInfo.categories?.map((cat: any) => cat.name) || ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Entretenimento', 'Outros']
      };
      
      setOnboardingData(userOnboardingData);
      console.log('✅ Dados do usuário carregados');
      
    } catch (error) {
      console.error('⚠️ Erro ao carregar dados do usuário:', error);
      // Usar dados padrão se não conseguir carregar
    }
  };

  const handleGoogleSuccess = async (authData: { user: User; token: string }) => {
    try {
      console.log('✅ Login Google bem-sucedido:', authData.user.email);
      setUser(authData.user);
      setError(null);
      
      if (authData.user.onboarding_completed) {
        console.log('🔄 Usuário já completou onboarding');
        await loadUserData(authData.user.id);
      } else {
        console.log('📝 Usuário precisa completar onboarding');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Erro no handleGoogleSuccess:', error);
      setError('Erro ao processar login');
      setLoading(false);
    }
  };

  const handleGoogleError = (error: string) => {
    console.error('❌ Erro no Google Auth:', error);
    setError(error);
    setLoading(false);
  };

  // ✅ CORREÇÃO: Adicionar a função handleOnboardingComplete que estava faltando
  const handleOnboardingComplete = async (data: OnboardingData) => {
    if (!user?.id) {
      console.error('❌ ID do usuário não encontrado');
      setError('ID do usuário não encontrado');
      return;
    }

    try {
      console.log('📝 Completando onboarding...');
      setError(null);
      
      // Converter do formato frontend para o formato backend
      const onboardingPayload = {
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
    localStorage.removeItem('access_token');
    console.log('✅ Logout concluído');
  };

  const handleRetry = () => {
    console.log('🔄 Tentando novamente...');
    setError(null);
    setLoading(true);
    checkExistingAuth();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erro de Autenticação</h2>
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
    return <GoogleAuth onSuccess={handleGoogleSuccess} onError={handleGoogleError} />;
  }

  if (!user.onboarding_completed) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
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