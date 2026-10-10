<?php

return [

    'business_notification_email' => env('BUSINESS_NOTIFICATION_EMAIL', 'softwaredevelopment2181@gmail.com'),

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
    ],

    'shipping' => [
        'provider' => env('SHIPPING_PROVIDER', 'easypost'),
        'mock' => env('SHIPPING_MOCK', true),
        'from_name' => env('SHIPPING_FROM_NAME', env('APP_NAME', 'Midia Metal')),
        'from_company' => env('SHIPPING_FROM_COMPANY', 'Midia Metal'),
        'from_email' => env('SHIPPING_FROM_EMAIL', 'softwaredevelopment2181@gmail.com'),
        'from_phone' => env('SHIPPING_FROM_PHONE', '+44 123 456 7890'),
        'from_address_line1' => env('SHIPPING_FROM_ADDRESS_LINE1', 'Unit 8A Cromwell Centre'),
        'from_address_line2' => env('SHIPPING_FROM_ADDRESS_LINE2', 'Roebuck Road, Hainault Business Park'),
        'from_city' => env('SHIPPING_FROM_CITY', 'Ilford'),
        'from_postcode' => env('SHIPPING_FROM_POSTCODE', 'IG6 3UG'),
        'from_county' => env('SHIPPING_FROM_COUNTY', 'Essex'),
        'from_country' => env('SHIPPING_FROM_COUNTRY', 'GB'),
        'default_rate' => (float) env('SHIPPING_DEFAULT_RATE', 6.50),
        'default_parcel' => [
            'length' => (float) env('SHIPPING_DEFAULT_LENGTH', 30),
            'width' => (float) env('SHIPPING_DEFAULT_WIDTH', 20),
            'height' => (float) env('SHIPPING_DEFAULT_HEIGHT', 10),
            'distance_unit' => env('SHIPPING_DEFAULT_DISTANCE_UNIT', 'cm'),
            'weight' => (float) env('SHIPPING_DEFAULT_WEIGHT', 2),
            'mass_unit' => env('SHIPPING_DEFAULT_MASS_UNIT', 'kg'),
        ],
        'packaging' => [
            'padding_cm' => (float) env('SHIPPING_PACKAGE_PADDING_CM', 1),
            'tare_weight_kg' => (float) env('SHIPPING_PACKAGE_TARE_WEIGHT_KG', 0.15),
            'max_parcel_weight_kg' => (float) env('SHIPPING_MAX_PARCEL_WEIGHT_KG', 25),
            'max_parcel_length_cm' => (float) env('SHIPPING_MAX_PARCEL_LENGTH_CM', 100),
            'max_length_plus_girth_cm' => (float) env('SHIPPING_MAX_LENGTH_PLUS_GIRTH_CM', 300),
        ],
    ],

    'easypost' => [
        'api_key' => env('EASYPOST_API_KEY'),
        'base_url' => env('EASYPOST_BASE_URL', 'https://api.easypost.com/v2'),
        'default_carrier' => env('EASYPOST_DEFAULT_CARRIER', 'Royal Mail'),
        'default_service' => env('EASYPOST_DEFAULT_SERVICE', 'Tracked 48'),
        'webhook_secret' => env('EASYPOST_WEBHOOK_SECRET'),
    ],

    'frontend_deploy' => [
        'enabled' => env('FRONTEND_DEPLOY_TRIGGER_ENABLED', false),
        'token' => env('GITHUB_ACTIONS_TRIGGER_TOKEN'),
        'repository' => env('GITHUB_ACTIONS_REPOSITORY', 'Mahmut-Mese/midia-metal'),
        'workflow' => env('GITHUB_FRONTEND_DEPLOY_WORKFLOW', 'frontend-content-deploy.yml'),
        'ref' => env('GITHUB_FRONTEND_DEPLOY_REF', 'staging'),
        'debounce_seconds' => (int) env('FRONTEND_DEPLOY_DEBOUNCE_SECONDS', 60),
        'api_base' => env('GITHUB_API_BASE', 'https://api.github.com'),
    ],

];
