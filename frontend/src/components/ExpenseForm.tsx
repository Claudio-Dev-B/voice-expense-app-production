import React, { useState } from "react";
import type { Expense } from "../types";

interface Props {
  expense: Expense;
  costCenters: string[];
  categories: string[];
  onConfirm: (expense: Expense) => void;
  onCancel: () => void;
}

const ExpenseForm: React.FC<Props> = ({ expense, costCenters, categories, onConfirm, onCancel }) => {
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
    total_amount: expense.total_amount || 0
  });

  const paymentMethods = [
    "Dinheiro", "Cartão Crédito", "Cartão Débito", 
    "PIX", "Transferência", "Boleto", "Outros"
  ];

  const handleConfirm = () => {
    // CORREÇÃO: Mapear de volta para o formato do backend antes de enviar
    const expenseToConfirm = {
      ...data,
      payment_method: mapSelectToPaymentMethod(data.payment_method)
    };
    onConfirm(expenseToConfirm);
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
              value={data.total_amount}
              onChange={(e) =>
                setData({ ...data, total_amount: parseFloat(e.target.value) || 0 })
              }
            />
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Número de Parcelas
          </label>
          <input
            className="input-field"
            placeholder="1"
            type="number"
            min="1"
            value={data.installments}
            onChange={(e) =>
              setData({ ...data, installments: parseInt(e.target.value) || 1 })
            }
          />
        </div>
      </div>

      <div className="flex space-x-3 mt-6">
        <button
          className="btn-primary flex-1"
          onClick={handleConfirm}
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
    </div>
  );
};

export default ExpenseForm;