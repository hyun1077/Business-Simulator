export type SystemRole = "SUPER_ADMIN" | "OWNER" | "MANAGER" | "STAFF";

export type DashboardKpi = {
  revenue: number;
  expense: number;
  laborCost: number;
  profit: number;
  laborRatio: number;
};

export type StoreSummary = {
  id: string;
  name: string;
  code: string;
  businessType: string;
  monthlyRevenue: number;
  monthlyExpense: number;
  monthlyLaborCost: number;
};
