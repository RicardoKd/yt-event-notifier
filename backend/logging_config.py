import logging
import os
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path


def setup_logging(level: int = logging.INFO, profile: str = "prod") -> None:
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")

    root = logging.getLogger()
    if root.handlers:
        return  # already configured
    root.setLevel(level)

    stream = logging.StreamHandler()
    stream.setFormatter(fmt)
    root.addHandler(stream)

    log_file = os.getenv("LOG_FILE", "logs/app.log")

    # Local logging
    Path(log_file).parent.mkdir(parents=True, exist_ok=True)
    file_handler = TimedRotatingFileHandler(
        filename=log_file,
        when="midnight",
        backupCount=7,
        encoding="utf-8",
    )
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)
