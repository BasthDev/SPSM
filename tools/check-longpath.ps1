# Cek LongPathsEnabled + path terpanjang di project
Write-Output "=== LongPathsEnabled registry ==="
$lp = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -ErrorAction SilentlyContinue).LongPathsEnabled
Write-Output "LongPathsEnabled = $lp (1=enabled, 0/null=disabled)"

Write-Output "`n=== Manifest longPathAware ==="
$manifest = 'D:\S\android\app\src\main\AndroidManifest.xml'
if (Test-Path $manifest) {
  $content = Get-Content $manifest -Raw
  if ($content -match 'longPathAware') { Write-Output "manifest has longPathAware attr" } else { Write-Output "manifest TIDAK punya longPathAware" }
} else { Write-Output "manifest tidak ditemukan: $manifest" }

Write-Output "`n=== Top 10 path terpanjang (android build) ==="
Get-ChildItem 'D:\S\android' -Recurse -File -ErrorAction SilentlyContinue |
  Sort-Object { $_.FullName.Length } -Descending |
  Select-Object -First 10 |
  ForEach-Object { "{0,4} | {1}" -f $_.FullName.Length, $_.FullName }

Write-Output "`n=== Top 10 path terpanjang (node_modules, hanya sample) ==="
Get-ChildItem 'D:\S\node_modules' -Recurse -File -ErrorAction SilentlyContinue |
  Sort-Object { $_.FullName.Length } -Descending |
  Select-Object -First 10 |
  ForEach-Object { "{0,4} | {1}" -f $_.FullName.Length, $_.FullName }

Write-Output "`n=== Max path length ==="
$max1 = (Get-ChildItem 'D:\S\android' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object { $_.FullName.Length } -Maximum).Maximum
$max2 = (Get-ChildItem 'D:\S\node_modules' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object { $_.FullName.Length } -Maximum).Maximum
Write-Output "android max: $max1"
Write-Output "node_modules max: $max2"
Write-Output "Windows limit tanpa LongPaths: 260"
