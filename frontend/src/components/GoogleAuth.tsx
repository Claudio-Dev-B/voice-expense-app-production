import React from 'react';

interface GoogleAuthProps {
  onSuccess: (userData: { email: string; name: string; googleId: string }) => void;
}

const GoogleAuth: React.FC<GoogleAuthProps> = ({ onSuccess }) => {
  const handleGoogleLogin = async () => {
    // TODO: Implementar Google OAuth
    // Por enquanto, simularemos o login
    const mockUser = {
      email: "usuario@gmail.com",
      name: "João Silva", 
      googleId: "google123"
    };
    onSuccess(mockUser);
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
          <img src="/google-icon.svg" alt="Google" className="w-5 h-5" />
          <span className="font-medium text-gray-700">Entrar com Google</span>
        </button>

        <p className="text-xs text-gray-500">
          Ao continuar, você concorda com nossos Termos de Serviço
        </p>
      </div>
    </div>
  );
};

export default GoogleAuth;