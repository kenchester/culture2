import Link from "next/link";
import { SearchForm } from "@/app/search/search-form";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold">Find your diaspora network</h1>
        <p className="text-zinc-600">
          CultureMesh connects people by where they&apos;re from and where
          they live now. Search a language or place of origin and a
          location to find your network — or launch a new one if it
          doesn&apos;t exist yet.
        </p>
      </div>

      <div className="w-full max-w-sm text-left">
        <SearchForm />
      </div>

      <Link href="/suggest-network" className="text-sm text-zinc-500 underline">
        Can&apos;t find what you&apos;re looking for? Suggest a network.
      </Link>
    </div>
  );
}
