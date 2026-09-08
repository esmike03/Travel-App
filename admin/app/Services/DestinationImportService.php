<?php

namespace App\Services;

use App\Models\Destination;
use App\Models\ImportBatch;
use App\Models\ImportedDestination;
use Illuminate\Support\Str;

class DestinationImportService
{
    public function createPendingBatch(): ImportBatch
    {
        $batch = ImportBatch::query()->create([
            'status' => 'queued',
            'source_summary' => config('travs.import_allowlist'),
        ]);

        // Real crawlers and AI enrichment should run in queued jobs. This seed record
        // keeps the admin workflow usable while the crawler integration is developed.
        ImportedDestination::query()->create([
            'import_batch_id' => $batch->id,
            'source_url' => 'manual-seed://bohol/chocolate-hills',
            'source_name' => 'Travs seed',
            'raw_payload' => [],
            'normalized_payload' => [
                'name' => 'Chocolate Hills',
                'description' => 'A natural landmark in Bohol known for its cone-shaped hills.',
                'municipality' => 'Carmen',
                'category' => 'Nature',
                'latitude' => 9.8297,
                'longitude' => 124.1397,
            ],
            'confidence_score' => 0.92,
            'status' => 'pending',
        ]);

        return $batch;
    }

    public function approve(ImportedDestination $importedDestination, ?int $adminId): Destination
    {
        $payload = $importedDestination->normalized_payload ?? [];
        $name = data_get($payload, 'name', 'Untitled destination');

        $destination = Destination::query()->updateOrCreate(
            ['slug' => Str::slug($name)],
            [
                'name' => $name,
                'description' => data_get($payload, 'description'),
                'address' => data_get($payload, 'address'),
                'latitude' => data_get($payload, 'latitude'),
                'longitude' => data_get($payload, 'longitude'),
                'status' => 'published',
                'published_at' => now(),
            ]
        );

        $importedDestination->update([
            'status' => 'approved',
            'reviewed_by' => $adminId,
            'reviewed_at' => now(),
            'duplicate_destination_id' => $destination->id,
        ]);

        return $destination;
    }

    public function reject(ImportedDestination $importedDestination, ?int $adminId): void
    {
        $importedDestination->update([
            'status' => 'rejected',
            'reviewed_by' => $adminId,
            'reviewed_at' => now(),
        ]);
    }
}
