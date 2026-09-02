from pathlib import Path
import shutil

BASE = Path(__file__).resolve().parent
db = BASE / "bookkeep_v13.db"
files = BASE / "evidence_files_v13"

if db.exists():
    db.unlink()

if files.exists():
    shutil.rmtree(files)

print("BookKeep v13 backend storage wiped clean.")
