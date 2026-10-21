<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // NULL identifies a historical refund whose completed amount is unknown.
            $table->decimal('refunded_amount', 12, 2)->nullable()->default(0);
        });
        DB::table('orders')->where('payment_status', 'refunded')->update(['refunded_amount' => DB::raw('total')]);
        DB::table('orders')->whereIn('payment_status', ['partially_refunded', 'refund_pending', 'manual_refund_pending', 'refund_failed'])
            ->update(['refunded_amount' => null]);
    }

    public function down(): void
    {
        Schema::table('orders', fn (Blueprint $table) => $table->dropColumn('refunded_amount'));
    }
};
