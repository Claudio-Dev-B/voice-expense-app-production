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
  total_amount: number; // CORREÇÃO: mudar de 'amount' para 'total_amount'
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