#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TAURI_DIR="$PROJECT_ROOT/src-tauri"
BINARIES_DIR="$TAURI_DIR/binaries"
MODELS_DIR="$TAURI_DIR/resources/models"

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    TARGET_TRIPLE="aarch64-apple-darwin"
elif [ "$ARCH" = "x86_64" ]; then
    TARGET_TRIPLE="x86_64-apple-darwin"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

echo "=== Everlast Whisper Setup ==="
echo "Architecture: $ARCH ($TARGET_TRIPLE)"
echo ""

# Create directories
mkdir -p "$BINARIES_DIR"
mkdir -p "$MODELS_DIR"

# Check if whisper binary already exists
WHISPER_BINARY="$BINARIES_DIR/whisper-$TARGET_TRIPLE"
if [ -f "$WHISPER_BINARY" ]; then
    echo "Whisper binary already exists at $WHISPER_BINARY"
else
    echo "Building whisper.cpp..."

    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"

    # Clone whisper.cpp
    echo "Cloning whisper.cpp..."
    git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git
    cd whisper.cpp

    # Build with static linking
    echo "Compiling whisper.cpp (this may take a moment)..."
    cmake -B build \
      -DBUILD_SHARED_LIBS=OFF \
      -DWHISPER_BUILD_TESTS=OFF \
      -DWHISPER_BUILD_EXAMPLES=ON \
      -DCMAKE_BUILD_TYPE=Release
    cmake --build build --config Release -j$(sysctl -n hw.ncpu)

    # Copy binary (whisper.cpp now builds to bin/whisper-cli)
    cp build/bin/whisper-cli "$WHISPER_BINARY"
    chmod +x "$WHISPER_BINARY"

    # Cleanup
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_DIR"

    echo "Whisper binary built and installed at $WHISPER_BINARY"
fi

# Download model
MODEL_FILE="$MODELS_DIR/ggml-base.bin"
if [ -f "$MODEL_FILE" ]; then
    echo "Model already exists at $MODEL_FILE"
else
    echo "Downloading ggml-base.bin model (~142MB)..."
    curl -L --progress-bar \
        -o "$MODEL_FILE" \
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
    echo "Model downloaded to $MODEL_FILE"
fi

echo ""
echo "=== Setup Complete ==="
echo "Binary: $WHISPER_BINARY"
echo "Model: $MODEL_FILE"
echo ""
echo "You can now run: pnpm tauri dev"
