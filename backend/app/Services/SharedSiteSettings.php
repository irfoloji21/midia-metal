<?php

namespace App\Services;

use App\Models\SiteSetting;
use Illuminate\Support\Collection;

/** Shared company details have one editable source; older records remain archived. */
class SharedSiteSettings
{
    public const LEGACY_KEYS = [
        'company_name' => 'site_name',
        'company_email' => 'contact_email',
        'company_phone' => 'contact_phone',
        'company_address' => 'contact_address',
        'services_hero_phone' => 'contact_phone',
        'nav_faq' => 'footer_info_faq',
    ];

    public const TOKENS = ['site_name', 'contact_email', 'contact_phone', 'contact_address'];

    public static function managed(): Collection
    {
        return SiteSetting::whereNotIn('key', [...array_keys(self::LEGACY_KEYS), 'bank_transfer_accounts'])
            ->get()->each(function (SiteSetting $setting) {
                if (in_array($setting->group, ['header', 'footer'], true) || $setting->key === 'contact_map_url') {
                    $setting->group = 'general';
                }
            });
    }

    public static function published(): Collection
    {
        $settings = self::managed();
        $values = $settings->pluck('value', 'key')->all();

        return $settings->each(function (SiteSetting $setting) use ($values) {
            $setting->value = self::resolve((string) $setting->value, $values, $setting->type === 'richtext');
        });
    }

    public static function resolve(string $text, array $values, bool $html = false): string
    {
        $replacements = [];
        foreach (self::TOKENS as $key) {
            $value = (string) ($values[$key] ?? ($key === 'site_name' ? 'Midia M Metal' : ''));
            $replacements['{{'.$key.'}}'] = $html ? htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : $value;
        }

        return strtr($text, $replacements);
    }
}
