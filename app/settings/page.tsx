import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  const links = [
    { href: "/settings/tk", label: "TK（総代理店）" },
    { href: "/settings/ambassadors", label: "アンバサダー" },
    { href: "/settings/fees", label: "フィー率" },
    { href: "/fees", label: "フィー台帳" },
  ];
  return (
    <main>
      <AppHeader title="設定" showLogo={false} />
      <section className="px-5 pt-6 space-y-3">
        {links.map((l) => (
          <Card key={l.href} href={l.href}>
            <span className="text-sm font-medium">{l.label}</span>
          </Card>
        ))}
      </section>
    </main>
  );
}
