#!/usr/bin/env bash
# organize-titan-media.sh — Move audiobook + courses to proper titan locations
# Run: bash organize-titan-media.sh
set -euo pipefail

SSH_HOST="${SSH_HOST:-titan.local}"
QBIT_URL="${QBIT_URL:-http://localhost:8080}"
QBIT_USER="${QBIT_USER:-admin}"
QBIT_PASS="${QBIT_PASS:-adminadmin}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Phase 0: Login to qBittorrent ──────────────────────────────────────────
info "Logging into qBittorrent API..."
SID=$(ssh "$SSH_HOST" "curl -s -c - '${QBIT_URL}/api/v2/auth/login' \
  --data-urlencode 'username=${QBIT_USER}' \
  --data-urlencode 'password=${QBIT_PASS}' | grep SID | awk '{print \$NF}'")

if [ -z "$SID" ]; then
  error "qBit login failed — check credentials"
  exit 1
fi
info "qBit login OK"

# ── Phase 1: Verify source files exist ─────────────────────────────────────
info "Checking what's on disk..."

ssh "$SSH_HOST" bash -s << 'CHECK'
echo "=== AUDIOBOOK SOURCES ==="
AUDIOBOOK_SRC="/data/torrents/mac/Allen Carr - Easyway to stop smoking - audiobook"
if [ -d "$AUDIOBOOK_SRC" ]; then
  echo "  FOUND: $AUDIOBOOK_SRC"
  du -sh "$AUDIOBOOK_SRC" 2>/dev/null || true
  ls "$AUDIOBOOK_SRC" | head -10
else
  echo "  NOT FOUND: $AUDIOBOOK_SRC (torrent has 0 bytes downloaded)"
fi

echo ""
echo "=== COURSE SOURCES ==="
COURSES=(
  "/data/torrents/mac/[Udemy] Prometheus | The Complete Hands-On for Monitoring & Alerting [2023, ENG]"
  "/data/torrents/mac/AWS Fundamentals Specialization 2023-8"
  "/data/torrents/mac/Coursera - Machine Learning Specialization by DeepLearning.AI"
  "/data/torrents/mac/[Coursera] Microsoft AI & ML Engineering Professional Certificate [10/2025, ENG]"
  "/data/torrents/mac/[Udemy, Maximilian Schwarzmüller, Manuel Lorenz] 100 Days Of Code - 2025 Web Development Bootcamp [1/2025, ENG]"
  "/data/torrents/mac/[Udemy, Dr. Angela Yu] 100 Days of Code: The Complete Python Pro Bootcamp [8/2025, ENG]"
  "/data/torrents/[Udemy, Ashutosh Pawar] The Ultimate Python Masterclass: Build 24 Python Projects [6/2025, ENG]"
)
for src in "${COURSES[@]}"; do
  if [ -d "$src" ]; then
    size=$(du -sh "$src" 2>/dev/null | cut -f1)
    echo "  FOUND ($size): $src"
  else
    echo "  NOT FOUND: $src"
  fi
done
CHECK

echo ""
read -rp "Proceed with moves? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  info "Aborted."
  exit 0
fi

# ── Phase 2: Create destination directories ────────────────────────────────
info "Creating destination directories..."

ssh "$SSH_HOST" bash -s << 'MKDIRS'
mkdir -p "/mnt/user/data/media/audiobooks/Allen Carr/The Easy Way To Stop Smoking"
mkdir -p "/mnt/user/Academy/Technology/AI & Machine Learning/Machine Learning Specialization"
mkdir -p "/mnt/user/Academy/Technology/AI & Machine Learning/Microsoft AI & ML Engineering Professional Certificate"
mkdir -p "/mnt/user/Academy/Technology/Cloud Computing/AWS Fundamentals Specialization"
mkdir -p "/mnt/user/Academy/Technology/DevOps/Prometheus - Complete Monitoring & Alerting"
mkdir -p "/mnt/user/Academy/Technology/Programming/100 Days of Code - Python Pro Bootcamp"
mkdir -p "/mnt/user/Academy/Technology/Programming/The Ultimate Python Masterclass"
mkdir -p "/mnt/user/Academy/Technology/Web Development/100 Days of Code - Web Development Bootcamp"
echo "  All directories created."
MKDIRS

# ── Phase 3: Move files ────────────────────────────────────────────────────
info "Moving files..."

ssh "$SSH_HOST" bash -s << 'MOVE'
set -e

# Audiobook
SRC="/data/torrents/mac/Allen Carr - Easyway to stop smoking - audiobook"
DST="/mnt/user/data/media/audiobooks/Allen Carr/The Easy Way To Stop Smoking"
if [ -d "$SRC" ]; then
  echo "  Moving audiobook: $SRC -> $DST"
  mv "$SRC"/* "$DST/" 2>/dev/null || echo "  (no files to move — torrent may be empty)"
  rmdir "$SRC" 2>/dev/null || true
  echo "  ✓ Audiobook moved"
else
  echo "  ⚠ Audiobook source not found — skipping"
fi

# Courses — associative array of source glob → destination
declare -A MOVES=(
  ["/data/torrents/mac/[Udemy] Prometheus | The Complete Hands-On for Monitoring & Alerting"*]="/mnt/user/Academy/Technology/DevOps/Prometheus - Complete Monitoring & Alerting/"
  ["/data/torrents/mac/AWS Fundamentals Specialization"*]="/mnt/user/Academy/Technology/Cloud Computing/AWS Fundamentals Specialization/"
  ["/data/torrents/mac/Coursera - Machine Learning Specialization"*]="/mnt/user/Academy/Technology/AI & Machine Learning/Machine Learning Specialization/"
  ["/data/torrents/mac/[Coursera] Microsoft AI & ML Engineering Professional Certificate"*]="/mnt/user/Academy/Technology/AI & Machine Learning/Microsoft AI & ML Engineering Professional Certificate/"
  ["/data/torrents/mac/[Udemy, Maximilian Schwarzmüller, Manuel Lorenz] 100 Days Of Code - 2025 Web Development Bootcamp"*]="/mnt/user/Academy/Technology/Web Development/100 Days of Code - Web Development Bootcamp/"
  ["/data/torrents/mac/[Udemy, Dr. Angela Yu] 100 Days of Code: The Complete Python Pro Bootcamp"*]="/mnt/user/Academy/Technology/Programming/100 Days of Code - Python Pro Bootcamp/"
  ["/data/torrents/[Udemy, Ashutosh Pawar] The Ultimate Python Masterclass"*]="/mnt/user/Academy/Technology/Programming/The Ultimate Python Masterclass/"
)

for src_glob in "${!MOVES[@]}"; do
  dst="${MOVES[$src_glob]}"
  # Expand glob
  for src_dir in $src_glob; do
    if [ -d "$src_dir" ]; then
      echo "  Moving: $(basename "$src_dir") -> $dst"
      mv "$src_dir"/* "$dst/" 2>/dev/null || echo "  (no files to move)"
      rmdir "$src_dir" 2>/dev/null || true
      echo "  ✓ Done"
    else
      echo "  ⚠ Not found: $src_glob — skipping"
    fi
    break  # only first glob match
  done
done
MOVE

# ── Phase 4: Update qBittorrent categories & torrent locations ────────────
info "Updating qBittorrent..."

ssh "$SSH_HOST" bash -s << 'QBIT'
SID=$(curl -s -c - 'http://localhost:8080/api/v2/auth/login' \
  --data-urlencode 'username=admin' \
  --data-urlencode 'password=adminadmin' | grep SID | awk '{print $NF}')

# Create "academy" category if not exists
echo "  Creating 'academy' category..."
curl -s "http://localhost:8080/api/v2/torrents/createCategory" \
  --cookie "SID=$SID" \
  --data-urlencode "category=academy" \
  --data-urlencode "savePath=/mnt/user/Academy" > /dev/null || true

# Update audiobooks category save path
echo "  Updating 'audiobooks' category save path..."
curl -s "http://localhost:8080/api/v2/torrents/editCategory" \
  --cookie "SID=$SID" \
  --data-urlencode "category=audiobooks" \
  --data-urlencode "savePath=/mnt/user/data/media/audiobooks" > /dev/null || true

echo "  Categories updated."
echo ""
echo "=== NOTE ==="
echo "To update individual torrent locations in qBit UI:"
echo "  Select torrent → Set Location → point to new path"
echo "Or use qBit API setLocation for each hash (see script source)."
QBIT

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
info "Done! Summary of changes:"
echo ""
echo "  Audiobook → /mnt/user/data/media/audiobooks/Allen Carr/The Easy Way To Stop Smoking/"
echo "  Courses   → /mnt/user/Academy/Technology/{subcategory}/{Course Name}/"
echo ""
info "Open qBittorrent at http://titan.local:8080 to update individual torrent save paths."
