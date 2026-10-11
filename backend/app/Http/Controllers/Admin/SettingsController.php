<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\HeroSlide;
use App\Models\SiteSetting;
use App\Support\HtmlSanitizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SettingsController extends Controller
{
    public function index()
    {
        SiteSetting::firstOrCreate(
            ['key' => 'bank_transfer_accounts'],
            ['value' => '[]', 'type' => 'json', 'group' => 'payment']
        );

        return response()->json(SiteSetting::all());
    }

    public function update(Request $request)
    {
        $request->validate(['settings' => 'required|array']);
        $settings = $request->input('settings', []);

        if (array_key_exists('bank_transfer_accounts', $settings)) {
            $accounts = json_decode((string) $settings['bank_transfer_accounts'], true);
            $validator = Validator::make(['accounts' => $accounts], [
                'accounts' => 'required|array',
                'accounts.*.id' => 'required|string|max:64|distinct',
                'accounts.*.bank_name' => 'required|string|max:120',
                'accounts.*.account_name' => 'required|string|max:120',
                'accounts.*.sort_code' => 'required|string|max:32',
                'accounts.*.account_number' => 'required|string|max:64',
                'accounts.*.iban' => 'nullable|string|max:64',
                'accounts.*.bic_swift' => 'nullable|string|max:32',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Each bank account needs a bank name, account name, sort code, and account number.',
                    'errors' => $validator->errors(),
                ], 422);
            }
        }

        // Only allow updating settings in these admin-editable groups
        $editableGroups = [
            'general', 'footer', 'seo', 'contact', 'about', 'services', 'portfolio',
            'blog', 'home', 'legal', 'shipping-freight', 'nav', 'payment',
        ];

        $updated = [];
        foreach ($settings as $key => $value) {
            $setting = SiteSetting::where('key', $key)->first();
            if (! $setting || ! in_array($setting->group, $editableGroups, true)) {
                continue;
            }

            $setting->update([
                'value' => $setting->type === 'richtext'
                    ? HtmlSanitizer::richText($value)
                    : $value,
            ]);
            $updated[] = $key;
        }

        return response()->json(['message' => 'Settings updated', 'updated' => $updated]);
    }

    // Hero Slides
    public function heroSlides()
    {
        return response()->json(HeroSlide::orderBy('order')->get());
    }

    public function storeHeroSlide(Request $request)
    {
        $validated = $request->validate([
            'image' => 'required|string',
            'alt' => 'nullable|string',
            'order' => 'integer',
            'active' => 'boolean',
        ]);

        return response()->json(HeroSlide::create($validated), 201);
    }

    public function updateHeroSlide(Request $request, HeroSlide $heroSlide)
    {
        $validated = $request->validate([
            'image' => 'required|string',
            'alt' => 'nullable|string',
            'order' => 'integer',
            'active' => 'boolean',
        ]);
        $heroSlide->update($validated);

        return response()->json($heroSlide);
    }

    public function destroyHeroSlide(HeroSlide $heroSlide)
    {
        $heroSlide->delete();

        return response()->json(['message' => 'Slide deleted']);
    }
}
