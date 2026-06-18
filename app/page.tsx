import Link from "next/link";

export default function Home() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">GENBA 出張買取</h1>
      <Link href="/cases" className="block rounded bg-black text-white text-center py-3">
        案件一覧へ
      </Link>
      <Link href="/products" className="block rounded bg-gray-200 text-center py-3">
        在庫一覧へ
      </Link>
      <Link href="/fees" className="block rounded bg-gray-200 text-center py-3">
        フィー台帳へ
      </Link>
      <div className="pt-2 text-sm text-gray-500">設定</div>
      <div className="flex gap-2 text-sm">
        <Link href="/settings/tk" className="flex-1 rounded bg-gray-100 text-center py-2">
          TK
        </Link>
        <Link href="/settings/ambassadors" className="flex-1 rounded bg-gray-100 text-center py-2">
          アンバサダー
        </Link>
        <Link href="/settings/fees" className="flex-1 rounded bg-gray-100 text-center py-2">
          フィー率
        </Link>
      </div>
    </main>
  );
}
