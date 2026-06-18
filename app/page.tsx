import Link from "next/link";

export default function Home() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">GENBA 出張買取</h1>
      <Link href="/cases" className="block rounded bg-black text-white text-center py-3">
        案件一覧へ
      </Link>
    </main>
  );
}
