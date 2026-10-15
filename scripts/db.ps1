# Dieu khien PostgreSQL cuc bo (khong dung Windows service, khong Docker).
# Cach dung: .\scripts\db.ps1 init | start | stop | status | reset
param([Parameter(Mandatory = $true)][ValidateSet('init', 'start', 'stop', 'status', 'reset')][string]$Action)
. "$PSScriptRoot\env.ps1"

$Port = 54329
$DataDir = $env:PGDATA
$EnvFile = 'D:\Project\WebTriLieu\.env'
$Log = 'D:\Tool\PostgreSQL\postgres.log'

function Get-DbPassword {
    if (Test-Path $EnvFile) {
        $m = Select-String -Path $EnvFile -Pattern '^POSTGRES_PASSWORD=(.+)$'
        if ($m) { return $m.Matches[0].Groups[1].Value }
    }
    return $null
}

switch ($Action) {
    'init' {
        if (Test-Path "$DataDir\PG_VERSION") { Write-Host 'Da init roi.'; break }
        $pw = Get-DbPassword
        if (-not $pw) {
            $bytes = New-Object byte[] 24
            [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
            $pw = ([Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', '')
            "POSTGRES_PASSWORD=$pw" | Out-File -Append -Encoding ascii $EnvFile
        }
        $pwFile = "$env:TEMP\pgpw.txt"
        $pw | Out-File -Encoding ascii -NoNewline $pwFile
        initdb -D $DataDir -E UTF8 --locale=C -A scram-sha-256 -U postgres --pwfile=$pwFile
        Remove-Item $pwFile -Force
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
        if ((pg_isready -h 127.0.0.1 -p $Port) -match 'accepting') { Write-Host 'Dang chay roi.'; break }
        # Khoi dong qua WMI: tien trinh con duoc dich vu WMI tao ra nen khong ke thua handle/pipe
        # cua shell goi (Start-Process ke thua handle => postgres giu pipe, nguoi goi cho EOF mai mai).
        $pgctl = Join-Path $Tool 'PostgreSQL\pgsql\bin\pg_ctl.exe'
        $cmd = "`"$pgctl`" -D `"$DataDir`" -l `"$Log`" -o `"-p $Port -c listen_addresses=127.0.0.1`" start"
        $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = "$Tool\PostgreSQL" }
        if ($r.ReturnValue -ne 0) { throw "Win32_Process.Create that bai: $($r.ReturnValue)" }
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 1
            if ((pg_isready -h 127.0.0.1 -p $Port) -match 'accepting') { Write-Host 'Postgres san sang.'; break }
        }
    }
    'stop' { pg_ctl -D $DataDir -m fast stop }
    'status' { pg_ctl -D $DataDir status }
    'reset' {
        pg_ctl -D $DataDir -m immediate stop 2>$null
        Remove-Item -Recurse -Force $DataDir -ErrorAction SilentlyContinue
        & "$PSScriptRoot\db.ps1" init
    }
}
