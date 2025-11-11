import React, { useState } from 'react';

export interface OnboardingData {
  userType: 'pessoal' | 'empresarial' | 'pessoal_empresarial';
  costCenters: string[];
  categories: string[];
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
  userEmail: string;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, userEmail }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    userType: 'pessoal',
    costCenters: ['Pessoal'],
    categories: ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Entretenimento', 'Outros']
  });
  const [newCategory, setNewCategory] = useState('');

  const steps = [
    {
      title: "Bem-vindo ao VoiceExpense!",
      subtitle: "Como você usará o sistema?",
      component: (
        <div className="space-y-4">
          <button
            onClick={() => setOnboardingData({...onboardingData, userType: 'pessoal'})}
            className={`w-full p-4 rounded-xl border-2 text-left ${
              onboardingData.userType === 'pessoal' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">💰 Pessoal</div>
            <div className="text-sm text-gray-600">Controle seus gastos pessoais</div>
          </button>
          
          <button
            onClick={() => setOnboardingData({...onboardingData, userType: 'empresarial'})}
            className={`w-full p-4 rounded-xl border-2 text-left ${
              onboardingData.userType === 'empresarial' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">🏢 Empresarial</div>
            <div className="text-sm text-gray-600">Controle gastos da sua empresa</div>
          </button>
          
          <button
            onClick={() => setOnboardingData({...onboardingData, userType: 'pessoal_empresarial'})}
            className={`w-full p-4 rounded-xl border-2 text-left ${
              onboardingData.userType === 'pessoal_empresarial' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">🔀 Pessoal e Empresarial</div>
            <div className="text-sm text-gray-600">Controle gastos pessoais e empresariais</div>
          </button>
        </div>
      )
    },
    {
      title: "Centros de Custo",
      subtitle: "Quais centros de custo você deseja controlar?",
      component: (
        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="font-medium text-gray-900">Pessoal</div>
            <div className="text-sm text-gray-600">Seus gastos pessoais</div>
          </div>
          
          {onboardingData.userType !== 'pessoal' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Adicione suas empresas:
              </label>
              {onboardingData.costCenters
                .filter(cc => cc !== 'Pessoal')
                .map((costCenter, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={costCenter}
                      onChange={(e) => {
                        const newCostCenters = [...onboardingData.costCenters];
                        newCostCenters[index + 1] = e.target.value;
                        setOnboardingData({...onboardingData, costCenters: newCostCenters});
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded-lg"
                      placeholder="Nome da empresa"
                    />
                    <button
                      onClick={() => {
                        const newCostCenters = onboardingData.costCenters.filter((_, i) => i !== index + 1);
                        setOnboardingData({...onboardingData, costCenters: newCostCenters});
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                ))
              }
              <button
                onClick={() => {
                  const newCostCenters = [...onboardingData.costCenters, 'Nova Empresa'];
                  setOnboardingData({...onboardingData, costCenters: newCostCenters});
                }}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 flex items-center justify-center"
              >
                <span className="mr-2">+</span>
                Adicionar Empresa
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      title: "Categorias",
      subtitle: "Quais categorias de gastos você deseja usar?",
      component: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 
              'Entretenimento', 'Vestuário', 'Serviços', 'Investimentos', 'Outros',
              'Contas', 'Insumos', 'Salários', 'Manutenção', 'Despesas Extras'
            ].map(category => (
              <label key={category} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onboardingData.categories.includes(category)}
                  onChange={(e) => {
                    const newCategories = e.target.checked
                      ? [...onboardingData.categories, category]
                      : onboardingData.categories.filter(c => c !== category);
                    setOnboardingData({...onboardingData, categories: newCategories});
                  }}
                  className="rounded text-blue-600"
                />
                <span className="text-sm">{category}</span>
              </label>
            ))}
          </div>
          
          {/* CORREÇÃO: Campo para adicionar nova categoria com botão */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Digite uma nova categoria..."
              className="flex-1 p-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => {
                if (newCategory.trim() && !onboardingData.categories.includes(newCategory.trim())) {
                  setOnboardingData({
                    ...onboardingData,
                    categories: [...onboardingData.categories, newCategory.trim()]
                  });
                  setNewCategory('');
                }
              }}
              disabled={!newCategory.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Adicionar
            </button>
          </div>
          
          {/* Lista de categorias personalizadas adicionadas */}
          {onboardingData.categories.filter(cat => 
            ![
              'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 
              'Entretenimento', 'Vestuário', 'Serviços', 'Investimentos', 'Outros',
              'Contas', 'Insumos', 'Salários', 'Manutenção', 'Despesas Extras'
            ].includes(cat)
          ).length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2">Suas categorias personalizadas:</h4>
              <div className="flex flex-wrap gap-2">
                {onboardingData.categories.filter(cat => 
                  ![
                    'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 
                    'Entretenimento', 'Vestuário', 'Serviços', 'Investimentos', 'Outros',
                    'Contas', 'Insumos', 'Salários', 'Manutenção', 'Despesas Extras'
                  ].includes(cat)
                ).map((category, index) => (
                  <div key={index} className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    <span>{category}</span>
                    <button
                      onClick={() => {
                        const newCategories = onboardingData.categories.filter(c => c !== category);
                        setOnboardingData({...onboardingData, categories: newCategories});
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      title: "Tudo Pronto!",
      subtitle: "Agora você tem controle total das suas despesas",
      component: (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">🎉</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Configuração Concluída!</h3>
            <p className="text-gray-600 text-sm mt-1">
              Agora você pode registrar despesas por voz e organizá-las automaticamente.
            </p>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(onboardingData);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{steps[currentStep].title}</h1>
            <div className="text-sm text-gray-500">
              {currentStep + 1}/{steps.length}
            </div>
          </div>
          <p className="text-gray-600">{steps[currentStep].subtitle}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>

        {/* Step content */}
        {steps[currentStep].component}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`px-6 py-2 rounded-lg ${
              currentStep === 0 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Voltar
          </button>
          
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {currentStep === steps.length - 1 ? 'Começar a Usar' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;