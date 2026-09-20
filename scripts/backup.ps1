# ============================================================
# BACKUP SCRIPT — Har kuni avtomatik ishga tushadi
# ============================================================
$ErrorActionPreference = "Continue"

$projectDir = "C:\Users\user\Desktop\dasturlash darslari\pubg-bot"
$backupDir = "$projectDir\backups"
$dataDir = "$projectDir\data"
$logFile = "$backupDir\backup.log"

# Papkalarni yaratish
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# Sana
$date = Get-Date -Format "yyyy-MM-dd_HH-mm"
$zipPath = "$backupDir\data-$date.zip"

# Log yozish
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $logFile -Append
}

try {
    Write-Log "Backup boshlandi"

    if (Test-Path $dataDir) {
        Compress-Archive -Path "$dataDir\*" -DestinationPath $zipPath -Force
        $size = (Get-Item $zipPath).Length / 1KB
        Write-Log "Backup yaratildi: $zipPath ($([math]::Round($size, 2)) KB)"
    } else {
        Write-Log "data/ papka topilmadi"
    }

    # 30 kundan eski backuplarni ochirish
    $oldBackups = Get-ChildItem $backupDir -Filter "data-*.zip" | Where-Object {
        $_.CreationTime -lt (Get-Date).AddDays(-30)
    }
    if ($oldBackups) {
        $oldBackups | Remove-Item -Force
        Write-Log "$($oldBackups.Count) ta eski backup ochirildi"
    }

    Write-Log "Backup tugadi"
} catch {
    Write-Log "Xatolik: $_"
}
