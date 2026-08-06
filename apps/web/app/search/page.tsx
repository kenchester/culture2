import Link from "next/link";
import { SearchForm } from "@/app/search/search-form";

export default function SearchPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-2xl text-ink">Find your network</h1>
        <SearchForm />
      </div>
      <Link href="/suggest-network" className="text-center text-sm text-muted hover:text-primary">
        Can&apos;t find what you&apos;re looking for? Suggest a network.
      </Link>
    </div>
  );
}
