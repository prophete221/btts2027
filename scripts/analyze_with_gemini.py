#!/usr/bin/env python3
"""Alias CLI — analyse stats→Gemini (voir enrich_predictions.py)."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).resolve().with_name("enrich_predictions.py")), run_name="__main__")
