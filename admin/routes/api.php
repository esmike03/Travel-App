<?php

use App\Http\Controllers\Api\DestinationSyncController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('sync/pull', [DestinationSyncController::class, 'pull']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('sync/push', [DestinationSyncController::class, 'push']);
    });
});
