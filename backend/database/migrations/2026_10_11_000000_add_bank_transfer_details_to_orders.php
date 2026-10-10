<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('orders', 'bank_transfer_details')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->json('bank_transfer_details')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'bank_transfer_details')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('bank_transfer_details');
            });
        }
    }
};
