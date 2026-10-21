<?php

use App\Models\SiteSetting;
use App\Services\SharedSiteSettings;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            // Prefer the values already displayed on the public website.
            foreach (SharedSiteSettings::LEGACY_KEYS as $oldKey => $key) {
                $old = SiteSetting::where('key', $oldKey)->first();
                if ($old && ! SiteSetting::where('key', $key)->exists()) {
                    SiteSetting::create(['key' => $key, 'value' => $old->value, 'type' => $old->type ?? 'text', 'group' => 'general']);
                }
            }

            SiteSetting::whereIn('group', ['header', 'footer'])->update(['group' => 'general']);
            SiteSetting::where('key', 'contact_map_url')->update(['group' => 'general']);
            SiteSetting::whereIn('key', array_keys(SharedSiteSettings::LEGACY_KEYS))->update(['group' => 'legacy-general']);

            $values = SiteSetting::pluck('value', 'key')->all();
            $names = array_filter([$values['site_name'] ?? '', $values['company_name'] ?? '', 'Midia M Metal']);
            $emails = array_filter([$values['contact_email'] ?? '', $values['company_email'] ?? '', 'info@midiametal.co.uk']);
            $replacements = [];
            foreach ($names as $name) {
                $replacements[$name] = '{{site_name}}';
            }
            foreach ($emails as $email) {
                $replacements[$email] = '{{contact_email}}';
            }
            // Only shared company references change; the policy wording and custom labels are preserved.
            SiteSetting::whereIn('key', [
                'privacy_policy_content', 'terms_conditions_content', 'cookies_page_content',
                'returns_refunds_content', 'footer_text',
            ])->get()->each(function ($setting) use ($replacements) {
                $setting->update(['value' => strtr((string) $setting->value, $replacements)]);
            });
        });
    }

    public function down(): void
    {
        $values = SiteSetting::pluck('value', 'key')->all();
        SiteSetting::all()->each(function ($setting) use ($values) {
            $group = $setting->group;
            if (str_starts_with($setting->key, 'header_') || in_array($setting->key, ['site_name', 'site_logo'], true)) {
                $group = 'header';
            } elseif (str_starts_with($setting->key, 'footer_') || str_starts_with($setting->key, 'social_') || in_array($setting->key, ['contact_email', 'contact_phone', 'contact_address'], true)) {
                $group = 'footer';
            } elseif ($setting->key === 'contact_map_url') {
                $group = 'contact';
            } elseif (isset(SharedSiteSettings::LEGACY_KEYS[$setting->key])) {
                $group = $setting->key === 'services_hero_phone' ? 'services' : 'general';
            }
            $setting->update(['group' => $group, 'value' => SharedSiteSettings::resolve((string) $setting->value, $values, $setting->type === 'richtext')]);
        });
    }
};
