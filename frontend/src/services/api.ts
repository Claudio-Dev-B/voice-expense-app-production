const API_BASE_URL = 'https://voice-expense-app-production-production.up.railway.app';

// Importar interfaces do types.ts
import type { 
  Expense, 
  Installment, 
  TranscriptionResponse, 
  User, 
  OnboardingData 
} from '../types';

// Interface para o payload do onboarding (compatível com backend)
export interface OnboardingPayload {
  user_id: number;
  user_type: 'pessoal' | 'empresarial' | 'pessoal_empresarial';
  cost_centers: string[];
  categories: string[];
}

export const api = {
  // ===== AUTENTICAÇÃO E USUÁRIO =====
  
  async createOrUpdateUser(userData: { email: string; name: string; google_id?: string }): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao criar/atualizar usuário');
    }
    
    return response.json();
  },

  // ===== PROCESSAMENTO DE ÁUDIO =====

  async transcribeAudio(audioBlob: Blob, userId: number): Promise<TranscriptionResponse> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/audio?user_id=${userId}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorDetail;
        } catch {
          errorDetail = await response.text();
        }
        throw new Error(`Falha na transcrição: ${errorDetail}`);
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro de rede ao conectar com o servidor');
    }
  },

  async testAudioProcessing(text: string, userId?: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/audio/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, user_id: userId }),
    });
    
    if (!response.ok) {
      throw new Error('Falha no teste de processamento');
    }
    
    return response.json();
  },

  // ===== GERENCIAMENTO DE DESPESAS =====

  async getExpenses(userId: number): Promise<Expense[]> {
    const response = await fetch(`${API_BASE_URL}/api/expenses?user_id=${userId}`);
    
    if (!response.ok) {
      throw new Error('Falha ao carregar despesas');
    }
    
    return response.json();
  },

  // CORREÇÃO: Usar nomes em vez de IDs
  async saveExpense(expenseData: {
    description: string;
    total_amount: number;
    payment_method: string;
    user_id: number;
    cost_center: string; // CORREÇÃO: Mudar de cost_center_id para cost_center
    category: string; // CORREÇÃO: Mudar de category_id para category
    installments?: any[];
  }): Promise<Expense> {
    const response = await fetch(`${API_BASE_URL}/api/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expenseData),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao salvar despesa');
    }
    
    return response.json();
  },

  // CORREÇÃO: Usar nomes em vez de IDs
  async updateExpense(expenseId: number, expenseData: Partial<Expense>): Promise<Expense> {
    const backendData = {
      description: expenseData.description,
      total_amount: expenseData.total_amount,
      payment_method: expenseData.payment_method,
      cost_center: expenseData.cost_center, // CORREÇÃO: Enviar nome
      category: expenseData.category // CORREÇÃO: Enviar nome
    };

    const response = await fetch(`${API_BASE_URL}/api/expenses/${expenseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendData),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao atualizar despesa');
    }
    
    return response.json();
  },

  async deleteExpense(expenseId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/expenses/${expenseId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Falha ao deletar despesa');
    }
  },

  // ===== DASHBOARD LEGADO (COMPATIBILIDADE) =====

  async getDashboardSummary(userId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/summary/${userId}`);
    
    if (!response.ok) {
      throw new Error('Falha ao carregar resumo do dashboard');
    }
    
    return response.json();
  },

  async getExpensesByCategory(userId: number): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/expenses-by-category/${userId}`);
    
    if (!response.ok) {
      throw new Error('Falha ao carregar despesas por categoria');
    }
    
    return response.json();
  },

  async getExpensesByCostCenter(userId: number): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/expenses-by-cost-center/${userId}`);
    
    if (!response.ok) {
      throw new Error('Falha ao carregar despesas por centro de custo');
    }
    
    return response.json();
  },

  async getMonthlyTrend(userId: number): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/dashboard/monthly-trend/${userId}`);
    
    if (!response.ok) {
      throw new Error('Falha ao carregar tendência mensal');
    }
    
    return response.json();
  },

  async getRecentExpenses(userId: number): Promise<Expense[]> {
    const response = await fetch(`${API_BASE_URL}/api/expenses/recent/${userId}`);
    
    if (!response.ok) {
      throw new Error('Falha ao carregar despesas recentes');
    }
    
    return response.json();
  },

  // ===== NOVOS ENDPOINTS FINANCEIROS AVANÇADOS =====

  async getFinancialOverview(
    userId: number, 
    startDate?: string, 
    endDate?: string
  ): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const response = await fetch(
      `${API_BASE_URL}/api/dashboard/financial-overview/${userId}?${params}`
    );
    
    if (!response.ok) {
      throw new Error('Falha ao carregar visão financeira');
    }
    
    return response.json();
  },

  async getCostCenterDetail(
    userId: number, 
    costCenterName: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const response = await fetch(
      `${API_BASE_URL}/api/dashboard/cost-center-detail/${userId}/${encodeURIComponent(costCenterName)}?${params}`
    );
    
    if (!response.ok) {
      throw new Error('Falha ao carregar detalhes do centro de custo');
    }
    
    return response.json();
  },

  async getMonthlyExpenses(
    userId: number, 
    startDate?: string, 
    endDate?: string
  ): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const response = await fetch(
      `${API_BASE_URL}/api/dashboard/monthly-expenses/${userId}?${params}`
    );
    
    if (!response.ok) {
      throw new Error('Falha ao carregar despesas mensais');
    }
    
    return response.json();
  },

  // ===== EXPORTAÇÃO DE DADOS =====

  async exportExpenses(
    userId: number,
    startDate?: string,
    endDate?: string,
    costCenter?: string
  ): Promise<Blob> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (costCenter) params.append('cost_center', costCenter);
    
    const response = await fetch(
      `${API_BASE_URL}/api/export/expenses/${userId}?${params}`
    );
    
    if (!response.ok) {
      throw new Error('Falha ao exportar despesas');
    }
    
    return response.blob();
  },

  // ===== DEBUG E DIAGNÓSTICO =====

  async debugUserSetup(userId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/debug/user/${userId}/setup`);
    
    if (!response.ok) {
      throw new Error('Falha no debug do usuário');
    }
    
    return response.json();
  },

  async healthCheck(): Promise<{ status: string; service: string }> {
    const response = await fetch(`${API_BASE_URL}/health`);
    
    if (!response.ok) {
      throw new Error('Servidor não está respondendo');
    }
    
    return response.json();
  }
};