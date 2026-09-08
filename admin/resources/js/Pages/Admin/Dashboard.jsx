import React from 'react';
import AdminLayout from '../../Layouts/AdminLayout';
import { Bot, MapPinned, MessageSquareWarning, Users } from 'lucide-react';

const cards = [
  ['users', 'Users', Users],
  ['publishedDestinations', 'Published destinations', MapPinned],
  ['pendingImports', 'Pending imports', Bot],
  ['pendingReviews', 'Reviews to moderate', MessageSquareWarning],
];

export default function Dashboard({ stats }) {
  return (
    <AdminLayout title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([key, label, Icon]) => (
          <section key={key} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-extrabold text-[#14211b]">{stats[key]}</p>
              </div>
              <div className="rounded-lg bg-[#e9f7f2] p-3 text-[#1f7a4d]">
                <Icon size={24} />
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-lg bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Automated collection status</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Imported destinations are held for admin review. AI-generated summaries,
          category suggestions, and duplicate matches should be checked before publishing.
        </p>
      </section>
    </AdminLayout>
  );
}
