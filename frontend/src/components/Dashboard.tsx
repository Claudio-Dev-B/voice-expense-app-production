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

interface DashboardProps {
  userId: number;
  sharedAccountId?: number;
}

const Dashboard: React.FC<DashboardProps> = ({ userId, sharedAccountId }) => {
  const [financialOverview, setFinancialOverview] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [userId, dateFilter, sharedAccountId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const overviewData = await api.getFinancialOverview(
        userId, 
        dateFilter.startDate, 
        dateFilter.endDate, 
        sharedAccountId
      );

      setFinancialOverview(overviewData);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
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

      {/* Cards de Resumo Financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
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

      {/* Gráfico de Centros de Custo */}
      <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição por Centro de Custo</h3>
        <div className="space-y-3">
          {financialOverview.cost_centers.map((item, index) => {
            const total = financialOverview.monthly_expenses.total;
            const percentage = total > 0 ? (item.amount / total) * 100 : 0;
            const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500'];
            
            return (
              <div key={item.cost_center} className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  <div className={`w-3 h-3 ${colors[index % colors.length]} rounded-full mr-3 flex-shrink-0`}></div>
                  <span className="font-medium text-gray-900 text-sm truncate" title={item.cost_center}>
                    {item.cost_center}
                  </span>
                </div>
                <div className="flex items-center space-x-3 flex-shrink-0">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${colors[index % colors.length]}`}
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    ></div>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm w-20 text-right">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;