import type { Fils } from "@/lib/money";
import type { ExpenseFact, PeriodAdjustment, SaleFact, CogsFact, InvestorEarningResult, TruckProfitResult } from "@/lib/finance/profit-engine";
import type { InventoryMovement } from "@/lib/finance/inventory";

export interface Investor {
  id: string;
  fullName: string;
  preferredName: string;
  email: string;
  phone: string;
  city: string;
  joinedOn: string;
  /** Masked PAN, as shown to the investor. */
  pan: string;
}

export interface Truck {
  id: string;
  code: string;
  name: string;
  location: string;
  district: string;
  latitude: number;
  longitude: number;
  fssai: string;
  gstin: string;
  status: "active" | "maintenance" | "inactive";
  statusNote: string;
  reserveBps: number;
  baseMeals: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unitPrice: Fils;
  unitCost: Fils;
}

export interface Investment {
  id: string;
  investorId: string;
  truckId: string;
  investedOn: string;
  amount: Fils;
  ownershipBps: number | null;
  entitlementBps: number;
  status: "active" | "closed" | "pending";
  agreementRef: string;
  lossCarryforward: boolean;
  notes: string;
}

export interface AccountingPeriod {
  id: string;
  truckId: string;
  label: string;
  start: string;
  end: string;
  status: "open" | "finalized";
  finalizedOn: string | null;
}

export interface ProfitSnapshot {
  periodId: string;
  truckId: string;
  distributableBeforeAdjustments: Fils;
  distributableProfit: Fils;
  storedOn: string;
  note: string;
}

export interface Payout {
  id: string;
  investorId: string;
  investmentId: string;
  truckId: string;
  periodId: string;
  amount: Fils;
  date: string;
  status: "paid" | "approved";
  reference: string;
  note: string;
}

export interface CharityUse {
  id: string;
  truckId: string;
  date: string;
  status: "sponsored" | "prepared" | "distributed";
  meals: number;
  amount: Fils;
  reference: string;
  note: string;
}

export interface PortalNotification {
  id: string;
  investorId: string;
  title: string;
  body: string;
  category: "payout" | "statement" | "operations" | "charity";
  createdOn: string;
  href: string;
  unread: boolean;
}

export interface World {
  investors: Investor[];
  trucks: Truck[];
  products: Product[];
  investments: Investment[];
  sales: SaleFact[];
  expenses: ExpenseFact[];
  cogs: CogsFact[];
  movements: InventoryMovement[];
  adjustments: PeriodAdjustment[];
  periods: AccountingPeriod[];
  snapshots: ProfitSnapshot[];
  profits: TruckProfitResult[];
  earnings: InvestorEarningResult[];
  payouts: Payout[];
  charityUses: CharityUse[];
  notifications: PortalNotification[];
  entitlementTotals: Record<string, number>;
}
