import React from 'react';
import { Link } from '@inertiajs/react';
import { BarChart3, Bot, MapPinned, Users } from 'lucide-react';

const nav = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/destinations', label: 'Destinations', icon: MapPinned },
  { href: '/admin/imports', label: 'Imports', icon: Bot },
  { href: '/admin/users', label: 'Users', icon: Users },
];

export default function AdminLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-[#f5faf8]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-black/5 bg-white/85 p-4 shadow-sm lg:block">
        <div className="px-3 py-4">
          <div className="text-2xl font-extrabold tracking-normal text-[#1f7a4d]">Travs</div>
          <div className="text-sm text-slate-500">Bohol admin portal</div>
        </div>
        <nav className="mt-4 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#e9f7f2]"
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="lg:pl-64">
        <header className="border-b border-black/5 bg-white/75 px-6 py-5 backdrop-blur">
          <h1 className="text-2xl font-bold text-[#14211b]">{title}</h1>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
