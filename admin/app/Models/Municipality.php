<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Municipality extends Model
{
    protected $fillable = ['name', 'slug'];

    public function destinations(): HasMany
    {
        return $this->hasMany(Destination::class);
    }
}
