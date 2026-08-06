import Link from "next/link";
import { SearchForm } from "@/app/search/search-form";

export default function SearchPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Find your network</h1>
      <SearchForm />
      <Link href="/suggest-network" className="text-sm text-zinc-500 underline">
        Can&apos;t find what you&apos;re looking for? Suggest a network.
      </Link>
    </div>
  );
}
