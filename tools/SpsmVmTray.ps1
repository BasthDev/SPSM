# SpsmVmTray.ps1 — Tray app untuk menjaga VM VirtualBox "SPSM" tetap hidup.
# Jalankan via Start-SpsmVmTray.bat. Menu tray: Start/Stop VM, Buka SSH, Exit.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$VM_NAME   = 'SPSM'
$VM_UUID   = 'd829a4e4-a59c-4b03-8e09-b77fcba74826'
$VBOXMANAGE = 'C:\Program Files\Oracle\VirtualBox\VBoxManage.exe'
$SSH_HOST  = '127.0.0.1'
$SSH_PORT  = '2222'
$SSH_USER  = 'basth'

# --- Icon bundar sederhana digambar via bitmap ---
function New-TrayIcon {
    $bmp = New-Object System.Drawing.Bitmap 16,16
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::FromArgb(32,138,239))
    $g.DrawEllipse((New-Object System.Drawing.Pen([System.Drawing.Color]::White,2)),2,2,12,12)
    $g.Dispose()
    return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}

function Get-VmState {
    $out = & $VBOXMANAGE showvminfo $VM_UUID --machinereadable 2>$null | Select-String '^VMState='
    if ($out) { return ($out -replace 'VMState="?|"','').Trim() }
    return 'unknown'
}

function Start-Vm {
    $state = Get-VmState
    if ($state -eq 'running') { return $true }
    & $VBOXMANAGE startvm $VM_UUID --type headless | Out-Null
    Start-Sleep -Seconds 3
    return (Get-VmState) -eq 'running'
}

function Stop-Vm {
    & $VBOXMANAGE controlvm $VM_UUID acpipowerbutton | Out-Null
}

function Test-Ssh {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $r = $c.BeginConnect($SSH_HOST, [int]$SSH_PORT, $null, $null)
        $ok = $r.AsyncWaitHandle.WaitOne(800)
        $c.Close()
        return $ok
    } catch { return $false }
}

# --- Auto-start VM saat tray dibuka ---
[void](Start-Vm)

# --- Tray icon + menu ---
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = New-TrayIcon
$notify.Text = 'SPSM VM'
$notify.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$itemState = $menu.Items.Add('Status: cek...')
$itemState.Enabled = $false
$menu.Items.Add('-') | Out-Null

$itemStart = $menu.Items.Add('Start VM')
$itemStart.add_Click({ [void](Start-Vm); Update-Status })

$itemStop = $menu.Items.Add('Stop VM')
$itemStop.add_Click({ Stop-Vm; Start-Sleep 2; Update-Status })

$menu.Items.Add('-') | Out-Null

$itemSsh = $menu.Items.Add('Buka SSH Terminal')
$itemSsh.add_Click({
    Start-Process wt -ArgumentList "ssh ${SSH_USER}@${SSH_HOST} -p ${SSH_PORT}" -ErrorAction SilentlyContinue
    if (-not $?) { Start-Process powershell -ArgumentList "-NoExit","-Command","ssh ${SSH_USER}@${SSH_HOST} -p ${SSH_PORT}" }
})

$menu.Items.Add('-') | Out-Null

$itemExit = $menu.Items.Add('Keluar')
$itemExit.add_Click({ $notify.Visible = $false; $notify.Dispose(); [System.Windows.Forms.Application]::Exit() })

$notify.ContextMenuStrip = $menu

function Update-Status {
    $vm = Get-VmState
    $ssh = if (Test-Ssh) { 'SSH: OK' } else { 'SSH: belum siap' }
    $itemState.Text = "VM: $vm | $ssh"
    $notify.Text = "SPSM VM — $vm"
}

Update-Status

# Refresh status tiap 10 detik
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 10000
$timer.add_Tick({ Update-Status })
$timer.Start()

[System.Windows.Forms.Application]::Run()
