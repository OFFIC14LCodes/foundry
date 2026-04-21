Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-SquareIconPng {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,
        [Parameter(Mandatory = $true)]
        [int]$SourceX,
        [Parameter(Mandatory = $true)]
        [int]$SourceY,
        [Parameter(Mandatory = $true)]
        [int]$CropSize,
        [Parameter(Mandatory = $true)]
        [int]$OutputSize,
        [Parameter(Mandatory = $true)]
        [string]$OutputPath
    )

    $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
    try {
        $cropRect = New-Object System.Drawing.Rectangle($SourceX, $SourceY, $CropSize, $CropSize)
        $target = New-Object System.Drawing.Bitmap($OutputSize, $OutputSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($target)
            try {
                $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.Clear([System.Drawing.Color]::Transparent)

                $path = New-Object System.Drawing.Drawing2D.GraphicsPath
                try {
                    $inset = [Math]::Max(1, [Math]::Round($OutputSize * 0.03))
                    $diameter = $OutputSize - ($inset * 2)
                    $path.AddEllipse($inset, $inset, $diameter, $diameter)
                    $graphics.SetClip($path)
                    $graphics.DrawImage(
                        $source,
                        (New-Object System.Drawing.Rectangle(0, 0, $OutputSize, $OutputSize)),
                        $cropRect,
                        [System.Drawing.GraphicsUnit]::Pixel
                    )
                } finally {
                    $path.Dispose()
                }
            } finally {
                $graphics.Dispose()
            }

            $target.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $target.Dispose()
        }
    } finally {
        $source.Dispose()
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $repoRoot "public"
$sourcePath = Join-Path $publicDir "foundry-logo-source.png"

# Portrait source is 1024x1536. This tighter crop centers the flame and lets it read larger in app icons.
$cropSize = 760
$sourceX = 145
$sourceY = 210

New-SquareIconPng -SourcePath $sourcePath -SourceX $sourceX -SourceY $sourceY -CropSize $cropSize -OutputSize 512 -OutputPath (Join-Path $publicDir "icon-512.png")
New-SquareIconPng -SourcePath $sourcePath -SourceX $sourceX -SourceY $sourceY -CropSize $cropSize -OutputSize 192 -OutputPath (Join-Path $publicDir "icon-192.png")
New-SquareIconPng -SourcePath $sourcePath -SourceX $sourceX -SourceY $sourceY -CropSize $cropSize -OutputSize 180 -OutputPath (Join-Path $publicDir "apple-touch-icon.png")
New-SquareIconPng -SourcePath $sourcePath -SourceX $sourceX -SourceY $sourceY -CropSize $cropSize -OutputSize 32 -OutputPath (Join-Path $publicDir "favicon-32x32.png")
