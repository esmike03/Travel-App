<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Destination extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'category_id',
        'municipality_id',
        'address',
        'latitude',
        'longitude',
        'entrance_fee',
        'opening_hours',
        'contact_phone',
        'contact_email',
        'website_url',
        'best_time_to_visit',
        'facilities',
        'average_rating',
        'review_count',
        'status',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'facilities' => 'array',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'average_rating' => 'decimal:2',
            'published_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(DestinationImage::class)->orderBy('position');
    }
}
