<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DestinationImage extends Model
{
    protected $fillable = ['destination_id', 'url', 'caption', 'position'];

    public function destination(): BelongsTo
    {
        return $this->belongsTo(Destination::class);
    }
}
