import React from 'react';
import AdminLayout from '../../../Layouts/AdminLayout';

export default function DestinationIndex({ destinations }) {
  return (
    <AdminLayout title="Destinations">
      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-normal text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Municipality</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {destinations.data.map((destination) => (
              <tr key={destination.id}>
                <td className="px-4 py-3 font-semibold">{destination.name}</td>
                <td className="px-4 py-3 text-slate-600">{destination.municipality ?? 'Unassigned'}</td>
                <td className="px-4 py-3 text-slate-600">{destination.category ?? 'Unassigned'}</td>
                <td className="px-4 py-3 text-slate-600">{destination.average_rating}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[#e4f5ff] px-2.5 py-1 text-xs font-bold text-[#146b91]">
                    {destination.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
