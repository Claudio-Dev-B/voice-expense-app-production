// services/api.ts
// ✅ URL FIXA PARA PRODUÇÃO
const API_BASE_URL = 'https://voice-expense-app-production-production.up.railway.app';

// ✅ IMPORTS CORRETOS - APENAS O NECESSÁRIO
import type { 
  Expense, 
  TranscriptionResponse, 
  User,
  SharedAccount,
  AccountMember,
  AccountInvite,
  InviteShareData,
  CreateInviteRequest,
  CreateAccountRequest,
  AuthResponse,
  PendingInvite
} from '../types';

// Interface para o payload do onboarding (compatível com backend)
export interface OnboardingPayload {
  user_id: number;
  user_type: 'pessoal' | 'empresarial' | 'pessoal_empresarial';
  cost_centers: string[];
  categories: string[];
}

// Helper function para obter token de autenticação
const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

// Helper function para headers com autenticação
const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

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

  // ✅ MÉTODO ADICIONADO - Google OAuth
  async googleAuth(authData: {
    access_token: string;
    email: string;
    name: string;
    google_id: string;
    picture?: string;
  }): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authData),
    });
    
    if (!response.ok) {
      throw new Error('Falha na autenticação com Google');
    }
    
    return response.json();
  },

  async getUserByEmail(email: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/user/email/${encodeURIComponent(email)}`);
    
    if (!response.ok) {
      throw new Error('Usuário não encontrado');
    }
    
    return response.json();
  },

  async getUserInfo(userId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/user/${userId}`);
    
    if (!response.ok) {
      throw new Error('Falha ao carregar informações do usuário');
    }
    
    return response.json();
  },

  async completeOnboarding(onboardingData: OnboardingPayload): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(onboardingData),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao completar onboarding');
    }
    
    return response.json();
  },

  // ===== SISTEMA DE COMPARTILHAMENTO =====

  async createSharedAccount(accountData: CreateAccountRequest): Promise<{ 
    status: string; 
    message: string;
    account: SharedAccount 
  }> {
    const response = await fetch(`${API_BASE_URL}/api/accounts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(accountData),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao criar conta compartilhada');
    }
    
    return response.json();
  },

  async getUserAccounts(): Promise<{ accounts: SharedAccount[] }> {
    const response = await fetch(`${API_BASE_URL}/api/users/accounts`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao carregar contas do usuário');
    }
    
    return response.json();
  },

  async getAccountDetails(accountId: number): Promise<{
    account: {
      id: number;
      name: string;
      owner_id: number;
      created_at: string;
      total_expenses: number;
      expenses_count: number;
      members_count: number;
    };
    members: AccountMember[];
    statistics: {
      cost_centers_used: string[];
      categories_used: string[];
      avg_expense_amount: number;
    };
  }> {
    const response = await fetch(`${API_BASE_URL}/api/accounts/${accountId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao carregar detalhes da conta');
    }
    
    return response.json();
  },

  async updateAccount(accountId: number, accountData: { name: string }): Promise<{ 
    status: string; 
    message: string 
  }> {
    const response = await fetch(`${API_BASE_URL}/api/accounts/${accountId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(accountData),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao atualizar conta');
    }
    
    return response.json();
  },

  async deleteAccount(accountId: number): Promise<{ 
    status: string; 
    message: string 
  }> {
    const response = await fetch(`${API_BASE_URL}/api/accounts/${accountId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao excluir conta');
    }
    
    return response.json();
  },

  async createInvite(accountId: number, inviteData: CreateInviteRequest): Promise<{
    status: string;
    message: string;
    invite: AccountInvite & InviteShareData;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/accounts/${accountId}/invites`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(inviteData),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao criar convite');
    }
    
    return response.json();
  },

  async getInviteInfo(token: string): Promise<{
    invite: {
      id: number;
      email: string;
      role: string;
      expires_at: string;
      account_name: string;
      inviter_name: string;
      inviter_email: string;
    };
  }> {
    const response = await fetch(`${API_BASE_URL}/api/invites/${token}`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error('Convite não encontrado ou expirado');
    }
    
    return response.json();
  },

  async getInviteShareInfo(token: string): Promise<{
    share_data: InviteShareData;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/invites/${token}/share-info`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error('Falha ao carregar informações do convite');
    }
    
    return response.json();
  },

  async acceptInvite(token: string): Promise<{
    status: string;
    message: string;
    account_id: number;
    account_name: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/invites/${token}/accept`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao aceitar convite');
    }
    
    return response.json();
  },

  async cancelInvite(inviteId: number): Promise<{
    status: string;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/invites/${inviteId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao cancelar convite');
    }
    
    return response.json();
  },

  async getAccountInvites(accountId: number): Promise<{
    invites: AccountInvite[];
  }> {
    const response = await fetch(`${API_BASE_URL}/api/accounts/${accountId}/invites`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao carregar convites da conta');
    }
    
    return response.json();
  },

  async getUserPendingInvites(): Promise<{
    pending_invites: PendingInvite[];
  }> {
    const response = await fetch(`${API_BASE_URL}/api/users/pending-invites`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao carregar convites pendentes');
    }
    
    return response.json();
  },

  async updateMemberRole(accountId: number, memberUserId: number, roleData: { role: string }): Promise<{
    status: string;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/accounts/${accountId}/members/${memberUserId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(roleData),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao atualizar role do membro');
    }
    
    return response.json();
  },

  async removeMember(accountId: number, memberUserId: number): Promise<{
    status: string;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/accounts/${accountId}/members/${memberUserId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao remover membro');
    }
    
    return response.json();
  },

  async leaveAccount(accountId: number): Promise<{
    status: string;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/accounts/${accountId}/leave`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Falha ao sair da conta');
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

  async getExpenses(
    userId: number, 
    sharedAccountId?: number
  ): Promise<Expense[]> {
    const params = new URLSearchParams();
    params.append('user_id', userId.toString());
    if (sharedAccountId) {
      params.append('shared_account_id', sharedAccountId.toString());
    }
    
    const response = await fetch(`${API_BASE_URL}/api/expenses?${params}`);
    
    if (!response.ok) {
      throw new Error('Falha ao carregar despesas');
    }
    
    return response.json();
  },

  async saveExpense(expenseData: {
    description: string;
    total_amount: number;
    payment_method: string;
    user_id: number;
    cost_center: string;
    category: string;
    installments?: any[];
    shared_account_id?: number;
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

  async updateExpense(expenseId: number, expenseData: Partial<Expense>): Promise<Expense> {
    const backendData = {
      description: expenseData.description,
      total_amount: expenseData.total_amount,
      payment_method: expenseData.payment_method,
      cost_center: expenseData.cost_center,
      category: expenseData.category,
      shared_account_id: expenseData.shared_account_id
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
    endDate?: string,
    sharedAccountId?: number
  ): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (sharedAccountId) params.append('shared_account_id', sharedAccountId.toString());
    
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
    endDate?: string,
    sharedAccountId?: number
  ): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (sharedAccountId) params.append('shared_account_id', sharedAccountId.toString());
    
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
    endDate?: string,
    sharedAccountId?: number
  ): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (sharedAccountId) params.append('shared_account_id', sharedAccountId.toString());
    
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
    costCenter?: string,
    sharedAccountId?: number
  ): Promise<Blob> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (costCenter) params.append('cost_center', costCenter);
    if (sharedAccountId) params.append('shared_account_id', sharedAccountId.toString());
    
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