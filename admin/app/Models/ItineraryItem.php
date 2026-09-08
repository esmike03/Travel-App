<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItineraryItem extends Model
{
    protected $fillable = [
        'itinerary_id',
        'destination_id',
        'planned_date',
        'planned_time',
        'notes',
    ];
}
