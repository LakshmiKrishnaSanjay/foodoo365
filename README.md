# Foodoo365

Investor portal for four food trucks in Kerala, supplied by a central kitchen in Thiruvananthapuram. Figures, trucks, sales, charity and payouts come from generated seed data in the app. There is no database required to run the demonstration.

```bash
npm install
npm run dev
```

Open http://localhost:3000

Demonstration sign-in, password `demo-investor`:

- anjali@demo.foodoo365.com — trucks A and B
- thomas@demo.foodoo365.com — trucks B and C
- fathima@demo.foodoo365.com — trucks C and D

Sellers, admin and super admin use the same password: arjun@, shabeer@, lakshmi@, joseph@, meera@ and suresh@ at demo.foodoo365.com.

Each investor only sees the trucks in their seed agreements. Amounts are Indian rupees. Twenty percent of eligible sales is allocated to charity, and profit is what remains after that allocation and the truck's costs. GST collected for the authorities is excluded from eligible sales.

To load the same demonstration into Supabase, apply the migrations and then run `npm run seed:supabase`. See `scripts/seed-supabase.ts`.
