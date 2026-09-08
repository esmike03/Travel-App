<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Review extends Model
{
    protected $fillable = ['user_id', 'destination_id', 'rating', 'body', 'status'];

    public function destination(): BelongsTo
    {
        return $this->belongsTo(Destination::class);
    }
}
