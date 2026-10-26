export type AccountRole = "investor" | "seller" | "admin" | "super-admin";

export interface StaffAccount {
  id: string;
  fullName: string;
  preferredName: string;
  email: string;
  phone: string;
  role: Exclude<AccountRole, "investor">;
  city: string;
  truckId: string | null;
  detail: string;
}

export const staff: StaffAccount[] = [
  {
    id: "seller-a",
    fullName: "Arjun Nair",
    preferredName: "Arjun",
    email: "arjun@demo.foodoo365.com",
    phone: "+91 98470 66773",
    role: "seller",
    city: "Kochi",
    truckId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001",
    detail: "Sells at Marina Grill",
  },
  {
    id: "seller-b",
    fullName: "Shabeer Ali",
    preferredName: "Shabeer",
    email: "shabeer@demo.foodoo365.com",
    phone: "+91 98470 77884",
    role: "seller",
    city: "Kozhikode",
    truckId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002",
    detail: "Sells at Beachside Kitchen",
  },
  {
    id: "seller-c",
    fullName: "Lakshmi Pillai",
    preferredName: "Lakshmi",
    email: "lakshmi@demo.foodoo365.com",
    phone: "+91 98470 88995",
    role: "seller",
    city: "Thiruvananthapuram",
    truckId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0003",
    detail: "Sells at Shanghumugham Plates",
  },
  {
    id: "seller-d",
    fullName: "Joseph Varghese",
    preferredName: "Joseph",
    email: "joseph@demo.foodoo365.com",
    phone: "+91 98470 99006",
    role: "seller",
    city: "Kochi",
    truckId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0004",
    detail: "Sells at Fort Kochi Meals",
  },
  {
    id: "admin-meera",
    fullName: "Meera Krishnan",
    preferredName: "Meera",
    email: "meera@demo.foodoo365.com",
    phone: "+91 98470 10117",
    role: "admin",
    city: "Kochi",
    truckId: null,
    detail: "Company admin",
  },
  {
    id: "super-suresh",
    fullName: "Suresh Kumar",
    preferredName: "Suresh",
    email: "suresh@demo.foodoo365.com",
    phone: "+91 98470 21228",
    role: "super-admin",
    city: "Kochi",
    truckId: null,
    detail: "Super admin",
  },
];

export function staffById(id: string): StaffAccount | undefined {
  return staff.find((account) => account.id === id);
}

export function staffByEmail(email: string): StaffAccount | undefined {
  return staff.find((account) => account.email.toLowerCase() === email.toLowerCase());
}
