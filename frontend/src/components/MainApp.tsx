// MainApp.tsx
import React, { useState, useEffect } from "react";
import type { Expense, TranscriptionResponse, SharedAccount } from "../types";
import AudioRecorder from "./AudioRecorder";
import ExpenseForm from "./ExpenseForm";
import ExpenseHistory from "./ExpenseHistory";
import Dashboard from "./Dashboard";
import InviteShareModal from "./InviteShareModal";
import { api } from "../services/api";

interface User {
  id: number;
  email: string;
  name: string;
  picture?: string;
  onboarding_completed: boolean;
  user_type: string;
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
  const [currentView, setCurrentView] = useState<'main' | 'dashboard'>('main');
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SharedAccount | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Carregar contas compartilhadas e despesas ao iniciar
  useEffect(() => {
    loadSharedAccounts();
  }, []);

  // Carregar despesas quando a conta selecionada mudar
  useEffect(() => {
    loadExpenses();
  }, [selectedAccount]);

  const loadSharedAccounts = async () => {
    try {
      setAccountsLoading(true);
      const response = await api.getUserAccounts();
      setSharedAccounts(response.accounts);
      
      // Selecionar primeira conta por padrão (ou conta pessoal se existir)
      if (response.accounts.length > 0) {
        const personalAccount = response.accounts.find(acc => acc.name === 'Pessoal');
        setSelectedAccount(personalAccount || response.accounts[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar contas compartilhadas:', err);
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadExpenses = async () => {
    try {
      const sharedAccountId = selectedAccount?.id || undefined;
      const expenses = await api.getExpenses(user.id, sharedAccountId);
      setHistory(expenses);
    } catch (err) {
      console.error('Erro ao carregar despesas:', err);
      setError('Erro ao carregar histórico de despesas');
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result: TranscriptionResponse = await api.transcribeAudio(audioBlob, user.id);
      
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
        category_id: undefined,
        shared_account_id: selectedAccount?.id,
        shared_account_name: selectedAccount?.name
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
        category_id: undefined,
        shared_account_id: selectedAccount?.id,
        shared_account_name: selectedAccount?.name
      };
      setCurrentExpense(fallbackExpense);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (expense: Expense) => {
    try {
      setError(null);

      // Enviar nomes em vez de IDs para o backend
      const expenseToSave = {
        description: expense.description,
        total_amount: expense.total_amount,
        payment_method: expense.payment_method,
        user_id: user.id,
        cost_center: expense.cost_center,
        category: expense.category,
        shared_account_id: selectedAccount?.id,
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
        category: updatedExpense.category,
        shared_account_id: selectedAccount?.id
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

  const handleCreateAccount = async (accountName: string) => {
    try {
      await api.createSharedAccount({ name: accountName });
      await loadSharedAccounts();
      setShowInviteModal(false);
    } catch (err) {
      console.error('Erro ao criar conta:', err);
      setError('Erro ao criar conta compartilhada');
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
                <AccountSelector
                  accounts={sharedAccounts}
                  selectedAccount={selectedAccount}
                  onSelectAccount={setSelectedAccount}
                  loading={accountsLoading}
                  onCreateAccount={() => setShowInviteModal(true)}
                />
                
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
        <Dashboard 
          userId={user.id} 
          sharedAccountId={selectedAccount?.id} 
        />
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
              <AccountSelector
                accounts={sharedAccounts}
                selectedAccount={selectedAccount}
                onSelectAccount={setSelectedAccount}
                loading={accountsLoading}
                onCreateAccount={() => setShowInviteModal(true)}
              />
              
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

          {/* Indicador de conta selecionada */}
          {selectedAccount && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-sm">🏢</span>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-900">
                      Conta: {selectedAccount.name}
                    </p>
                    <p className="text-sm text-blue-600">
                      {selectedAccount.role === 'owner' ? '👑 Proprietário' : 
                       selectedAccount.role === 'admin' ? '⚡ Administrador' : 
                       selectedAccount.role === 'member' ? '👥 Membro' : '👀 Visualizador'}
                      {selectedAccount.member_count > 1 && ` • ${selectedAccount.member_count} membros`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-white border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium"
                >
                  👥 Gerenciar
                </button>
              </div>
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
                  sharedAccounts={sharedAccounts}
                  selectedAccount={selectedAccount}
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
                sharedAccountName={selectedAccount?.name}
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
                    {selectedAccount 
                      ? `Suas despesas de ${selectedAccount.name} aparecerão aqui` 
                      : 'Suas despesas aparecerão aqui após a gravação por voz'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Gerenciamento de Contas */}
      {showInviteModal && (
        <InviteShareModal
          accounts={sharedAccounts}
          selectedAccount={selectedAccount}
          onClose={() => setShowInviteModal(false)}
          onAccountCreated={handleCreateAccount}
          onAccountSelected={setSelectedAccount}
          onAccountsUpdated={loadSharedAccounts}
        />
      )}
    </div>
  );
};

// Componente para seletor de contas
interface AccountSelectorProps {
  accounts: SharedAccount[];
  selectedAccount: SharedAccount | null;
  onSelectAccount: (account: SharedAccount) => void;
  loading: boolean;
  onCreateAccount: () => void;
}

const AccountSelector: React.FC<AccountSelectorProps> = ({
  accounts,
  selectedAccount,
  onSelectAccount,
  loading,
  onCreateAccount
}) => {
  const [selectValue, setSelectValue] = useState(selectedAccount?.id?.toString() || '');

  // Efeito para detectar quando o usuário seleciona "Nova conta..."
  useEffect(() => {
    if (selectValue === 'create') {
      onCreateAccount();
      // Reset para o valor anterior após criar a conta
      setSelectValue(selectedAccount?.id?.toString() || '');
    }
  }, [selectValue, onCreateAccount, selectedAccount]);

  if (loading) {
    return (
      <div className="w-48 bg-gray-100 rounded-lg py-2 px-3">
        <div className="animate-pulse flex space-x-2">
          <div className="w-4 h-4 bg-gray-300 rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={selectValue}
        onChange={(e) => {
          setSelectValue(e.target.value);
          if (e.target.value !== 'create') {
            const account = accounts.find(acc => acc.id === parseInt(e.target.value));
            if (account) onSelectAccount(account);
          }
        }}
        className="w-48 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        {accounts.map(account => (
          <option key={account.id} value={account.id.toString()}>
            {account.name} {account.role === 'owner' && '👑'}
          </option>
        ))}
        <option value="create">+ Nova conta...</option>
      </select>
    </div>
  );
};

export default MainApp;