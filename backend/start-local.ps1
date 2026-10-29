$ErrorActionPreference = 'Stop'

# Run from any directory; bind only to the local machine.
$taskPhp = (Get-Command php -ErrorAction Stop).Source
$taskExtensionDir = Join-Path (Split-Path $taskPhp) 'ext'
$taskModules = @(& $taskPhp -m)
$taskPhpArgs = @()
foreach ($taskExtension in @('pdo_sqlite', 'sqlite3', 'mbstring', 'fileinfo', 'openssl', 'curl', 'gd')) {
    if ($taskModules -notcontains $taskExtension) {
        $taskDll = Join-Path $taskExtensionDir "php_$taskExtension.dll"
        if (!(Test-Path -LiteralPath $taskDll)) {
            throw "Required PHP extension is missing: $taskDll"
        }
        $taskPhpArgs += @('-d', "extension=$taskDll")
    }
}

$taskRouter = Join-Path $PSScriptRoot 'vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php'
Push-Location (Join-Path $PSScriptRoot 'public')
try {
    # Laravel's router serves existing files directly, including /storage uploads.
    & $taskPhp @taskPhpArgs -S 127.0.0.1:8000 $taskRouter
} finally {
    Pop-Location
}
