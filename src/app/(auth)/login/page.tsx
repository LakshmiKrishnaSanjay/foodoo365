import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense>
      <LoginPage searchParams={props.searchParams} />
    </Suspense>
  );
}

async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <section className="flex flex-col justify-between bg-sidebar px-8 py-10 text-sidebar-foreground lg:px-16 lg:py-14">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-sidebar-primary font-heading text-lg text-sidebar-primary-foreground">F</span>
          <span className="font-heading text-xl">Foodoo365</span>
        </div>
        <div className="max-w-xl py-12">
          <p className="text-xs tracking-[0.18em] text-sidebar-primary uppercase">Commercial return and social impact</p>
          <h2 className="mt-4 font-heading text-4xl leading-tight md:text-5xl">See the trucks, the earnings and the meals your investment supports.</h2>
          <p className="mt-4 text-sm leading-7 text-sidebar-foreground/75">A central kitchen prepares meals for four trucks. Profit follows the investment agreement. Twenty percent of eligible food sales is allocated to charity, and that allocation is tracked separately from meals distributed.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Demonstration environment · not actual company performance</p>
      </section>
      <section className="flex items-center justify-center bg-background px-6 py-12">
        <LoginForm reset={params.reset === "1"} />
      </section>
    </div>
  );
}
