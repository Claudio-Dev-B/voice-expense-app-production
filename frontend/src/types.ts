export interface Expense {
  id?: number;
  text: string;
  description: string;
  category: string;
  total_amount: number;
  payment_method: string;
  installments: number;
  created_at: string;
  cost_center: string;
  cost_center_id?: number;
  category_id?: number;
  shared_account_id?: number; // 👈 NOVO CAMPO
  shared_account_name?: string; // 👈 NOVO CAMPO
}

export interface Installment {
  id?: number;
  expense_id?: number;
  amount: number;
  due_date: string;
  status: string;
  installment_number: number;
}

export interface TranscriptionResponse {
  text: string;
  description: string;
  total_amount: number;
  expense_id: number;
  category: string;
  payment_method: string;
  installments: any[];
  cost_center: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  user_type: string;
  onboarding_completed: boolean;
  cost_centers?: Array<{ id: number; name: string }>;
  categories?: Array<{ id: number; name: string }>;
}

export interface OnboardingData {
  userType: 'pessoal' | 'empresarial' | 'pessoal_empresarial';
  costCenters: string[];
  categories: string[];
}

// 👇 NOVAS INTERFACES PARA SISTEMA DE COMPARTILHAMENTO

export interface SharedAccount {
  id: number;
  name: string;
  role: string;
  is_owner: boolean;
  member_count: number;
  expenses_count: number;
  total_expenses: number;
  created_at: string;
}

export interface AccountMember {
  user_id: number;
  name: string;
  email: string;
  role: string;
  joined_at: string;
  is_owner: boolean;
}

export interface AccountInvite {
  id: number;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  inviter_name: string;
  accepted_at?: string;
  accepted_by_name?: string;
  token?: string;
}

export interface InviteShareData {
  invite_url: string;
  token: string;
  account_name: string;
  inviter_name: string;
  inviter_email: string;
  expires_at: string;
  share_text: string;
  share_text_short: string;
  qr_data: string;
  created_at: string;
  days_remaining: number;
}

export interface CreateInviteRequest {
  email: string;
  role: 'viewer' | 'member' | 'admin';
}

export interface CreateAccountRequest {
  name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    name: string;
    picture?: string;
    onboarding_completed: boolean;
    user_type: string;
  };
}

export interface PendingInvite {
  id: number;
  account_name: string;
  inviter_name: string;
  created_at: string;
  expires_at: string;
  token: string;
}