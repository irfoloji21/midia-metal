<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SharedSiteSettings;

class SettingsController extends Controller
{
    public function index()
    {
        return response()->json(SharedSiteSettings::published()->values())->header('Cache-Control', 'no-store');
    }
}
