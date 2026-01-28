# Vox Whisper Setup Script for Windows
# Requires: Git, CMake, Visual Studio Build Tools (with C++ workload)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$TauriDir = Join-Path $ProjectRoot "src-tauri"
$BinariesDir = Join-Path $TauriDir "binaries"
$ModelsDir = Join-Path $TauriDir "resources\models"

# Detect architecture
$Arch = [System.Environment]::GetEnvironmentVariable("PROCESSOR_ARCHITECTURE")
if ($Arch -eq "AMD64") {
    $TargetTriple = "x86_64-pc-windows-msvc"
} elseif ($Arch -eq "ARM64") {
    $TargetTriple = "aarch64-pc-windows-msvc"
} else {
    Write-Error "Unsupported architecture: $Arch"
    exit 1
}

Write-Host "=== Vox Whisper Setup ===" -ForegroundColor Cyan
Write-Host "Architecture: $Arch ($TargetTriple)"
Write-Host ""

# Create directories
New-Item -ItemType Directory -Force -Path $BinariesDir | Out-Null
New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null

# Check if whisper binary already exists
$WhisperBinary = Join-Path $BinariesDir "whisper-$TargetTriple.exe"
if (Test-Path $WhisperBinary) {
    Write-Host "Whisper binary already exists at $WhisperBinary" -ForegroundColor Green
} else {
    Write-Host "Building whisper.cpp..." -ForegroundColor Yellow

    # Create temp directory
    $TempDir = Join-Path $env:TEMP "whisper-build-$(Get-Random)"
    New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
    Set-Location $TempDir

    try {
        # Clone whisper.cpp
        Write-Host "Cloning whisper.cpp..."
        git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git
        Set-Location whisper.cpp

        # Build with CMake
        Write-Host "Compiling whisper.cpp (this may take a moment)..."
        cmake -B build `
            -DBUILD_SHARED_LIBS=OFF `
            -DWHISPER_BUILD_TESTS=OFF `
            -DWHISPER_BUILD_EXAMPLES=ON `
            -DCMAKE_BUILD_TYPE=Release
        cmake --build build --config Release

        # Copy binary
        $BuiltBinary = Join-Path $TempDir "whisper.cpp\build\bin\Release\whisper-cli.exe"
        if (-not (Test-Path $BuiltBinary)) {
            # Try alternative path
            $BuiltBinary = Join-Path $TempDir "whisper.cpp\build\bin\whisper-cli.exe"
        }

        if (Test-Path $BuiltBinary) {
            Copy-Item $BuiltBinary $WhisperBinary
            Write-Host "Whisper binary built and installed at $WhisperBinary" -ForegroundColor Green
        } else {
            Write-Error "Could not find built whisper-cli binary"
        }
    } finally {
        # Cleanup
        Set-Location $ProjectRoot
        Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
    }
}

# Download model
$ModelFile = Join-Path $ModelsDir "ggml-base.bin"
if (Test-Path $ModelFile) {
    Write-Host "Model already exists at $ModelFile" -ForegroundColor Green
} else {
    Write-Host "Downloading ggml-base.bin model (~142MB)..." -ForegroundColor Yellow
    $ModelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"

    # Use Invoke-WebRequest with progress
    $ProgressPreference = 'Continue'
    Invoke-WebRequest -Uri $ModelUrl -OutFile $ModelFile -UseBasicParsing

    Write-Host "Model downloaded to $ModelFile" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Binary: $WhisperBinary"
Write-Host "Model: $ModelFile"
Write-Host ""
Write-Host "You can now run: pnpm tauri dev" -ForegroundColor Green
