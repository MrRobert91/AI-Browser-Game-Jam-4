param(
  [string]$OutputDirectory = "public/assets/audio/narrative"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$targetDirectory = Join-Path $projectRoot $OutputDirectory
New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null

Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synthesizer.SelectVoice("Microsoft Helena Desktop")
$synthesizer.Volume = 92

$narrative = Get-Content -Raw -Encoding utf8 (Join-Path $projectRoot "src/content/narrative.json") | ConvertFrom-Json
$introduction = Get-Content -Raw -Encoding utf8 (Join-Path $projectRoot "src/content/introduction.json") | ConvertFrom-Json
$records = Get-Content -Raw -Encoding utf8 (Join-Path $projectRoot "src/content/collapsador-records.json") | ConvertFrom-Json

$items = [System.Collections.Generic.List[object]]::new()
foreach ($property in $narrative.cues.PSObject.Properties) {
  $items.Add([pscustomobject]@{ Name = "cue-$($property.Name)"; Text = $property.Value.text; Rate = -1 })
}
foreach ($beat in $introduction) {
  $items.Add([pscustomobject]@{ Name = "intro-$($beat.id)"; Text = $beat.text; Rate = -1 })
}
$recordRates = @(0, -1, 1, 0)
for ($index = 0; $index -lt $records.Count; $index += 1) {
  $record = $records[$index]
  $items.Add([pscustomobject]@{ Name = "record-$($record.id)"; Text = $record.subtitle; Rate = $recordRates[$index] })
}

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("ultima-observacion-voices-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $temporaryRoot | Out-Null
try {
  foreach ($item in $items) {
    $wavPath = Join-Path $temporaryRoot "$($item.Name).wav"
    $mp3Path = Join-Path $targetDirectory "$($item.Name).mp3"
    $synthesizer.Rate = $item.Rate
    $synthesizer.SetOutputToWaveFile($wavPath)
    $synthesizer.Speak($item.Text)
    $synthesizer.SetOutputToNull()
    & ffmpeg -hide_banner -loglevel error -y -i $wavPath -af "highpass=f=90,lowpass=f=12000,loudnorm=I=-18:TP=-2:LRA=7" -ac 1 -ar 24000 -b:a 56k $mp3Path
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $($item.Name)" }
  }
} finally {
  $synthesizer.Dispose()
  if (Test-Path -LiteralPath $temporaryRoot) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
}

Write-Output "Generated $($items.Count) local narrative voices in $targetDirectory"
