import React, { useState, useEffect } from "react";
import type { Expense, TranscriptionResponse } from "../types";
import AudioRecorder from "./AudioRecorder";
import ExpenseForm from "./ExpenseForm";
import ExpenseHistory from "./ExpenseHistory";
import Dashboard from "./Dashboard";
import { api } from "../services/api";

interface User {
  email: string;
  name: string;
  googleId: string;
  id?: number;
  onboardingCompleted?: boolean;
}

interface OnboardingData {
  userType: 'pessoal' | 'empresarial' | 'pessoal_empresarial';
  costCenters: string[];
  categories: string[];
}

interface MainAppProps {
  user: User;
  onboardingData: OnboardingData;
  onLogout: () => void;
}

const MainApp: React.FC<MainAppProps> = ({ user, onboardingData, onLogout }) => {
  // Verificação de segurança
  if (!onboardingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-2xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Erro de Configuração</h1>
          <p className="text-gray-600 mb-4">Dados de onboarding não encontrados.</p>
          <button
            onClick={onLogout}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Fazer Login Novamente
          </button>
        </div>
      </div>
    );
  }

  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);
  const [history, setHistory] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<'main' | 'dashboard'>('main');

  // Carregar informações do usuário e despesas ao iniciar
  useEffect(() => {
    loadUserData();
  }, []);

  // Carregar despesas sempre que o userId mudar
  useEffect(() => {
    if (userId) {
      loadExpenses();
    }
  }, [userId]);

  const loadUserData = async () => {
    try {
      // Buscar ID do usuário pelo email
      const userInfo = await api.getUserByEmail(user.email);
      setUserId(userInfo.id);
    } catch (err) {
      console.error('Erro ao carregar dados do usuário:', err);
      setError('Erro ao carregar dados do usuário');
    }
  };

  const loadExpenses = async () => {
    if (!userId) return;
    
    try {
      // Buscar todas as despesas do backend
      const expenses = await api.getExpenses(userId);
      setHistory(expenses);
    } catch (err) {
      console.error('Erro ao carregar despesas:', err);
      setError('Erro ao carregar histórico de despesas');
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!userId) {
      setError('Usuário não identificado. Faça login novamente.');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result: TranscriptionResponse = await api.transcribeAudio(audioBlob, userId);
      
      // Usar total_amount em vez de amount (consistência com backend)
      const newExpense: Expense = {
        id: result.expense_id,
        description: result.description,
        category: result.category,
        total_amount: result.total_amount,
        payment_method: result.payment_method,
        installments: result.installments?.length || 1,
        created_at: new Date().toISOString(),
        text: result.text,
        cost_center: result.cost_center,
        cost_center_id: undefined,
        category_id: undefined
      };

      setCurrentExpense(newExpense);
      
    } catch (err) {
      console.error('Erro na transcrição:', err);
      setError('Erro ao processar áudio. Tente novamente.');
      
      // Fallback: criar despesa manualmente se a transcrição falhar
      const fallbackExpense: Expense = {
        description: "",
        category: onboardingData.categories[0] || "Outros",
        total_amount: 0,
        payment_method: "indefinida",
        installments: 1,
        created_at: new Date().toISOString(),
        text: "Transcrição falhou - preencha manualmente",
        cost_center: onboardingData.costCenters[0] || "Pessoal",
        cost_center_id: undefined,
        category_id: undefined
      };
      setCurrentExpense(fallbackExpense);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (expense: Expense) => {
    if (!userId) return;

    try {
      setError(null);

      // Enviar nomes em vez de IDs para o backend
      const expenseToSave = {
        description: expense.description,
        total_amount: expense.total_amount,
        payment_method: expense.payment_method,
        user_id: userId,
        cost_center: expense.cost_center,
        category: expense.category,
        installments: expense.installments > 1 ? 
          Array.from({ length: expense.installments }, (_, i) => ({
            amount: expense.total_amount / expense.installments,
            due_date: new Date(Date.now() + (i * 30 * 24 * 60 * 60 * 1000)),
            status: 'pending',
            installment_number: i + 1
          })) : []
      };

      console.log('Enviando despesa para o backend:', expenseToSave);

      await api.saveExpense(expenseToSave);
      
      setCurrentExpense(null);
      await loadExpenses();
    } catch (err) {
      console.error('Erro ao salvar despesa:', err);
      setError('Erro ao salvar despesa');
    }
  };

  const handleEdit = async (updatedExpense: Expense) => {
    if (!updatedExpense.id) {
      console.error('Não é possível editar despesa sem ID');
      return;
    }

    try {
      // Usar nomes em vez de IDs para atualização
      const expenseData = {
        description: updatedExpense.description,
        total_amount: updatedExpense.total_amount,
        payment_method: updatedExpense.payment_method,
        cost_center: updatedExpense.cost_center,
        category: updatedExpense.category
      };

      await api.updateExpense(updatedExpense.id, expenseData);
      await loadExpenses();
    } catch (err) {
      console.error('Erro ao editar despesa:', err);
      setError('Erro ao editar despesa');
    }
  };

  const handleDelete = async (expenseId: number) => {
    if (!expenseId) {
      console.error('Não é possível excluir despesa sem ID');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir esta despesa?')) {
      return;
    }

    try {
      await api.deleteExpense(expenseId);
      await loadExpenses();
    } catch (err) {
      console.error('Erro ao excluir despesa:', err);
      setError('Erro ao excluir despesa');
    }
  };

  // Renderizar Dashboard se a view for 'dashboard'
  if (currentView === 'dashboard') {
    return (
      <div>
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900">VoiceExpense</h1>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentView('main')}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    🎤 Registrar Despesa
                  </button>
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    📊 Dashboard
                  </button>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{user.name}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-xl transition-all duration-200"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        {userId && (
          <Dashboard userId={userId} />
        )}
      </div>
    );
  }

  // Renderizar view principal (gravação + histórico)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">VoiceExpense</h1>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentView('main')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  🎤 Registrar Despesa
                </button>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  📊 Dashboard
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-semibold text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-xl transition-all duration-200"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Mensagem de erro */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="mb-6 p-6 bg-white rounded-xl shadow-sm text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Processando áudio...</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna esquerda - Gravador e Dicas */}
            <div className="lg:col-span-1 space-y-6">
              {/* Dicas em Card */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm">💡</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Dicas para uma boa gravação
                    </h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Fale de forma clara e pausada</li>
                      <li>• Mantenha o microfone próximo</li>
                      <li>• Mencione: valor, forma de pagamento e categoria</li>
                      <li>• Exemplo: "150 reais de insumos para Empresa 2 no crédito"</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Gravador de áudio */}
              {!isLoading && (
                <AudioRecorder onRecordingComplete={handleRecordingComplete} />
              )}
            </div>

            {/* Coluna direita - Formulário e Histórico */}
            <div className="lg:col-span-2 space-y-6">
              {/* Formulário de edição */}
              {currentExpense && (
                <ExpenseForm
                  expense={currentExpense}
                  costCenters={onboardingData.costCenters}
                  categories={onboardingData.categories}
                  onConfirm={handleConfirm}
                  onCancel={() => setCurrentExpense(null)}
                />
              )}

              {/* Histórico de despesas */}
              <ExpenseHistory
                expenses={history}
                onEdit={handleEdit}
                onDelete={handleDelete}
                costCenters={onboardingData.costCenters}
                categories={onboardingData.categories}
              />

              {/* Empty State */}
              {history.length === 0 && !currentExpense && !isLoading && (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📝</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Nenhuma despesa registrada
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Suas despesas aparecerão aqui após a gravação por voz
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainApp;