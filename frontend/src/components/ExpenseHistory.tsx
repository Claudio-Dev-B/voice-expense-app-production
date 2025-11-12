// components/ExpenseHistory.tsx
import React, { useState } from "react";
import type { Expense } from "../types";

interface Props {
  expenses: Expense[];
  onDelete: (expenseId: number) => void;
  onEdit: (expense: Expense) => void;
  costCenters?: string[];
  categories?: string[];
  sharedAccountName?: string;
}

const ExpenseHistory: React.FC<Props> = ({ 
  expenses, 
  onDelete, 
  onEdit, 
  costCenters = ["Pessoal", "Loja", "Restaurante"],
  categories = ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Entretenimento", "Outros"],
  sharedAccountName
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedExpense, setEditedExpense] = useState<Expense | null>(null);

  const paymentMethods = [
    "Dinheiro", "Cartão Crédito", "Cartão Débito", 
    "PIX", "Transferência", "Boleto", "Outros"
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleEditClick = (expense: Expense) => {
    setEditingId(expense.id || null);
    setEditedExpense({ ...expense });
  };

  const handleSaveEdit = () => {
    if (editedExpense) {
      onEdit(editedExpense);
      setEditingId(null);
      setEditedExpense(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedExpense(null);
  };

  const handleDeleteClick = (expense: Expense) => {
    if (expense.id) {
      onDelete(expense.id);
    }
  };

  // Mostrar apenas as últimas 5 despesas
  const recentExpenses = expenses.slice(0, 5);

  // Mapear payment_method para o formato do select (similar ao ExpenseForm)
  const mapPaymentMethodToSelect = (paymentMethod: string): string => {
    const mapping: { [key: string]: string } = {
      'cartão crédito': 'Cartão Crédito',
      'cartão débito': 'Cartão Débito', 
      'transferência': 'Transferência',
      'dinheiro': 'Dinheiro',
      'pix': 'PIX',
      'boleto': 'Boleto',
      'indefinida': 'Outros'
    };
    return mapping[paymentMethod] || paymentMethod || 'Outros';
  };

  const mapSelectToPaymentMethod = (selectValue: string): string => {
    const mapping: { [key: string]: string } = {
      'Cartão Crédito': 'cartão crédito',
      'Cartão Débito': 'cartão débito',
      'Transferência': 'transferência', 
      'Dinheiro': 'dinheiro',
      'PIX': 'pix',
      'Boleto': 'boleto',
      'Outros': 'indefinida'
    };
    return mapping[selectValue] || selectValue || 'indefinida';
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <span className="text-green-600">📊</span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Histórico de Despesas</h2>
            <p className="text-sm text-gray-500">
              {sharedAccountName ? `Conta: ${sharedAccountName} • ` : ''}
              {recentExpenses.length > 0 
                ? `${recentExpenses.length} últimas despesas` 
                : 'Nenhuma despesa registrada'
              }
            </p>
          </div>
        </div>
        
        {expenses.length > 5 && (
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            +{expenses.length - 5} mais antigas
          </div>
        )}
      </div>

      <div className="space-y-4">
        {recentExpenses.map((expense) => (
          <div key={expense.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            {editingId === expense.id ? (
              // Modo edição
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <input
                    type="text"
                    value={editedExpense?.description || ""}
                    onChange={(e) => setEditedExpense(prev => prev ? {...prev, description: e.target.value} : null)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Descrição"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editedExpense?.total_amount || 0}
                      onChange={(e) => setEditedExpense(prev => prev ? {...prev, total_amount: parseFloat(e.target.value) || 0} : null)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Valor"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={editedExpense?.installments || 1}
                      onChange={(e) => setEditedExpense(prev => prev ? {...prev, installments: parseInt(e.target.value) || 1} : null)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Parcelas"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Custo</label>
                    <select
                      value={editedExpense?.cost_center || "Pessoal"}
                      onChange={(e) => setEditedExpense(prev => prev ? {...prev, cost_center: e.target.value} : null)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      {costCenters.map(center => (
                        <option key={center} value={center}>{center}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select
                      value={editedExpense?.category || "Outros"}
                      onChange={(e) => setEditedExpense(prev => prev ? {...prev, category: e.target.value} : null)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                  <select
                    value={mapPaymentMethodToSelect(editedExpense?.payment_method || "indefinida")}
                    onChange={(e) => setEditedExpense(prev => prev ? {...prev, payment_method: mapSelectToPaymentMethod(e.target.value)} : null)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {paymentMethods.map(method => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>

                {/* Indicador de conta compartilhada (somente leitura) */}
                {expense.shared_account_name && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="text-blue-600">🏢</span>
                      <span className="font-medium text-blue-800">Conta: {expense.shared_account_name}</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      Esta despesa pertence a uma conta compartilhada
                    </p>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-green-500 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 bg-gray-500 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              // Modo visualização
              <>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">
                      {expense.description || "Sem descrição"}
                    </h3>
                    
                    {/* Indicador de conta compartilhada */}
                    {expense.shared_account_name && (
                      <div className="flex items-center space-x-1 mb-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center space-x-1">
                          <span>🏢</span>
                          <span>{expense.shared_account_name}</span>
                        </span>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{formatDate(expense.created_at)}</span>
                      <span>•</span>
                      <span>{expense.cost_center}</span>
                      <span>•</span>
                      <span>{expense.category}</span>
                      <span>•</span>
                      <span className="capitalize">
                        {mapPaymentMethodToSelect(expense.payment_method)}
                      </span>
                      {(expense.installments || 1) > 1 && (
                        <>
                          <span>•</span>
                          <span className="text-orange-600 font-medium">
                            {(expense.installments || 1)}x
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <span className="text-lg font-bold text-blue-600 block">
                      {formatCurrency(expense.total_amount)}
                    </span>
                    {(expense.installments || 1) > 1 && expense.total_amount > 0 && (
                      <span className="text-xs text-gray-500 block">
                        {formatCurrency(expense.total_amount / (expense.installments || 1))}/parcela
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    onClick={() => handleEditClick(expense)}
                  >
                    Editar
                  </button>
                  <button
                    className="flex-1 bg-red-500 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                    onClick={() => handleDeleteClick(expense)}
                  >
                    Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {recentExpenses.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📝</span>
          </div>
          <p className="text-gray-500 text-sm">
            {sharedAccountName 
              ? `Nenhuma despesa encontrada na conta ${sharedAccountName}`
              : 'Nenhuma despesa registrada ainda'
            }
          </p>
        </div>
      )}

      {/* Estatísticas rápidas */}
      {recentExpenses.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="font-semibold text-blue-900">
                {formatCurrency(expenses.reduce((sum, exp) => sum + exp.total_amount, 0))}
              </div>
              <div className="text-blue-600 text-xs">Total Geral</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="font-semibold text-green-900">{expenses.length}</div>
              <div className="text-green-600 text-xs">Total Despesas</div>
            </div>
          </div>
          
          {/* Filtro por conta compartilhada */}
          {sharedAccountName && (
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-500">
                Mostrando despesas da conta: <span className="font-medium text-gray-700">{sharedAccountName}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpenseHistory;