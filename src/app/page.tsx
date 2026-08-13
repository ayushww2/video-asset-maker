import { Suspense } from "react";
import StudioApp from "@/components/StudioApp";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-full max-w-md items-center justify-center p-8 text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <StudioApp />
    </Suspense>
  );
}
