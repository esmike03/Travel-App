<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportedDestination extends Model
{
    protected $fillable = [
        'import_batch_id',
        'source_url',
        'source_name',
        'raw_payload',
        'normalized_payload',
        'duplicate_destination_id',
        'confidence_score',
        'ai_summary',
        'ai_category',
        'status',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'raw_payload' => 'array',
            'normalized_payload' => 'array',
            'confidence_score' => 'decimal:2',
            'reviewed_at' => 'datetime',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ImportBatch::class, 'import_batch_id');
    }
}
