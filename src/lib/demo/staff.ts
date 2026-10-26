export type AccountRole = "investor" | "seller" | "admin" | "super-admin";

export interface StaffAccount {
  id: string;
  fullName: string;
  preferredName: string;
  email: string;
  role: Exclude<AccountRole, "investor">;
  city: string;
  truckId: string | null;
  detail: string;
}

export const staff: StaffAccount[] = [
  {
    id: "seller-a",
    fullName: "Layla Hassan",
    preferredName: "Layla",
    email: "marina@demo.foodoo365.com",
    role: "seller",
    city: "Dubai",
    truckId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001",
    detail: "Sells at Marina Grill",
  },
  {
    id: "seller-b",
    fullName: "Omar Farooq",
    preferredName: "Omar",
    email: "beach@demo.foodoo365.com",
    role: "seller",
    city: "Dubai",
    truckId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002",
    detail: "Sells at Beachside Kitchen",
  },
  {
    id: "seller-c",
    fullName: "Noor Al Mansoori",
    preferredName: "Noor",
    email: "corniche@demo.foodoo365.com",
    role: "seller",
    city: "Abu Dhabi",
    truckId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0003",
    detail: "Sells at Corniche Plates",
  },
  {
    id: "seller-d",
    fullName: "Ravi Menon",
    preferredName: "Ravi",
    email: "majaz@demo.foodoo365.com",
    role: "seller",
    city: "Sharjah",
    truckId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0004",
    detail: "Sells at Majaz Meals",
  },
  {
    id: "admin-meera",
    fullName: "Meera Shah",
    preferredName: "Meera",
    email: "admin@demo.foodoo365.com",
    role: "admin",
    city: "Dubai",
    truckId: null,
    detail: "Company admin",
  },
  {
    id: "super-samir",
    fullName: "Samir Qureshi",
    preferredName: "Samir",
    email: "super@demo.foodoo365.com",
    role: "super-admin",
    city: "Dubai",
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
