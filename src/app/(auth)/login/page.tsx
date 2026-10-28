import { Suspense } from "react";
import Image from "next/image";
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
    <div className="grid h-dvh grid-rows-[30vh_minmax(0,1fr)] overflow-hidden lg:grid-cols-[1.28fr_0.82fr] lg:grid-rows-1">
      <section className="relative min-h-0 overflow-hidden">
        <Image
          src="/foodoo-truck-wide.jpg"
          alt="A Foodoo365 cook handing a plate of food from a black and yellow truck"
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover object-[center_42%]"
        />
        <div className="absolute top-5 left-5 flex items-center gap-3 text-white drop-shadow-md lg:top-8 lg:left-8">
          <span className="grid size-10 place-items-center rounded-lg bg-primary font-heading text-lg text-primary-foreground">F</span>
          <span className="font-heading text-xl">Foodoo365</span>
        </div>
      </section>
      <section className="flex min-h-0 overflow-hidden bg-background px-6 py-5 lg:py-8">
        <LoginForm reset={params.reset === "1"} />
      </section>
    </div>
  );
}
