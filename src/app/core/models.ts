export interface Branch {
  id: number;
  name: string;
  address?: string | null;
  is_active: boolean;
}

export interface Student {
  id: number;
  first_name: string;
  last_name: string;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  enrolled_at?: string | null;
  is_active: boolean;
  notes?: string | null;
}

export interface MembershipPayment {
  id: number;
  student_id: number;
  amount: number | string;
  payment_date: string;
  period_month: string;
  payment_method?: string | null;
  notes?: string | null;
  student?: Student;
}

export interface Attendance {
  id: number;
  student_id: number;
  branch_id: number;
  attendance_date: string;
  notes?: string | null;
  student?: Student;
  branch?: Branch;
}

export interface Product {
  id: number;
  name: string;
  sku?: string | null;
  description?: string | null;
  unit_price: number | string;
  is_active: boolean;
  stocks?: ProductStock[];
}

export interface ProductStock {
  id: number;
  product_id: number;
  branch_id: number;
  quantity: number;
  product?: Product;
  branch?: Branch;
}

export interface SaleItem {
  id?: number;
  product_id: number;
  quantity: number;
  unit_price: number | string;
  subtotal: number | string;
  product?: Product;
}

export interface Sale {
  id: number;
  branch_id: number;
  sale_date: string;
  total: number | string;
  notes?: string | null;
  branch?: Branch;
  items?: SaleItem[];
}

export interface Expense {
  id: number;
  category: string;
  description?: string | null;
  amount: number | string;
  expense_date: string;
  branch_id?: number | null;
  notes?: string | null;
  branch?: Branch;
}

export interface MonthlyReport {
  year: number;
  month: number;
  from: string;
  to: string;
  income: {
    membership_payments: number;
    sales: number;
    total: number;
  };
  expenses: { total: number };
  balance: number;
}

export interface Instructor {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  notes?: string | null;
}

export interface ClassSchedule {
  id: number;
  instructor_id: number;
  branch_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  notes?: string | null;
  instructor?: Instructor;
  branch?: Branch;
}
