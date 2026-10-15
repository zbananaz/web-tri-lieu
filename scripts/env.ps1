# Nap moi truong cho mot cua so PowerShell. Dung (tu bat ky dau, khong can biet duong dan tuyet doi):
#   . .\scripts\env.ps1          (dang dung o thu muc goc repo)
#   . <duong-dan-toi-repo>\scripts\env.ps1
# Khong sua PATH/registry cua may: moi thay doi chi co hieu luc trong cua so nay.
#
# Che do mac dinh: dung node, pnpm, PostgreSQL da co tren PATH cua may; du lieu DB nam o <repo>\data\pgdata.
# Che do thu muc cong cu rieng: dat WTL_TOOL_DIR (vd D:\Tool) de dua cache + PostgreSQL portable + trinh duyet Playwright
# vao do (xem scripts\env.local.example.ps1). Co the dat bien nay trong scripts\env.local.ps1 (khong commit) hoac truoc khi goi file nay.
$Root = Split-Path -Parent $PSScriptRoot
$sep = [IO.Path]::PathSeparator

$local = Join-Path $PSScriptRoot 'env.local.ps1'
if (Test-Path $local) { . $local }

$Tool = $env:WTL_TOOL_DIR
if ($Tool) {
    $Tool = [IO.Path]::GetFullPath($Tool)
    $cache = Join-Path $Tool 'cache'
    $browsers = Join-Path $Tool 'ms-playwright'
    foreach ($d in 'tmp', 'npm', 'pnpm-store', 'pnpm-cache', 'pnpm-state', 'corepack', 'xdg') {
        New-Item -ItemType Directory -Force (Join-Path $cache $d) | Out-Null
    }
    New-Item -ItemType Directory -Force $browsers | Out-Null
    $env:TEMP = Join-Path $cache 'tmp'
    $env:TMP = $env:TEMP
    $env:npm_config_cache = Join-Path $cache 'npm'
    $env:npm_config_store_dir = Join-Path $cache 'pnpm-store'
    $env:npm_config_cache_dir = Join-Path $cache 'pnpm-cache'
    $env:npm_config_state_dir = Join-Path $cache 'pnpm-state'
    $env:COREPACK_HOME = Join-Path $cache 'corepack'
    $env:XDG_CACHE_HOME = Join-Path $cache 'xdg'
    $env:PLAYWRIGHT_BROWSERS_PATH = $browsers
    if (-not $env:PGDATA) { $env:PGDATA = Join-Path (Join-Path $Tool 'PostgreSQL') 'data' }
    $extra = @(
        (Join-Path (Join-Path $Tool 'pnpm') 'node_modules\.bin'),
        (Join-Path (Join-Path (Join-Path $Tool 'PostgreSQL') 'pgsql') 'bin')
    ) | Where-Object { Test-Path $_ }
    if ($extra) { $env:PATH = ($extra -join $sep) + $sep + $env:PATH }
}
if (-not $env:PGDATA) { $env:PGDATA = Join-Path (Join-Path $Root 'data') 'pgdata' }

$env:NEXT_TELEMETRY_DISABLED = '1'
Set-Location $Root
