<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Destination;
use Inertia\Inertia;
use Inertia\Response;

class DestinationController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Destinations/Index', [
            'destinations' => Destination::query()
                ->latest('updated_at')
                ->paginate(20)
                ->through(fn (Destination $destination) => [
                    'id' => $destination->id,
                    'name' => $destination->name,
                    'municipality' => $destination->municipality?->name,
                    'category' => $destination->category?->name,
                    'status' => $destination->status,
                    'average_rating' => $destination->average_rating,
                    'updated_at' => $destination->updated_at?->toDateTimeString(),
                ]),
        ]);
    }
}
