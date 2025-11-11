import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface CostCenterCategoriesProps {
  userId: number;
  costCenterName: string;
  startDate?: string;
  endDate?: string;
}

interface CategoryData {
  category: string;
  amount: number;
}

const CostCenterCategories: React.FC<CostCenterCategoriesProps> = ({
  userId,
  costCenterName,
  startDate,
  endDate
}) => {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCostCenterDetail();
  }, [userId, costCenterName, startDate, endDate]);

  const loadCostCenterDetail = async () => {
    try {
      const detail = await api.getCostCenterDetail(
        userId, 
        costCenterName, 
        startDate, 
        endDate
      );
      setCategories(detail.categories || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        Nenhuma despesa encontrada neste período
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h5 className="font-medium text-gray-700 text-sm">Distribuição por Categoria:</h5>
      {categories.map((category, index) => {
        const total = categories.reduce((sum, cat) => sum + cat.amount, 0);
        const percentage = total > 0 ? (category.amount / total) * 100 : 0;
        const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500'];
        
        return (
          <div key={category.category} className="flex items-center justify-between">
            <div className="flex items-center flex-1">
              <div className={`w-3 h-3 ${colors[index % colors.length]} rounded-full mr-3`}></div>
              <span className="font-medium text-gray-900 text-sm">{category.category}</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${colors[index % colors.length]}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <span className="font-semibold text-gray-900 text-sm w-20 text-right">
                {formatCurrency(category.amount)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CostCenterCategories;