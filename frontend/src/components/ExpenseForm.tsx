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
  // Mapeamento para os métodos de pagamento
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

  const [formData, setFormData] = useState<Expense>({
    ...expense,
    category: expense.category || categories[0] || "Outros",
    payment_method: mapPaymentMethodToSelect(expense.payment_method || "indefinida"),
    cost_center: expense.cost_center || costCenters[0] || "Pessoal",
    installments: expense.installments || 1,
    total_amount: expense.total_amount || 0,
    description: expense.description || ""
  });

  const [errors, setErrors] = useState<{
    description?: string;
    total_amount?: string;
  }>({});

  const paymentMethods = [
    "Dinheiro", "Cartão Crédito", "Cartão Débito", 
    "PIX", "Transferência", "Boleto", "Outros"
  ];

  const validateForm = (): boolean => {
    const newErrors: { description?: string; total_amount?: string } = {};

    if (!formData.description.trim()) {
      newErrors.description = "Descrição é obrigatória";
    }

    if (!formData.total_amount || formData.total_amount <= 0) {
      newErrors.total_amount = "Valor deve ser maior que zero";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (!validateForm()) return;

    const expenseToConfirm = {
      ...formData,
      payment_method: mapSelectToPaymentMethod(formData.payment_method)
    };
    onConfirm(expenseToConfirm);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleInputChange = (field: keyof Expense, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpar erro do campo quando usuário começar a digitar
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      owner: { label: 'Proprietário', emoji: '👑', color: 'text-purple-600' },
      admin: { label: 'Administrador', emoji: '⚡', color: 'text-red-600' },
      member: { label: 'Membro', emoji: '👥', color: 'text-blue-600' },
      viewer: { label: 'Visualizador', emoji: '👀', color: 'text-gray-600' }
    };

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.viewer;
    return `${config.emoji} ${config.label}`;
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
                {getRoleBadge(selectedAccount.role)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de contas compartilhadas disponíveis */}
      {sharedAccounts.length > 0 && !selectedAccount && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">
            Contas Compartilhadas Disponíveis
          </h3>
          <div className="space-y-2">
            {sharedAccounts.map(account => (
              <div key={account.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                <span className="text-sm font-medium">{account.name}</span>
                <span className="text-xs text-gray-500">
                  {getRoleBadge(account.role)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descrição *
          </label>
          <input
            className={`input-field ${errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
            placeholder="Ex: Compra de insumos para restaurante"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
          />
          {errors.description && (
            <p className="text-red-600 text-sm mt-1">{errors.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Centro de Custo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Centro de Custo
            </label>
            <select
              className="input-field"
              value={formData.cost_center}
              onChange={(e) => handleInputChange('cost_center', e.target.value)}
            >
              {costCenters.map(center => (
                <option key={center} value={center}>{center}</option>
              ))}
            </select>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria
            </label>
            <select
              className="input-field"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Valor Total */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valor Total (R$) *
            </label>
            <input
              className={`input-field ${errors.total_amount ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="0,00"
              type="number"
              step="0.01"
              min="0"
              value={formData.total_amount}
              onChange={(e) => handleInputChange('total_amount', parseFloat(e.target.value) || 0)}
            />
            {formData.total_amount > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {formatCurrency(formData.total_amount)}
              </p>
            )}
            {errors.total_amount && (
              <p className="text-red-600 text-sm mt-1">{errors.total_amount}</p>
            )}
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forma de Pagamento
            </label>
            <select
              className="input-field"
              value={formData.payment_method}
              onChange={(e) => handleInputChange('payment_method', e.target.value)}
            >
              {paymentMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Parcelas */}
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
            value={formData.installments}
            onChange={(e) => handleInputChange('installments', parseInt(e.target.value) || 1)}
          />
          {formData.installments > 1 && formData.total_amount > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              {formData.installments}x de {formatCurrency(formData.total_amount / formData.installments)}
            </p>
          )}
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex space-x-3 mt-6">
        <button
          className="btn-primary flex-1"
          onClick={handleConfirm}
          disabled={!formData.description.trim() || formData.total_amount <= 0}
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
      {(!formData.description.trim() || formData.total_amount <= 0) && (
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