// components/ExpenseForm.tsx
import React, { useState } from "react";
import type { Expense, SharedAccount } from "../types";

interface Props {
  expense: Expense;
  costCenters: string[];
  categories: string[];
  sharedAccounts: SharedAccount[];
  selectedAccount: SharedAccount | null;
  onConfirm: (expense: Expense) => void;
  onCancel: () => void;
}

const ExpenseForm: React.FC<Props> = ({ 
  expense, 
  costCenters, 
  categories, 
  sharedAccounts,
  selectedAccount,
  onConfirm, 
  onCancel 
}) => {
  // CORREÇÃO: Garantir que payment_method seja mapeado corretamente para o select
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

  const [data, setData] = useState<Expense>({
    ...expense,
    // CORREÇÃO: Mapear payment_method para o formato do select
    category: expense.category || categories[0] || "Outros",
    payment_method: mapPaymentMethodToSelect(expense.payment_method || "indefinida"),
    cost_center: expense.cost_center || costCenters[0] || "Pessoal",
    installments: expense.installments || 1,
    total_amount: expense.total_amount || 0,
    shared_account_id: expense.shared_account_id || selectedAccount?.id,
    shared_account_name: expense.shared_account_name || selectedAccount?.name
  });

  const paymentMethods = [
    "Dinheiro", "Cartão Crédito", "Cartão Débito", 
    "PIX", "Transferência", "Boleto", "Outros"
  ];

  const handleConfirm = () => {
    // CORREÇÃO: Mapear de volta para o formato do backend antes de enviar
    const expenseToConfirm = {
      ...data,
      payment_method: mapSelectToPaymentMethod(data.payment_method),
      // Garantir que a conta compartilhada seja a selecionada
      shared_account_id: selectedAccount?.id,
      shared_account_name: selectedAccount?.name
    };
    onConfirm(expenseToConfirm);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="card p-6 mb-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <span className="text-blue-600">✏️</span>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Confirmar Despesa</h2>
          <p className="text-sm text-gray-500">Revise e complete os dados</p>
        </div>
      </div>

      {/* Indicador de conta compartilhada */}
      {selectedAccount && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 text-sm">🏢</span>
            </div>
            <div>
              <p className="font-semibold text-blue-900 text-sm">
                Esta despesa será salva na conta: {selectedAccount.name}
              </p>
              <p className="text-xs text-blue-600">
                {selectedAccount.role === 'owner' ? '👑 Proprietário' : 
                 selectedAccount.role === 'admin' ? '⚡ Administrador' : 
                 selectedAccount.role === 'member' ? '👥 Membro' : '👀 Visualizador'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descrição
          </label>
          <input
            className="input-field"
            placeholder="Ex: Compra de insumos para restaurante"
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Centro de Custo
            </label>
            <select
              className="input-field"
              value={data.cost_center}
              onChange={(e) => setData({ ...data, cost_center: e.target.value })}
            >
              {costCenters.map(center => (
                <option key={center} value={center}>{center}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria
            </label>
            <select
              className="input-field"
              value={data.category}
              onChange={(e) => setData({ ...data, category: e.target.value })}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valor Total (R$)
            </label>
            <input
              className="input-field"
              placeholder="0,00"
              type="number"
              step="0.01"
              min="0"
              value={data.total_amount}
              onChange={(e) =>
                setData({ ...data, total_amount: parseFloat(e.target.value) || 0 })
              }
            />
            {data.total_amount > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {formatCurrency(data.total_amount)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forma de Pagamento
            </label>
            <select
              className="input-field"
              value={data.payment_method}
              onChange={(e) =>
                setData({ ...data, payment_method: e.target.value })
              }
            >
              {paymentMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de Parcelas
            </label>
            <input
              className="input-field"
              placeholder="1"
              type="number"
              min="1"
              max="24"
              value={data.installments}
              onChange={(e) =>
                setData({ ...data, installments: parseInt(e.target.value) || 1 })
              }
            />
            {data.installments > 1 && data.total_amount > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {data.installments}x de {formatCurrency(data.total_amount / data.installments)}
              </p>
            )}
          </div>

          {/* Campo para conta compartilhada (somente leitura) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conta Compartilhada
            </label>
            <div className="input-field bg-gray-50 text-gray-600">
              {selectedAccount ? (
                <div className="flex items-center space-x-2">
                  <span className="text-sm">🏢</span>
                  <span>{selectedAccount.name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    selectedAccount.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                    selectedAccount.role === 'admin' ? 'bg-red-100 text-red-800' :
                    selectedAccount.role === 'member' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedAccount.role === 'owner' ? 'Proprietário' :
                     selectedAccount.role === 'admin' ? 'Admin' :
                     selectedAccount.role === 'member' ? 'Membro' : 'Visualizador'}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Conta pessoal</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Para mudar a conta, use o seletor no cabeçalho
            </p>
          </div>
        </div>

        {/* Resumo da despesa */}
        {(data.description || data.total_amount > 0) && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">📋 Resumo da Despesa</h4>
            <div className="space-y-2 text-sm">
              {data.description && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Descrição:</span>
                  <span className="font-medium text-gray-900">{data.description}</span>
                </div>
              )}
              {data.total_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor:</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(data.total_amount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Centro de Custo:</span>
                <span className="font-medium text-gray-900">{data.cost_center}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Categoria:</span>
                <span className="font-medium text-gray-900">{data.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pagamento:</span>
                <span className="font-medium text-gray-900">{data.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Parcelas:</span>
                <span className="font-medium text-gray-900">{data.installments}x</span>
              </div>
              {selectedAccount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Conta:</span>
                  <span className="font-medium text-gray-900">{selectedAccount.name}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex space-x-3 mt-6">
        <button
          className="btn-primary flex-1"
          onClick={handleConfirm}
          disabled={!data.description.trim() || data.total_amount <= 0}
        >
          Confirmar Despesa
        </button>
        <button
          className="btn-secondary flex-1"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>

      {/* Mensagem de validação */}
      {(!data.description.trim() || data.total_amount <= 0) && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ Preencha a descrição e um valor maior que zero para confirmar a despesa.
          </p>
        </div>
      )}
    </div>
  );
};

export default ExpenseForm;