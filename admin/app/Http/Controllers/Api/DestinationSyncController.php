<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Destination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DestinationSyncController extends Controller
{
    public function pull(Request $request): JsonResponse
    {
        $updatedAfter = $request->query('cursor');

        $destinations = Destination::query()
            ->where('status', 'published')
            ->when($updatedAfter, fn ($query) => $query->where('updated_at', '>', $updatedAfter))
            ->with(['category', 'municipality', 'images'])
            ->latest('updated_at')
            ->limit(500)
            ->get();

        return response()->json([
            'cursor' => now()->toIso8601String(),
            'destinations' => $destinations,
            'categories' => Category::query()->orderBy('name')->get(),
        ]);
    }

    public function push(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'clientMutationId' => ['required', 'string'],
            'mutations' => ['array'],
        ]);

        return response()->json([
            'acceptedIds' => collect($validated['mutations'] ?? [])->pluck('id')->values(),
            'rejectedIds' => [],
        ]);
    }
}
