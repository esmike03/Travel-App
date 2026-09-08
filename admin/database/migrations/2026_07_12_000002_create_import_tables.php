<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_batches', function (Blueprint $table) {
            $table->id();
            $table->string('status')->default('queued')->index();
            $table->json('source_summary')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('imported_destinations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->constrained()->cascadeOnDelete();
            $table->string('source_url', 1024);
            $table->string('source_name')->nullable();
            $table->json('raw_payload')->nullable();
            $table->json('normalized_payload')->nullable();
            $table->foreignId('duplicate_destination_id')->nullable()->constrained('destinations')->nullOnDelete();
            $table->decimal('confidence_score', 4, 2)->default(0);
            $table->text('ai_summary')->nullable();
            $table->string('ai_category')->nullable();
            $table->string('status')->default('pending')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('imported_destinations');
        Schema::dropIfExists('import_batches');
    }
};
