<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ImportedDestination;
use App\Services\DestinationImportService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ImportController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Imports/Index', [
            'imports' => ImportedDestination::query()
                ->latest()
                ->paginate(20)
                ->through(fn (ImportedDestination $import) => [
                    'id' => $import->id,
                    'name' => data_get($import->normalized_payload, 'name'),
                    'source_url' => $import->source_url,
                    'status' => $import->status,
                    'confidence_score' => $import->confidence_score,
                    'duplicate_destination_id' => $import->duplicate_destination_id,
                    'created_at' => $import->created_at?->toDateTimeString(),
                ]),
        ]);
    }

    public function run(DestinationImportService $service): RedirectResponse
    {
        $service->createPendingBatch();

        return back()->with('success', 'Destination import queued for review.');
    }

    public function approve(ImportedDestination $importedDestination, DestinationImportService $service): RedirectResponse
    {
        $service->approve($importedDestination, auth()->id());

        return back()->with('success', 'Imported destination approved.');
    }

    public function reject(ImportedDestination $importedDestination, DestinationImportService $service): RedirectResponse
    {
        $service->reject($importedDestination, auth()->id());

        return back()->with('success', 'Imported destination rejected.');
    }
}
