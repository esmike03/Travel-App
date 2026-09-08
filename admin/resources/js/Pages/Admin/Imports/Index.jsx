import React from 'react';
import { router } from '@inertiajs/react';
import AdminLayout from '../../../Layouts/AdminLayout';
import { Check, Play, X } from 'lucide-react';

export default function ImportIndex({ imports }) {
  return (
    <AdminLayout title="Automated destination import">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => router.post('/admin/imports/run')}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f7a4d] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#17623d]"
        >
          <Play size={16} />
          Run import
        </button>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-normal text-slate-500">
            <tr>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {imports.data.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-semibold">{item.name ?? 'Untitled'}</td>
                <td className="max-w-md truncate px-4 py-3 text-slate-600">{item.source_url}</td>
                <td className="px-4 py-3 text-slate-600">{item.confidence_score}</td>
                <td className="px-4 py-3 text-slate-600">{item.status}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => router.post(`/admin/imports/${item.id}/approve`)}
                      className="rounded-lg bg-[#e9f7f2] p-2 text-[#1f7a4d]"
                      aria-label="Approve import"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => router.post(`/admin/imports/${item.id}/reject`)}
                      className="rounded-lg bg-red-50 p-2 text-red-600"
                      aria-label="Reject import"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
