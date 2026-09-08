<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportBatch extends Model
{
    protected $fillable = ['status', 'source_summary', 'started_at', 'finished_at'];

    protected function casts(): array
    {
        return [
            'source_summary' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function importedDestinations(): HasMany
    {
        return $this->hasMany(ImportedDestination::class);
    }
}
