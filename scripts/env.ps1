# Dot-source file nay truoc moi lenh: . D:\Project\WebTriLieu\scripts\env.ps1
# Muc dich: dua tat ca tool + cache sang o D, khong ghi gi vao o C, khong sua PATH/registry cua may.
$Tool = 'D:\Tool'
foreach ($d in "$Tool\cache\tmp", "$Tool\cache\npm", "$Tool\cache\pnpm-store", "$Tool\cache\corepack", "$Tool\cache\xdg", "$Tool\ms-playwright") {
    New-Item -ItemType Directory -Force $d | Out-Null
}
$env:TEMP = "$Tool\cache\tmp"
$env:TMP = $env:TEMP
$env:npm_config_cache = "$Tool\cache\npm"
$env:COREPACK_HOME = "$Tool\cache\corepack"
$env:XDG_CACHE_HOME = "$Tool\cache\xdg"
$env:PLAYWRIGHT_BROWSERS_PATH = "$Tool\ms-playwright"
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:PGDATA = "$Tool\PostgreSQL\data"
$env:PATH = "$Tool\pnpm\node_modules\.bin;$Tool\PostgreSQL\pgsql\bin;" + $env:PATH
Set-Location 'D:\Project\WebTriLieu'
