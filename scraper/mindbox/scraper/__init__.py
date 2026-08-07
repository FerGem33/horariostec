"""Mindbox data importer for HorariosTec."""

__all__ = ["MindboxClient", "ScrapeError", "scrape_semesters"]

from .client import MindboxClient, ScrapeError
from .pipeline import scrape_semesters
