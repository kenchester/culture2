import { SearchForm } from "@/app/search/search-form";

export default function SearchPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Find your network</h1>
      <SearchForm />
    </div>
  );
}
