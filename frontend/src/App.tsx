import React, { useState, useEffect } from 'react';
import GoogleAuth from './components/GoogleAuth';
import OnboardingFlow from './components/OnboardingFlow';
import type { OnboardingData } from './components/OnboardingFlow';
import MainApp from './components/MainApp';
import { api, type OnboardingPayload } from './services/api';

interface User {
  email: string;
  name: string;
  googleId: string;
  onboardingCompleted?: boolean;
  id?: number;
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
    // Verificar se usuário já está logado
    const savedUser = localStorage.getItem('voiceexpense_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        checkUserOnboarding(userData);
      } catch (err) {
        console.error('Erro ao carregar usuário do localStorage:', err);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const checkUserOnboarding = async (userData: User) => {
    try {
      // CORREÇÃO: Verificar se o backend está respondendo
      try {
        await api.healthCheck();
      } catch (healthError) {
        throw new Error('Backend não está respondendo. Verifique se o servidor está rodando na porta 8000.');
      }
      
      // Buscar informações completas do usuário do backend
      const userInfo = await api.getUserByEmail(userData.email);
      
      if (userInfo.onboarding_completed) {
        // Se já completou onboarding, buscar centros de custo e categorias
        const fullUserInfo = await api.getUserInfo(userInfo.id);
        
        // Criar OnboardingData a partir das informações do usuário
        const existingOnboardingData: OnboardingData = {
          userType: fullUserInfo.user_type as 'pessoal' | 'empresarial' | 'pessoal_empresarial',
          costCenters: fullUserInfo.cost_centers?.map((cc: any) => cc.name) || ['Pessoal'],
          categories: fullUserInfo.categories?.map((cat: any) => cat.name) || ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Entretenimento', 'Outros']
        };
        
        setOnboardingData(existingOnboardingData);
        
        // Atualizar usuário com informações do backend
        const updatedUser = { 
          ...userData, 
          onboardingCompleted: true,
          id: userInfo.id 
        };
        setUser(updatedUser);
        localStorage.setItem('voiceexpense_user', JSON.stringify(updatedUser));
      } else {
        // Atualizar usuário com ID do backend
        const updatedUser = { 
          ...userData, 
          id: userInfo.id,
          onboardingCompleted: false 
        };
        setUser(updatedUser);
        localStorage.setItem('voiceexpense_user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Erro ao verificar onboarding:', error);
      setError(error instanceof Error ? error.message : 'Erro de conexão com o servidor');
      // Usuário não existe ainda, manter dados padrão
      const updatedUser = { 
        ...userData, 
        onboardingCompleted: false 
      };
      setUser(updatedUser);
      localStorage.setItem('voiceexpense_user', JSON.stringify(updatedUser));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (userData: User) => {
    try {
      setError(null);
      
      // Verificar se o backend está respondendo
      try {
        await api.healthCheck();
      } catch (healthError) {
        throw new Error('Backend não está respondendo. Verifique se o servidor está rodando na porta 8000.');
      }
      
      // Criar ou atualizar usuário no backend
      const backendUser = await api.createOrUpdateUser({
        email: userData.email,
        name: userData.name,
        google_id: userData.googleId
      });
      
      // Atualizar usuário com dados do backend
      const completeUser = {
        ...userData,
        id: backendUser.id,
        onboardingCompleted: backendUser.onboarding_completed
      };
      
      setUser(completeUser);
      localStorage.setItem('voiceexpense_user', JSON.stringify(completeUser));
      
      // Se já completou onboarding, carregar dados
      if (backendUser.onboarding_completed) {
        await checkUserOnboarding(completeUser);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Erro no login:', error);
      setError(error instanceof Error ? error.message : 'Erro de conexão com o servidor');
      // Fallback: usar dados locais se backend falhar
      const fallbackUser = {
        ...userData,
        onboardingCompleted: false
      };
      setUser(fallbackUser);
      localStorage.setItem('voiceexpense_user', JSON.stringify(fallbackUser));
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
      const updatedUser = { ...user, onboardingCompleted: true };
      setUser(updatedUser);
      localStorage.setItem('voiceexpense_user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Erro ao completar onboarding:', error);
      setError('Erro ao completar configuração. Tente novamente.');
      // Fallback: atualizar localmente mesmo se backend falhar
      setOnboardingData(data);
      const updatedUser = { ...user, onboardingCompleted: true };
      setUser(updatedUser);
      localStorage.setItem('voiceexpense_user', JSON.stringify(updatedUser));
    }
  };

  const handleLogout = () => {
    setUser(null);
    setOnboardingData(defaultOnboardingData);
    setError(null);
    localStorage.removeItem('voiceexpense_user');
  };

  const handleRetry = () => {
    setError(null);
    if (user) {
      checkUserOnboarding(user);
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

  if (!user.onboardingCompleted) {
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