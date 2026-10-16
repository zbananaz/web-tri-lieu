# Dieu khien PostgreSQL cuc bo (cum rieng cua du an, khong dung Windows service, khong Docker).
# Cach dung (tu thu muc goc repo): .\scripts\db.ps1 init | start | stop | status | reset | backup
# Can: pg_ctl, initdb, createdb, psql, pg_isready (va pg_dump cho backup) tren PATH,
#      hoac dat WTL_TOOL_DIR tro toi thu muc co PostgreSQL\pgsql\bin (xem env.ps1). Can PostgreSQL 17.
# Bien tuy chon: PGDATA (noi luu du lieu), PGPORT (mac dinh 54329).
param([Parameter(Mandatory = $true)][ValidateSet('init', 'start', 'stop', 'status', 'reset', 'backup')][string]$Action)
. "$PSScriptRoot\env.ps1"

$Port = if ($env:PGPORT) { $env:PGPORT } else { '54329' }
$DataDir = $env:PGDATA
$EnvFile = Join-Path $Root '.env'
$PgHome = Split-Path -Parent $DataDir                 # thu muc cha cua du lieu: chua log va backups
$Log = Join-Path $PgHome 'postgres.log'

foreach ($c in 'pg_ctl', 'psql') {
    if (-not (Get-Command $c -ErrorAction SilentlyContinue)) {
        throw "Khong tim thay '$c' tren PATH. Cai PostgreSQL 17 (them thu muc bin vao PATH) hoac dat WTL_TOOL_DIR - xem docs/HUONG-DAN-CHAY-LOCAL.md muc 1."
    }
}

function Get-DbPassword {
    if (Test-Path $EnvFile) {
        $m = Select-String -Path $EnvFile -Pattern '^POSTGRES_PASSWORD=(.+)$'
        if ($m) { return $m.Matches[0].Groups[1].Value }
    }
    return $null
}

function Test-Ready { (pg_isready -h 127.0.0.1 -p $Port) -match 'accepting' }

switch ($Action) {
    'init' {
        if (Test-Path "$DataDir\PG_VERSION") { Write-Host 'Da init roi.'; break }
        $pw = Get-DbPassword
        if (-not $pw) {
            $bytes = New-Object byte[] 24
            [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
            $pw = ([Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', '')
            "POSTGRES_PASSWORD=$pw" | Out-File -Append -Encoding ascii $EnvFile
            Write-Host "Da them POSTGRES_PASSWORD moi vao $EnvFile (nho sua DATABASE_URL/TEST_DATABASE_URL cho khop)."
        }
        New-Item -ItemType Directory -Force $PgHome | Out-Null
        $pwFile = Join-Path ([IO.Path]::GetTempPath()) 'wtl-pgpw.txt'
        $pw | Out-File -Encoding ascii -NoNewline $pwFile
        try { initdb -D $DataDir -E UTF8 --locale=C -A scram-sha-256 -U postgres --pwfile=$pwFile }
        finally { Remove-Item $pwFile -Force -ErrorAction SilentlyContinue }
        & "$PSScriptRoot\db.ps1" start
        $env:PGPASSWORD = $pw
        foreach ($db in 'webtrilieu', 'webtrilieu_test') {
            createdb -h 127.0.0.1 -p $Port -U postgres $db
            psql -h 127.0.0.1 -p $Port -U postgres -d $db -c 'CREATE EXTENSION IF NOT EXISTS btree_gist;'
        }
        Write-Host "Init xong. Port $Port, 2 database: webtrilieu, webtrilieu_test."
    }
    'start' {
        # Khong dung -Wait: no cho ca cay tien trinh con (chinh postgres) nen treo mai mai.
        # Thay vao do chay an roi tu poll pg_isready.
        if (Test-Ready) { Write-Host 'Dang chay roi.'; break }
        $pgctl = (Get-Command pg_ctl).Source
        $isWindows = ($PSVersionTable.PSEdition -ne 'Core') -or $IsWindows
        if ($isWindows) {
            # Khoi dong qua WMI: tien trinh con duoc dich vu WMI tao ra nen khong ke thua handle/pipe
            # cua shell goi (Start-Process ke thua handle => postgres giu pipe, nguoi goi cho EOF mai mai).
            $cmd = "`"$pgctl`" -D `"$DataDir`" -l `"$Log`" -o `"-p $Port -c listen_addresses=127.0.0.1`" start"
            $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $PgHome }
            if ($r.ReturnValue -ne 0) { throw "Win32_Process.Create that bai: $($r.ReturnValue)" }
        } else {
            # Chua kiem tren Linux/macOS.
            & $pgctl -D $DataDir -l $Log -o "-p $Port -c listen_addresses=127.0.0.1" start
        }
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 1
            if (Test-Ready) { Write-Host 'Postgres san sang.'; break }
        }
    }
    'stop' { pg_ctl -D $DataDir -m fast stop }
    'status' { pg_ctl -D $DataDir status }
    'backup' {
        # Sao luu DB chinh ra <PgHome>\backups (dinh dang custom, nen khoi phuc bang pg_restore). Giu 14 ban moi nhat.
        $pw = Get-DbPassword
        if (-not $pw) { throw 'Khong doc duoc POSTGRES_PASSWORD trong .env' }
        $dir = Join-Path $PgHome 'backups'
        New-Item -ItemType Directory -Force $dir | Out-Null
        $file = Join-Path $dir ('webtrilieu-{0:yyyyMMdd-HHmmss}.dump' -f (Get-Date))
        $env:PGPASSWORD = $pw
        pg_dump -h 127.0.0.1 -p $Port -U postgres -Fc -f $file webtrilieu
        if ($LASTEXITCODE -ne 0) { throw "pg_dump that bai ($LASTEXITCODE)" }
        Get-ChildItem $dir -Filter 'webtrilieu-*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
        Write-Host ("Da sao luu: {0} ({1:N0} KB)" -f $file, ((Get-Item $file).Length / 1KB))
    }
    'reset' {
        # Chi xoa khi thu muc that su la du lieu PostgreSQL, tranh xoa nham do PGDATA dat sai.
        if (-not (Test-Path "$DataDir\PG_VERSION")) { throw "$DataDir khong phai thu muc du lieu PostgreSQL (khong co PG_VERSION). Khong xoa." }
        pg_ctl -D $DataDir -m immediate stop 2>$null
        Remove-Item -Recurse -Force $DataDir -ErrorAction SilentlyContinue
        & "$PSScriptRoot\db.ps1" init
    }
}
