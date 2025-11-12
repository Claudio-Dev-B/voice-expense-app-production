// components/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface FinancialOverview {
  period: {
    start_date: string;
    end_date: string;
  };
  monthly_expenses: {
    total: number;
    transactions_count: number;
  };
  cash_outflow: {
    total: number;
    installments_count: number;
  };
  future_projection: Array<{
    month: string;
    amount: number;
    installments_count: number;
  }>;
  cost_centers: Array<{
    cost_center: string;
    amount: number;
  }>;
}

interface CostCenterDetail {
  cost_center: string;
  period: {
    start_date: string;
    end_date: string;
  };
  total_amount: number;
  expenses_count: number;
  categories: Array<{
    category: string;
    amount: number;
  }>;
  expenses: Array<any>;
}

interface MonthlyExpenses {
  period: {
    start_date: string;
    end_date: string;
  };
  expenses: Array<any>;
  total_count: number;
  total_amount: number;
}

interface DashboardProps {
  userId: number;
  sharedAccountId?: number;
}

const Dashboard: React.FC<DashboardProps> = ({ userId, sharedAccountId }) => {
  const [financialOverview, setFinancialOverview] = useState<FinancialOverview | null>(null);
  const [costCenterDetails, setCostCenterDetails] = useState<{[key: string]: CostCenterDetail}>({});
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpenses | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [userId, dateFilter, sharedAccountId]);

  useEffect(() => {
    if (financialOverview?.cost_centers && activeTab === 'costcenters') {
      loadAllCostCenterDetails();
    }
  }, [financialOverview, activeTab, dateFilter, sharedAccountId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewData, monthlyData] = await Promise.all([
        api.getFinancialOverview(userId, dateFilter.startDate, dateFilter.endDate, sharedAccountId),
        api.getMonthlyExpenses(userId, dateFilter.startDate, dateFilter.endDate, sharedAccountId)
      ]);

      setFinancialOverview(overviewData);
      setMonthlyExpenses(monthlyData);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllCostCenterDetails = async () => {
    if (!financialOverview?.cost_centers) return;

    try {
      const details: {[key: string]: CostCenterDetail} = {};
      
      for (const costCenter of financialOverview.cost_centers) {
        try {
          const detail = await api.getCostCenterDetail(
            userId, 
            costCenter.cost_center, 
            dateFilter.startDate, 
            dateFilter.endDate,
            sharedAccountId
          );
          details[costCenter.cost_center] = detail;
        } catch (error) {
          console.error(`Erro ao carregar detalhes de ${costCenter.cost_center}:`, error);
          details[costCenter.cost_center] = {
            cost_center: costCenter.cost_center,
            period: { start_date: dateFilter.startDate, end_date: dateFilter.endDate },
            total_amount: costCenter.amount,
            expenses_count: 0,
            categories: [],
            expenses: []
          };
        }
      }
      
      setCostCenterDetails(details);
    } catch (error) {
      console.error('Erro ao carregar detalhes dos centros de custo:', error);
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      const blob = await api.exportExpenses(
        userId, 
        dateFilter.startDate, 
        dateFilter.endDate,
        undefined,
        sharedAccountId
      );
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      const today = new Date().toISOString().split('T')[0];
      const accountSuffix = sharedAccountId ? `_conta_${sharedAccountId}` : '';
      a.download = `despesas_${today}${accountSuffix}.csv`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar dados. Tente novamente.');
    } finally {
      setExportLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });
  };

  // Componente para renderizar categorias de um centro de custo
  const CostCenterCategories = ({ categories, totalAmount }: { categories: Array<{category: string, amount: number}>, totalAmount: number }) => {
    if (!categories || categories.length === 0) {
      return (
        <div className="text-center text-gray-500 py-4 text-sm">
          Nenhuma categoria com despesas neste período
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <h5 className="font-medium text-gray-700 text-sm mb-3">Distribuição por Categoria:</h5>
        {categories.map((category, index) => {
          const percentage = totalAmount > 0 ? (category.amount / totalAmount) * 100 : 0;
          const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-indigo-500', 'bg-pink-500'];
          
          return (
            <div key={category.category} className="flex items-center justify-between">
              <div className="flex items-center flex-1 min-w-0">
                <div className={`w-3 h-3 ${colors[index % colors.length]} rounded-full mr-3 flex-shrink-0`}></div>
                <span className="font-medium text-gray-900 text-sm truncate" title={category.category}>
                  {category.category}
                </span>
              </div>
              <div className="flex items-center space-x-3 flex-shrink-0">
                <div className="w-16 sm:w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${colors[index % colors.length]}`}
                    style={{ width: `${Math.max(percentage, 5)}%` }}
                  ></div>
                </div>
                <span className="font-semibold text-gray-900 text-sm w-16 text-right">
                  {formatCurrency(category.amount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!financialOverview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-500 text-2xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Nenhum dado encontrado</h2>
          <p className="text-gray-600">
            {sharedAccountId 
              ? 'Nenhuma despesa encontrada para esta conta compartilhada.'
              : 'Registre algumas despesas para ver o dashboard.'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-2 sm:px-4 lg:px-8">
      {/* Cabeçalho com Filtros */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard Financeiro</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              {sharedAccountId ? 'Visão da conta compartilhada' : 'Visão completa das suas finanças'}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              {exportLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exportando...
                </>
              ) : (
                '📊 Exportar Excel'
              )}
            </button>
          </div>
        </div>

        {/* Indicador de conta compartilhada */}
        {sharedAccountId && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-sm">🏢</span>
              </div>
              <div>
                <p className="font-semibold text-blue-900 text-sm">
                  Visualizando dados da conta compartilhada
                </p>
                <p className="text-xs text-blue-600">
                  Filtro aplicado - mostrando apenas despesas desta conta
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filtros de Data */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter(prev => ({...prev, startDate: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter(prev => ({...prev, endDate: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadDashboardData}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center justify-center"
              >
                <span className="mr-2">🔄</span>
                Aplicar Filtros
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Período: {formatDate(dateFilter.startDate)} - {formatDate(dateFilter.endDate)}
            {sharedAccountId && ' • Conta compartilhada'}
          </div>
        </div>
      </div>

      {/* Resto do componente Dashboard permanece igual... */}
      {/* (O restante do código do Dashboard permanece inalterado, apenas já está integrado com sharedAccountId) */}
      
      {/* Abas Principais */}
      <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 sm:flex-none py-4 px-4 sm:px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('costcenters')}
              className={`flex-1 sm:flex-none py-4 px-4 sm:px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'costcenters'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🏢 Por Centro de Custo
            </button>
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'overview' && financialOverview && (
            <div className="space-y-6">
              {/* Cards de Resumo Financeiro */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white text-lg">💰</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-700">Gastos do Período</p>
                      <p className="text-xl font-bold text-blue-900">
                        {formatCurrency(financialOverview.monthly_expenses.total)}
                      </p>
                      <p className="text-xs text-blue-600">
                        {financialOverview.monthly_expenses.transactions_count} transações
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white text-lg">💸</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-700">Saída do Caixa</p>
                      <p className="text-xl font-bold text-green-900">
                        {formatCurrency(financialOverview.cash_outflow.total)}
                      </p>
                      <p className="text-xs text-green-600">
                        {financialOverview.cash_outflow.installments_count} parcelas
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-white text-lg">📈</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-700">Próximo Mês</p>
                      <p className="text-xl font-bold text-purple-900">
                        {financialOverview.future_projection[0] ? 
                         formatCurrency(financialOverview.future_projection[0].amount) : 
                         formatCurrency(0)}
                      </p>
                      <p className="text-xs text-purple-600">
                        {financialOverview.future_projection[0]?.installments_count || 0} parcelas
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ... Restante do dashboard permanece igual ... */}
              
            </div>
          )}

          {/* ... Resto do código do dashboard ... */}
          
        </div>
      </div>
    </div>
  );
};

export default Dashboard;