<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\HeroSlide;
use App\Models\SiteSetting;
use App\Services\SharedSiteSettings;
use App\Support\HtmlSanitizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SettingsController extends Controller
{
    public function index()
    {
        return response()->json(SharedSiteSettings::managed()->values());
    }

    public function update(Request $request)
    {
        $request->validate([
            'settings' => 'required|array',
            'settings.*' => 'nullable|string',
            'settings.bank_transfer_accounts' => 'prohibited',
            'settings.contact_email' => 'sometimes|nullable|email:rfc|max:254',
            'settings.site_name' => 'sometimes|required|string|max:255',
            'settings.contact_phone' => 'sometimes|nullable|string|max:80',
            'settings.contact_address' => 'sometimes|nullable|string|max:2000',
        ]);
        $settings = $request->input('settings', []);

        // Only allow updating settings in these admin-editable groups
        $editableGroups = [
            'general', 'footer', 'seo', 'contact', 'about', 'services', 'portfolio',
            'blog', 'home', 'legal', 'shipping-freight', 'shipping-tax', 'nav', 'header',
        ];

        $updated = [];
        DB::transaction(function () use ($settings, $editableGroups, &$updated) {
            foreach ($settings as $key => $value) {
                if (isset(SharedSiteSettings::LEGACY_KEYS[$key])) {
                    continue;
                }
                $setting = SiteSetting::where('key', $key)->first();
                if (! $setting || ! in_array($setting->group, $editableGroups, true)) {
                    continue;
                }

                $setting->update([
                    'value' => $setting->type === 'richtext'
                        ? HtmlSanitizer::richText($value ?? '')
                        : ($value ?? ''),
                ]);
                $updated[] = $key;
            }
        });

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
