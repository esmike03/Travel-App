<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Destination;
use App\Models\ImportedDestination;
use App\Models\Review;
use App\Models\User;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'users' => User::query()->count(),
                'publishedDestinations' => Destination::query()->where('status', 'published')->count(),
                'pendingImports' => ImportedDestination::query()->where('status', 'pending')->count(),
                'pendingReviews' => Review::query()->where('status', 'pending')->count(),
            ],
        ]);
    }
}
