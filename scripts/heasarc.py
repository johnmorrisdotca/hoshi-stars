"""NASA HEASARC's whole-table downloads (the heasarc_<table>.tdat.gz files), by the route HEASARC documents for scripts.

https://heasarc.gsfc.nasa.gov/robots.txt disallows /FTP/ (and /cgi-bin/, /xamin, /vo/) to robots, so no script here fetches a table from the website's /FTP/ path.
HEASARC's page "Command-line access to HEASARC data holdings" (https://heasarc.gsfc.nasa.gov/docs/cookbook/command_line_downloads.html, last updated 13-Nov-2025,
read 2026-11-21) says: "To replace the old anonymous FTP, HEASARC will support explicit, passive-mode FTPS connections." That is this route: anonymous explicit FTPS to
heasarc.gsfc.nasa.gov. The files are the same bytes as the website's /FTP/ copies (same size and modification time; the SAO file's SHA-256 and the unpacked Yale table's
SHA-256 match the ones this package recorded earlier).

Each script loads this file by its path (they run as `python3 -I`, which keeps their own folder off the import path):

    spec = importlib.util.spec_from_file_location("heasarc", Path(__file__).resolve().parent / "heasarc.py")
"""

import ftplib
from urllib.parse import urlsplit

HEASARC_TABLES = "ftps://heasarc.gsfc.nasa.gov/heasarc/dbase/tdat_files/"


def fetch_table(name: str, timeout: int = 600) -> bytes:
    """The bytes of HEASARC's heasarc_<name>.tdat.gz, over anonymous explicit FTPS (passive mode, the data connection encrypted)."""
    url = urlsplit(f"{HEASARC_TABLES}heasarc_{name}.tdat.gz")
    ftp = ftplib.FTP_TLS(timeout=timeout)
    ftp.connect(url.hostname, url.port or 21)
    ftp.login()
    ftp.prot_p()
    parts = []
    ftp.retrbinary(f"RETR {url.path}", parts.append)
    ftp.quit()
    return b"".join(parts)
