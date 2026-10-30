<?php

// Read-only guard, run before file sync and again before any migration.
$expectedPath = '/home/u993999906/domains/api-test.midiawork.com/.midia-deploy/backend-20261024-01';
$path = $argv[1] ?? '';
if ($path !== $expectedPath || realpath($path) !== $expectedPath) {
    throw new RuntimeException('Refusing to deploy outside the dedicated api-test application.');
}

require $path.'/vendor/autoload.php';

$expectedEnv = [
    'APP_URL' => 'https://api-test.midiawork.com',
    'FRONTEND_URL' => 'https://test.midiawork.com',
    'DB_CONNECTION' => 'mysql',
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_DATABASE' => 'u993999906_test_midia',
];
$env = Dotenv\Dotenv::parse(file_get_contents($path.'/.env'));
foreach ($expectedEnv as $key => $value) {
    if (($env[$key] ?? null) !== $value) {
        throw new RuntimeException("Unexpected {$key} in the api-test environment; deployment stopped.");
    }
}
if (! empty($env['DB_URL'])) {
    throw new RuntimeException('DB_URL may override the dedicated database; deployment stopped.');
}

// Check effective Laravel configuration too: cached/exported values can override .env.
$app = require $path.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$expectedConfig = [
    'app.url' => $expectedEnv['APP_URL'],
    'app.frontend_url' => $expectedEnv['FRONTEND_URL'],
    'database.default' => 'mysql',
    'database.connections.mysql.host' => 'localhost',
    'database.connections.mysql.port' => '3306',
    'database.connections.mysql.database' => $expectedEnv['DB_DATABASE'],
];
foreach ($expectedConfig as $key => $value) {
    if ((string) config($key) !== $value) {
        throw new RuntimeException("Unexpected effective {$key}; deployment stopped.");
    }
}
if (config('database.connections.mysql.url') || config('database.connections.mysql.write')) {
    throw new RuntimeException('Unexpected database connection override; deployment stopped.');
}
if (config('services.frontend_deploy.enabled')) {
    throw new RuntimeException('Disable admin workflow dispatch in api-test to prevent deployments to another environment.');
}

echo "Verified api-test application and dedicated test database configuration.\n";
