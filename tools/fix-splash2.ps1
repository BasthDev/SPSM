Add-Type -AssemblyName System.Drawing
$src = 'D:\S\src\assets\images\splash.png'
$dst = 'D:\S\src\assets\images\splash-fixed.png'
$img = [System.Drawing.Image]::FromFile($src)
Write-Output ("Source: {0}x{1} {2}" -f $img.Width, $img.Height, $img.PixelFormat)
$bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, 0, 0, $img.Width, $img.Height)
$g.Dispose()
$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
$bmp.Dispose()
Write-Output "Saved: $dst"
