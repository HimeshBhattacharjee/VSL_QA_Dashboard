"""
Path utilities for QC project.
Provides repository-relative path resolution for QC_Data and other resources.
"""

import os
from pathlib import Path


def get_project_root() -> Path:
    """Get the project root directory (parent of QC_Backend)."""
    # This file is in QC_Backend/, so go up one level
    current_file = Path(__file__).resolve()
    return current_file.parent.parent


def get_qc_data_path(*subpaths: str) -> Path:
    """
    Get path to QC_Data directory or subdirectory.

    Args:
        *subpaths: Additional path components under QC_Data

    Examples:
        get_qc_data_path() -> Path to QC_Data/
        get_qc_data_path("Excel", "Peel_Test.xlsx") -> Path to QC_Data/Excel/Peel_Test.xlsx
        get_qc_data_path("Templates", "audit_template.xlsx") -> Path to QC_Data/Templates/audit_template.xlsx
    """
    return get_project_root() / "QC_Data" / Path(*subpaths)


def get_excel_path(filename: str) -> Path:
    """Get path to Excel file in QC_Data/Excel/ directory."""
    return get_qc_data_path("Excel", filename)


def get_template_path(filename: str) -> Path:
    """Get path to template file in QC_Data/Templates/ directory."""
    return get_qc_data_path("Templates", filename)


def get_reference_file_path(filename: str) -> Path:
    """Get path to reference file in QC_Data/Reference_Files/ directory."""
    return get_qc_data_path("Reference_Files", filename)


def ensure_qc_data_structure():
    """Ensure the required QC_Data folder structure exists."""
    directories = [
        get_qc_data_path("Excel"),
        get_qc_data_path("Templates"),
        get_qc_data_path("Reference_Files")
    ]

    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)