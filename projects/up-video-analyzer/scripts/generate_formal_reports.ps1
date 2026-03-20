param(
    [string]$ThemeName = ""
)

$ErrorActionPreference = "Stop"

function Read-SourceContent {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        return ""
    }
    $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    if ($ext -eq ".json") {
        $raw = Get-Content -Path $Path -Raw -Encoding UTF8
        try {
            return (($raw | ConvertFrom-Json) | ConvertTo-Json -Depth 100)
        } catch {
            return $raw
        }
    }
    return Get-Content -Path $Path -Raw -Encoding UTF8
}

function ConvertToCnSafe {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    $t = $Text
    $t = $t -replace '(?s)```.*?```', ''
    $t = $t -replace '(?m)^\s*`{3,}.*$', ''
    $t = $t -replace '(?m)^\s{0,3}#{1,6}\s*', ''
    $t = $t -replace '(?m)^\s*>\s*', ''
    $t = $t -replace '(?m)^\s*[-*+]\s+\[[xX ]\]\s*', ''
    $t = $t -replace '(?m)^\s*[-*+]\s+', ''
    $t = $t -replace '(?m)^\s*\d+[.)]\s+', ''
    $t = $t -replace '!\[([^\]]*)\]\([^)]+\)', '$1'
    $t = $t -replace '\[([^\]]+)\]\([^)]+\)', '$1'
    $t = $t -replace '`([^`]+)`', '$1'
    $t = $t -replace '(?m)^\s*[-*_]{3,}\s*$', ''
    $t = $t -replace '(?m)^\s*\|?[-:\s|]+\|?\s*$', ''
    $t = $t -replace '\|', ([string][char]0xFF0C)
    $t = $t -replace "[\*_~]+", ""
    $t = $t -replace "(?m)^\s*[#>]+\s*", ""
    $t = $t -replace "(?m)^\s*[-*+]\s+", ""
    $t = $t -replace "(?m)^\s*\d+[.)]\s*", ""
    $t = $t -replace "(?m)^\s*(\d+\.){2,}\d*\s*", ""
    $t = $t -replace "UI", ""
    $t = $t -replace "ER", ""
    $t = $t -replace "PRD", ""
    $t = $t -replace "PDF", ""
    $t = $t -replace "PPT", ""
    $t = $t -replace "[A-Za-z]+", ""
    $t = $t -replace "(?m)^\s+$", ""
    $doubleBreak = [Environment]::NewLine + [Environment]::NewLine
    $t = $t -replace "(\r?\n){3,}", $doubleBreak
    return $t
}

function New-TextFromCodePoints {
    param([int[]]$CodePoints)
    if ($null -eq $CodePoints -or $CodePoints.Count -eq 0) { return "" }
    $chars = $CodePoints | ForEach-Object { [char]$_ }
    return (-join $chars)
}

function Get-OfficeColorFromHex {
    param([string]$HexColor)
    $hex = ($HexColor -replace "#", "").Trim()
    if ($hex.Length -ne 6) { return 0 }
    $r = [Convert]::ToInt32($hex.Substring(0, 2), 16)
    $g = [Convert]::ToInt32($hex.Substring(2, 2), 16)
    $b = [Convert]::ToInt32($hex.Substring(4, 2), 16)
    return ($r + ($g * 256) + ($b * 65536))
}

function Get-ReportThemeProfile {
    param(
        [string]$SelectedThemeName,
        [string]$CatalogPath
    )
    $defaultProfile = [pscustomobject]@{
        name               = "Tech Innovation"
        displayName        = "Tech Innovation"
        titleFont          = "Microsoft YaHei"
        bodyFont           = "Microsoft YaHei"
        coverBackground    = "#028090"
        contentBackground  = "#E8FBF7"
        titleColor         = "#FFFFFF"
        contentTitleColor  = "#065A82"
        bodyColor          = "#1F3C4A"
        accentColor        = "#02C39A"
    }
    if (-not (Test-Path $CatalogPath)) { return $defaultProfile }
    try {
        $catalogRaw = Get-Content -Path $CatalogPath -Raw -Encoding UTF8
        $catalog = $catalogRaw | ConvertFrom-Json
        $themeList = @($catalog.themes)
        if ($themeList.Count -eq 0) { return $defaultProfile }
        $targetName = $SelectedThemeName
        if ([string]::IsNullOrWhiteSpace($targetName)) { $targetName = $catalog.defaultTheme }
        $selected = $themeList | Where-Object { $_.name -eq $targetName } | Select-Object -First 1
        if ($null -eq $selected) { $selected = $themeList | Select-Object -First 1 }
        return $selected
    } catch {
        return $defaultProfile
    }
}

function Build-ReportText {
    param(
        [string]$ReportTitle,
        [array]$Sources
    )
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine($ReportTitle)
    [void]$sb.AppendLine("")
    foreach ($item in $Sources) {
        [void]$sb.AppendLine("========================================")
        [void]$sb.AppendLine((ConvertToCnSafe -Text (Read-SourceContent -Path $item.Path)))
        [void]$sb.AppendLine("")
    }
    return $sb.ToString()
}

function Apply-WordTheme {
    param(
        [object]$Doc,
        [object]$ThemeProfile
    )
    $bodyColor = Get-OfficeColorFromHex -HexColor $ThemeProfile.bodyColor
    $titleColor = Get-OfficeColorFromHex -HexColor $ThemeProfile.contentTitleColor
    $accentColor = Get-OfficeColorFromHex -HexColor $ThemeProfile.accentColor
    $contentBgColor = Get-OfficeColorFromHex -HexColor $ThemeProfile.contentBackground
    $Doc.Content.Font.Name = $ThemeProfile.bodyFont
    $Doc.Content.Font.NameFarEast = $ThemeProfile.bodyFont
    $Doc.Content.Font.Size = 12
    $Doc.Content.Font.Color = $bodyColor
    $Doc.Content.Shading.BackgroundPatternColor = $contentBgColor
    if ($Doc.Paragraphs.Count -ge 1) {
        $titleRange = $Doc.Paragraphs.Item(1).Range
        $titleRange.Font.Name = $ThemeProfile.titleFont
        $titleRange.Font.NameFarEast = $ThemeProfile.titleFont
        $titleRange.Font.Size = 24
        $titleRange.Font.Bold = -1
        $titleRange.Font.Color = $titleColor
    }
    for ($index = 1; $index -le $Doc.Paragraphs.Count; $index++) {
        $paragraphRange = $Doc.Paragraphs.Item($index).Range
        $paragraphText = $paragraphRange.Text.Trim()
        if ($paragraphText -match "^={10,}$") {
            $paragraphRange.Font.Color = $accentColor
            $paragraphRange.Font.Size = 10
        }
    }
}

function Save-WordPdfWithImages {
    param(
        [string]$TextContent,
        [array]$ImageItems,
        [string]$DocPath,
        [string]$DocxPath,
        [string]$PdfPath,
        [object]$ThemeProfile
    )
    $word = $null
    $doc = $null
    $tempDoc = $null
    $tempDocx = $null
    $tempPdf = $null
    try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false
        $doc = $word.Documents.Add()
        $selection = $word.Selection
        $selection.TypeText($TextContent)
        $selection.TypeParagraph()
        Apply-WordTheme -Doc $doc -ThemeProfile $ThemeProfile
        foreach ($img in $ImageItems) {
            if (Test-Path $img.Path) {
                $selection.TypeText((ConvertToCnSafe -Text $img.Title))
                $selection.TypeParagraph()
                $selection.InlineShapes.AddPicture($img.Path) | Out-Null
                $selection.TypeParagraph()
                $selection.TypeParagraph()
            }
        }
        $tempToken = [Guid]::NewGuid().ToString("N")
        $outputDir = Split-Path -Parent $DocPath
        $tempDoc = Join-Path $outputDir ("report_" + $tempToken + ".doc")
        $tempDocx = Join-Path $outputDir ("report_" + $tempToken + ".docx")
        $tempPdf = Join-Path $outputDir ("report_" + $tempToken + ".pdf")
        $doc.SaveAs2($tempDoc, 0)
        $doc.SaveAs2($tempDocx, 16)
        $doc.ExportAsFixedFormat($tempPdf, 17)
    } finally {
        if ($doc -ne $null) { try { $doc.Close() | Out-Null } catch {} }
        if ($word -ne $null) { try { $word.Quit() | Out-Null } catch {} }
    }
    if (Test-Path $DocPath) { Remove-Item -Path $DocPath -Force }
    if (Test-Path $DocxPath) { Remove-Item -Path $DocxPath -Force }
    if (Test-Path $PdfPath) { Remove-Item -Path $PdfPath -Force }
    if ($tempDoc -ne $null -and (Test-Path $tempDoc)) { Move-Item -Path $tempDoc -Destination $DocPath -Force }
    if ($tempDocx -ne $null -and (Test-Path $tempDocx)) { Move-Item -Path $tempDocx -Destination $DocxPath -Force }
    if ($tempPdf -ne $null -and (Test-Path $tempPdf)) { Move-Item -Path $tempPdf -Destination $PdfPath -Force }
}

function Split-TextChunks {
    param(
        [string]$Text,
        [int]$MaxLines = 12
    )
    $lines = ($Text -split "`r?`n")
    $chunks = @()
    for ($i = 0; $i -lt $lines.Count; $i += $MaxLines) {
        $end = [Math]::Min($i + $MaxLines - 1, $lines.Count - 1)
        $chunk = ($lines[$i..$end] -join "`r`n").Trim()
        if ($chunk.Length -gt 0) { $chunks += $chunk }
    }
    if ($chunks.Count -eq 0) { $chunks += ([string][char]0x3002) }
    return ,$chunks
}

function Get-ChunkLines {
    param([string]$ChunkText)
    $lines = @()
    if ([string]::IsNullOrWhiteSpace($ChunkText)) { return ,$lines }
    foreach ($line in ($ChunkText -split "`r?`n")) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -gt 0) { $lines += $trimmed }
    }
    return ,$lines
}

function Get-TextPreview {
    param(
        [string]$Text,
        [int]$MaxLength = 32
    )
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    if ($Text.Length -le $MaxLength) { return $Text }
    return $Text.Substring(0, $MaxLength)
}

function Build-BulletText {
    param([array]$Lines)
    if ($null -eq $Lines -or $Lines.Count -eq 0) { return "" }
    $bullet = [string][char]0x2022
    $buffer = New-Object System.Text.StringBuilder
    foreach ($line in $Lines) {
        [void]$buffer.AppendLine(($bullet + " " + $line))
    }
    return $buffer.ToString().Trim()
}

function Save-PptxWithImages {
    param(
        [string]$ReportTitle,
        [array]$Sources,
        [array]$ImageItems,
        [string]$PptxPath,
        [object]$ThemeProfile
    )
    $pp = $null
    $presentation = $null
    try {
        $pp = New-Object -ComObject PowerPoint.Application
        $pp.Visible = -1
        $pp.DisplayAlerts = 1
        $presentation = $pp.Presentations.Add()
        $coverBgColor = Get-OfficeColorFromHex -HexColor $ThemeProfile.coverBackground
        $contentBgColor = Get-OfficeColorFromHex -HexColor $ThemeProfile.contentBackground
        $titleColor = Get-OfficeColorFromHex -HexColor $ThemeProfile.titleColor
        $contentTitleColor = Get-OfficeColorFromHex -HexColor $ThemeProfile.contentTitleColor
        $bodyColor = Get-OfficeColorFromHex -HexColor $ThemeProfile.bodyColor
        $slideIndex = 1
        $titleSlide = $presentation.Slides.Add($slideIndex, 1)
        $titleSlide.FollowMasterBackground = $false
        $titleSlide.Background.Fill.Solid()
        $titleSlide.Background.Fill.ForeColor.RGB = $coverBgColor
        $titleSlide.Shapes.Title.TextFrame.TextRange.Text = $ReportTitle
        $titleSlide.Shapes.Title.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.titleFont
        $titleSlide.Shapes.Title.TextFrame.TextRange.Font.Name = $ThemeProfile.titleFont
        $titleSlide.Shapes.Title.TextFrame.TextRange.Font.Bold = -1
        $titleSlide.Shapes.Title.TextFrame.TextRange.Font.Size = 42
        $titleSlide.Shapes.Title.TextFrame.TextRange.Font.Color.RGB = $titleColor
        $titleSlide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        $titleSlide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.bodyFont
        $titleSlide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Font.Name = $ThemeProfile.bodyFont
        $titleSlide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Font.Size = 16
        $titleSlide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Font.Color.RGB = $titleColor
        $slideIndex++
        foreach ($item in $Sources) {
            $content = Read-SourceContent -Path $item.Path
            $chunks = Split-TextChunks -Text (ConvertToCnSafe -Text $content) -MaxLines 10
            for ($i = 0; $i -lt $chunks.Count; $i++) {
                $layoutMode = $i % 3
                if ($layoutMode -eq 0) {
                    $slide = $presentation.Slides.Add($slideIndex, 2)
                    $slide.FollowMasterBackground = $false
                    $slide.Background.Fill.Solid()
                    $slide.Background.Fill.ForeColor.RGB = $contentBgColor
                    $slide.Shapes.Title.TextFrame.TextRange.Text = (ConvertToCnSafe -Text $item.Title)
                    $slide.Shapes.Title.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.titleFont
                    $slide.Shapes.Title.TextFrame.TextRange.Font.Name = $ThemeProfile.titleFont
                    $slide.Shapes.Title.TextFrame.TextRange.Font.Bold = -1
                    $slide.Shapes.Title.TextFrame.TextRange.Font.Size = 30
                    $slide.Shapes.Title.TextFrame.TextRange.Font.Color.RGB = $contentTitleColor
                    $slide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = $chunks[$i]
                    $slide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.bodyFont
                    $slide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Font.Name = $ThemeProfile.bodyFont
                    $slide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Font.Size = 18
                    $slide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Font.Color.RGB = $bodyColor
                } elseif ($layoutMode -eq 1) {
                    $slide = $presentation.Slides.Add($slideIndex, 12)
                    $slide.FollowMasterBackground = $false
                    $slide.Background.Fill.Solid()
                    $slide.Background.Fill.ForeColor.RGB = $contentBgColor
                    $titleBox = $slide.Shapes.AddTextbox(1, 40, 22, 840, 52)
                    $titleBox.TextFrame.TextRange.Text = (ConvertToCnSafe -Text $item.Title)
                    $titleBox.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.titleFont
                    $titleBox.TextFrame.TextRange.Font.Name = $ThemeProfile.titleFont
                    $titleBox.TextFrame.TextRange.Font.Size = 32
                    $titleBox.TextFrame.TextRange.Font.Bold = -1
                    $titleBox.TextFrame.TextRange.Font.Color.RGB = $contentTitleColor
                    $leftCard = $slide.Shapes.AddShape(1, 40, 90, 430, 410)
                    $leftCard.Fill.Solid()
                    $leftCard.Fill.ForeColor.RGB = 16777215
                    $leftCard.Line.ForeColor.RGB = $contentTitleColor
                    $rightCard = $slide.Shapes.AddShape(1, 500, 90, 380, 410)
                    $rightCard.Fill.Solid()
                    $rightCard.Fill.ForeColor.RGB = $contentTitleColor
                    $rightCard.Line.Visible = 0
                    $lines = Get-ChunkLines -ChunkText $chunks[$i]
                    $leftText = Build-BulletText -Lines $lines
                    $leftCard.TextFrame.TextRange.Text = $leftText
                    $leftCard.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.bodyFont
                    $leftCard.TextFrame.TextRange.Font.Name = $ThemeProfile.bodyFont
                    $leftCard.TextFrame.TextRange.Font.Size = 18
                    $leftCard.TextFrame.TextRange.Font.Color.RGB = $bodyColor
                    $summaryTitle = New-TextFromCodePoints -CodePoints @(0x5185,0x5BB9,0x63D0,0x8981)
                    $summaryText = New-TextFromCodePoints -CodePoints @(0x91CD,0x70B9,0x7ED3,0x8BBA)
                    $summaryBody = Get-TextPreview -Text ($lines -join " ") -MaxLength 52
                    $rightCard.TextFrame.TextRange.Text = ($summaryTitle + "`r`n`r`n" + $summaryText + "`r`n" + $summaryBody)
                    $rightCard.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.bodyFont
                    $rightCard.TextFrame.TextRange.Font.Name = $ThemeProfile.bodyFont
                    $rightCard.TextFrame.TextRange.Font.Size = 20
                    $rightCard.TextFrame.TextRange.Font.Color.RGB = $titleColor
                } else {
                    $slide = $presentation.Slides.Add($slideIndex, 12)
                    $slide.FollowMasterBackground = $false
                    $slide.Background.Fill.Solid()
                    $slide.Background.Fill.ForeColor.RGB = $contentBgColor
                    $banner = $slide.Shapes.AddShape(1, 0, 0, 960, 86)
                    $banner.Fill.Solid()
                    $banner.Fill.ForeColor.RGB = $contentTitleColor
                    $banner.Line.Visible = 0
                    $banner.TextFrame.TextRange.Text = (ConvertToCnSafe -Text $item.Title)
                    $banner.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.titleFont
                    $banner.TextFrame.TextRange.Font.Name = $ThemeProfile.titleFont
                    $banner.TextFrame.TextRange.Font.Size = 30
                    $banner.TextFrame.TextRange.Font.Bold = -1
                    $banner.TextFrame.TextRange.Font.Color.RGB = $titleColor
                    $lines = Get-ChunkLines -ChunkText $chunks[$i]
                    $leftLines = @()
                    $rightLines = @()
                    for ($lineIndex = 0; $lineIndex -lt $lines.Count; $lineIndex++) {
                        if ($lineIndex % 2 -eq 0) { $leftLines += $lines[$lineIndex] } else { $rightLines += $lines[$lineIndex] }
                    }
                    $leftBox = $slide.Shapes.AddShape(1, 40, 120, 420, 360)
                    $leftBox.Fill.Solid()
                    $leftBox.Fill.ForeColor.RGB = 16777215
                    $leftBox.Line.ForeColor.RGB = $contentTitleColor
                    $leftBox.TextFrame.TextRange.Text = (Build-BulletText -Lines $leftLines)
                    $leftBox.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.bodyFont
                    $leftBox.TextFrame.TextRange.Font.Name = $ThemeProfile.bodyFont
                    $leftBox.TextFrame.TextRange.Font.Size = 18
                    $leftBox.TextFrame.TextRange.Font.Color.RGB = $bodyColor
                    $rightBox = $slide.Shapes.AddShape(1, 500, 120, 420, 360)
                    $rightBox.Fill.Solid()
                    $rightBox.Fill.ForeColor.RGB = 16777215
                    $rightBox.Line.ForeColor.RGB = $contentTitleColor
                    $rightBox.TextFrame.TextRange.Text = (Build-BulletText -Lines $rightLines)
                    $rightBox.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.bodyFont
                    $rightBox.TextFrame.TextRange.Font.Name = $ThemeProfile.bodyFont
                    $rightBox.TextFrame.TextRange.Font.Size = 18
                    $rightBox.TextFrame.TextRange.Font.Color.RGB = $bodyColor
                }
                $slideIndex++
            }
        }
        foreach ($img in $ImageItems) {
            if (Test-Path $img.Path) {
                $imageMode = $slideIndex % 2
                $slide = $presentation.Slides.Add($slideIndex, 12)
                $slide.FollowMasterBackground = $false
                $slide.Background.Fill.Solid()
                $slide.Background.Fill.ForeColor.RGB = $contentBgColor
                $titleBox = $slide.Shapes.AddTextbox(1, 40, 22, 880, 52)
                $titleBox.TextFrame.TextRange.Text = $img.Title
                $titleBox.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.titleFont
                $titleBox.TextFrame.TextRange.Font.Name = $ThemeProfile.titleFont
                $titleBox.TextFrame.TextRange.Font.Bold = -1
                $titleBox.TextFrame.TextRange.Font.Size = 30
                $titleBox.TextFrame.TextRange.Font.Color.RGB = $contentTitleColor
                if ($imageMode -eq 0) {
                    $slide.Shapes.AddPicture($img.Path, 0, -1, 40, 96, 580, 420) | Out-Null
                    $sidePanel = $slide.Shapes.AddShape(1, 650, 96, 260, 420)
                    $sidePanel.Fill.Solid()
                    $sidePanel.Fill.ForeColor.RGB = $contentTitleColor
                    $sidePanel.Line.Visible = 0
                    $sideTitle = New-TextFromCodePoints -CodePoints @(0x89C2,0x5BDF,0x91CD,0x70B9)
                    $sideText = New-TextFromCodePoints -CodePoints @(0x754C,0x9762,0x7ED3,0x6784,0x3001,0x64CD,0x4F5C,0x8DEF,0x5F84,0x3001,0x53CD,0x9988,0x72B6,0x6001)
                    $sidePanel.TextFrame.TextRange.Text = ($sideTitle + "`r`n`r`n" + $sideText)
                    $sidePanel.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.bodyFont
                    $sidePanel.TextFrame.TextRange.Font.Name = $ThemeProfile.bodyFont
                    $sidePanel.TextFrame.TextRange.Font.Size = 19
                    $sidePanel.TextFrame.TextRange.Font.Color.RGB = $titleColor
                } else {
                    $slide.Shapes.AddPicture($img.Path, 0, -1, 300, 96, 620, 420) | Out-Null
                    $leftPanel = $slide.Shapes.AddShape(1, 40, 96, 230, 420)
                    $leftPanel.Fill.Solid()
                    $leftPanel.Fill.ForeColor.RGB = 16777215
                    $leftPanel.Line.ForeColor.RGB = $contentTitleColor
                    $leftTitle = New-TextFromCodePoints -CodePoints @(0x8BBE,0x8BA1,0x4EAE,0x70B9)
                    $leftText = New-TextFromCodePoints -CodePoints @(0x7EC4,0x4EF6,0x5C42,0x6B21,0x6E05,0x6670,0x000D,0x000A,0x4FE1,0x606F,0x5F15,0x5BFC,0x76F4,0x89C2,0x000D,0x000A,0x8272,0x5F69,0x4E0E,0x7A7A,0x95F4,0x534F,0x8C03)
                    $leftPanel.TextFrame.TextRange.Text = ($leftTitle + "`r`n`r`n" + $leftText)
                    $leftPanel.TextFrame.TextRange.Font.NameFarEast = $ThemeProfile.bodyFont
                    $leftPanel.TextFrame.TextRange.Font.Name = $ThemeProfile.bodyFont
                    $leftPanel.TextFrame.TextRange.Font.Size = 18
                    $leftPanel.TextFrame.TextRange.Font.Color.RGB = $bodyColor
                }
                $slideIndex++
            }
        }
        $tempToken = [Guid]::NewGuid().ToString("N")
        $outputDir = Split-Path -Parent $PptxPath
        $tempPptx = Join-Path $outputDir ("presentation_" + $tempToken + ".pptx")
        $presentation.SaveAs($tempPptx)
    } finally {
        if ($presentation -ne $null) { try { $presentation.Close() | Out-Null } catch {} }
        if ($pp -ne $null) { try { $pp.Quit() | Out-Null } catch {} }
    }
    if (Test-Path $PptxPath) {
        try {
            Remove-Item -Path $PptxPath -Force -ErrorAction Stop
        } catch {
        }
    }
    if (Test-Path $tempPptx) {
        try {
            Move-Item -Path $tempPptx -Destination $PptxPath -Force -ErrorAction Stop
        } catch {
            $safePath = [System.IO.Path]::Combine($outputDir, ([System.IO.Path]::GetFileNameWithoutExtension($PptxPath) + "-新版.pptx"))
            if (Test-Path $safePath) { Remove-Item -Path $safePath -Force -ErrorAction SilentlyContinue }
            Move-Item -Path $tempPptx -Destination $safePath -Force
        }
    }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent (Split-Path -Parent $projectRoot)
$docsDir = Join-Path $projectRoot "docs"
$outDir = Join-Path $docsDir "reports"
if (-not (Test-Path $outDir)) { New-Item -Path $outDir -ItemType Directory | Out-Null }
$themeConfigPath = Join-Path $outDir "report_theme.json"
$themeCatalogPath = Join-Path $workspaceRoot ".trae\skills\stem-pbl-guide\artifacts\templates\report_theme_catalog.json"
$selectedThemeName = $ThemeName
if ([string]::IsNullOrWhiteSpace($selectedThemeName) -and (Test-Path $themeConfigPath)) {
    try {
        $themeConfigRaw = Get-Content -Path $themeConfigPath -Raw -Encoding UTF8
        $themeConfig = $themeConfigRaw | ConvertFrom-Json
        $selectedThemeName = $themeConfig.themeName
    } catch {
        $selectedThemeName = ""
    }
}
$themeProfile = Get-ReportThemeProfile -SelectedThemeName $selectedThemeName -CatalogPath $themeCatalogPath

$researchDir = Join-Path $docsDir "research"
$screenshotsDir = Join-Path (Join-Path $researchDir "assets") "screenshots"

$projectSources = @(
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x7AE0,0x8282,0x4E00)); Path = (Join-Path $researchDir "20_prd_design.md") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x7AE0,0x8282,0x4E8C)); Path = (Join-Path $researchDir "30_prototype_spec.md") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x7AE0,0x8282,0x4E09)); Path = (Join-Path $researchDir "40_tech_report.md") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x7AE0,0x8282,0x56DB)); Path = (Join-Path $researchDir "50_final_report.md") }
)

$researchSources = @(
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x7AE0,0x8282,0x4E00)); Path = (Join-Path $researchDir "10_proposal.md") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x7AE0,0x8282,0x4E8C)); Path = (Join-Path $researchDir "20_prd_design.md") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x7AE0,0x8282,0x4E09)); Path = (Join-Path $researchDir "30_prototype_spec.md") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x7AE0,0x8282,0x56DB)); Path = (Join-Path $researchDir "40_tech_report.md") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x7AE0,0x8282,0x4E94)); Path = (Join-Path $researchDir "50_final_report.md") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x7AE0,0x8282,0x516D)); Path = (Join-Path $researchDir "60_paper.md") }
)

$imageItems = @(
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x754C,0x9762,0x622A,0x56FE,0x4E00)); Path = (Join-Path $screenshotsDir "2026-03-18_homepage_ui.png") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x754C,0x9762,0x622A,0x56FE,0x4E8C)); Path = (Join-Path $screenshotsDir "2026-03-18_add_page_ui.png") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x754C,0x9762,0x622A,0x56FE,0x4E09)); Path = (Join-Path $screenshotsDir "2026-03-18_import_page_ui.png") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x754C,0x9762,0x622A,0x56FE,0x56DB)); Path = (Join-Path $screenshotsDir "2026-03-18_favorites_page_ui.png") },
    @{ Title = (New-TextFromCodePoints -CodePoints @(0x754C,0x9762,0x622A,0x56FE,0x4E94)); Path = (Join-Path $screenshotsDir "2026-03-18_stats_page_ui.png") }
)

$projectTitle = New-TextFromCodePoints -CodePoints @(0x9879,0x76EE,0x62A5,0x544A,0x6B63,0x5F0F,0x7248)
$researchTitle = New-TextFromCodePoints -CodePoints @(0x7814,0x5B66,0x62A5,0x544A,0x6B63,0x5F0F,0x7248)

$projectText = Build-ReportText -ReportTitle $projectTitle -Sources $projectSources
$researchText = Build-ReportText -ReportTitle $researchTitle -Sources $researchSources

$projectFileBase = New-TextFromCodePoints -CodePoints @(0x9879,0x76EE,0x62A5,0x544A,0x2D,0x6B63,0x5F0F,0x7248)
$researchFileBase = New-TextFromCodePoints -CodePoints @(0x7814,0x5B66,0x62A5,0x544A,0x2D,0x6B63,0x5F0F,0x7248)
$projectDoc = Join-Path $outDir ($projectFileBase + ".doc")
$projectDocx = Join-Path $outDir ($projectFileBase + ".docx")
$projectPdf = Join-Path $outDir ($projectFileBase + ".pdf")
$projectPptx = Join-Path $outDir ($projectFileBase + ".pptx")
$researchDoc = Join-Path $outDir ($researchFileBase + ".doc")
$researchDocx = Join-Path $outDir ($researchFileBase + ".docx")
$researchPdf = Join-Path $outDir ($researchFileBase + ".pdf")
$researchPptx = Join-Path $outDir ($researchFileBase + ".pptx")

Save-WordPdfWithImages -TextContent $projectText -ImageItems $imageItems -DocPath $projectDoc -DocxPath $projectDocx -PdfPath $projectPdf -ThemeProfile $themeProfile
Save-WordPdfWithImages -TextContent $researchText -ImageItems $imageItems -DocPath $researchDoc -DocxPath $researchDocx -PdfPath $researchPdf -ThemeProfile $themeProfile
Save-PptxWithImages -ReportTitle $projectTitle -Sources $projectSources -ImageItems $imageItems -PptxPath $projectPptx -ThemeProfile $themeProfile
Save-PptxWithImages -ReportTitle $researchTitle -Sources $researchSources -ImageItems $imageItems -PptxPath $researchPptx -ThemeProfile $themeProfile

Write-Output $projectDoc
Write-Output $projectDocx
Write-Output $projectPdf
Write-Output $projectPptx
Write-Output $researchDoc
Write-Output $researchDocx
Write-Output $researchPdf
Write-Output $researchPptx
