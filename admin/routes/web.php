<?php

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DestinationController;
use App\Http\Controllers\Admin\ImportController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/admin');

Route::middleware(['auth', 'verified'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', DashboardController::class)->name('dashboard');
    Route::resource('destinations', DestinationController::class);

    Route::get('imports', [ImportController::class, 'index'])->name('imports.index');
    Route::post('imports/run', [ImportController::class, 'run'])->name('imports.run');
    Route::post('imports/{importedDestination}/approve', [ImportController::class, 'approve'])->name('imports.approve');
    Route::post('imports/{importedDestination}/reject', [ImportController::class, 'reject'])->name('imports.reject');
});
