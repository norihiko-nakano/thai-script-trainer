#!/usr/bin/env python3
"""Compatibility entrypoint for the verified Ver7.0 staged pipeline."""
import runpy
from pathlib import Path
if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).parent / "scripts" / "update_news.py"), run_name="__main__")
