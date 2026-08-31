#!/usr/bin/env python3
"""Convenience wrapper: run the full Ver6.3 news pipeline locally."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STAGES = ["fetch_news.py", "generate_news.py", "build_news_content.py"]


def main():
    for stage in STAGES:
        print(f"\n=== Ver6.3 stage: {stage} ===", flush=True)
        result = subprocess.run([sys.executable, str(HERE / stage)])
        if result.returncode != 0:
            print(f"Pipeline stopped at {stage}", file=sys.stderr)
            return result.returncode
    print("\nVer6.3 news pipeline completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
