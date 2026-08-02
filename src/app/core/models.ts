export interface Branch {
  id: number;
  name: string;
  address?: string | null;
  is_active: boolean;
  color: string;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
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
  class_schedule_id?: number | null;
  attendance_date: string;
  notes?: string | null;
  student?: Student;
  branch?: Branch;
  class_schedule?: ClassSchedule;
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

export interface MonthlyReportTopStudent {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
}

export interface MonthlyReportTopSale {
  id: number;
  sale_date: string;
  total: number;
  notes?: string | null;
  branch?: { id: number; name: string } | null;
}

export interface MonthlyReportTopExpense {
  id: number;
  category: string;
  description?: string | null;
  amount: number;
  expense_date: string;
  branch?: { id: number; name: string } | null;
}

export interface MonthlyReportTopMembershipPayment {
  id: number;
  amount: number;
  payment_date: string;
  period_month: string;
  payment_method?: string | null;
  student?: MonthlyReportTopStudent | null;
}

export interface MonthlyReportTopAttendance {
  student_id: number;
  total: number;
  student?: MonthlyReportTopStudent | null;
}

export interface MonthlyReportTops {
  sales: MonthlyReportTopSale[];
  expenses: MonthlyReportTopExpense[];
  membership_payments: MonthlyReportTopMembershipPayment[];
  attendances_by_student: MonthlyReportTopAttendance[];
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
  tops: MonthlyReportTops;
}

export type ReportPeriodType = 'month' | 'quarter' | 'semester' | 'year';

export interface PeriodReportMonth {
  year: number;
  month: number;
  income: {
    membership_payments: number;
    sales: number;
    total: number;
  };
  expenses: { total: number };
  balance: number;
}

export interface PeriodReport {
  period: ReportPeriodType;
  year: number;
  month?: number | null;
  quarter?: number | null;
  semester?: number | null;
  from: string;
  to: string;
  label: string;
  income: {
    membership_payments: number;
    sales: number;
    total: number;
  };
  expenses: { total: number };
  balance: number;
  months: PeriodReportMonth[];
  tops: MonthlyReportTops | null;
}

export interface Instructor {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  color: string;
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
