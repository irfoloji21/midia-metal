$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskSource = Join-Path $taskRoot 'backend/storage/app/private/reference-products-api.json'
$taskDestination = Join-Path $taskRoot 'backend/storage/app/private/reference-product-images'
New-Item -ItemType Directory -Path $taskDestination -Force | Out-Null
$taskProducts = (Get-Content -Raw -LiteralPath $taskSource | ConvertFrom-Json).data
$taskImages = foreach ($taskProduct in $taskProducts) {
    $taskUrls = @($taskProduct.image) + @($taskProduct.gallery)
    for ($taskIndex = 0; $taskIndex -lt $taskUrls.Count; $taskIndex++) {
        if (-not $taskUrls[$taskIndex]) { continue }
        $taskUrl = [Uri]::new([Uri]'https://support.midiawork.com', [string]$taskUrls[$taskIndex]).AbsoluteUri
        $taskExtension = [IO.Path]::GetExtension(([Uri]$taskUrl).AbsolutePath)
        [PSCustomObject]@{ product_id=$taskProduct.id; index=$taskIndex; url=$taskUrl; path=(Join-Path $taskDestination "$($taskProduct.id)-$taskIndex$taskExtension") }
    }
}
$taskImages | ForEach-Object -Parallel {
    if (-not (Test-Path -LiteralPath $_.path)) { Invoke-WebRequest -Uri $_.url -OutFile $_.path }
} -ThrottleLimit 5
$taskImages | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskDestination 'manifest.json') -Encoding UTF8
Write-Output "Saved $($taskImages.Count) source images."
