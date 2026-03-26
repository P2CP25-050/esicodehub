import os
import magic
from rest_framework import serializers


def validate_code_file(file):
    """
    Validates that the uploaded file is safe and text-based.
    Blacklist: rejects known executable/harmful extensions
    MIME check: rejects anything that isn't text-based or a known code type
    """
    # Reject known dangerous executable
    dangerous_extensions = [
        '.exe', '.dll', '.so', '.dylib', '.bin',
        '.bat', '.cmd', '.ps1', '.vbs',
    ]
    ext = os.path.splitext(file.name)[1].lower()
    if ext in dangerous_extensions:
        raise serializers.ValidationError(
            f"File type {ext} is not allowed."
        )

    # Read first 2048 bytes to determine the real MIME type
    file_content = file.read(2048)
    # reset pointer of the file to read it later
    file.seek(0)

    mime_type = magic.from_buffer(file_content, mime=True)

    # text/* covers most programming languages
    valid_mime_prefixes = ['text/']

    # Exceptions that use application/* instead of text/*
    valid_mime_exact = [
        'application/javascript',    # .js
        'application/json',          # .json
        'application/typescript',    # .ts
        'application/x-php',         # .php
    ]

    is_valid_mime = (
        any(mime_type.startswith(prefix) for prefix in valid_mime_prefixes)
        or mime_type in valid_mime_exact
    )
    # If the MIME is not in the list it is mostly a Trojan hourse
    if not is_valid_mime:
        raise serializers.ValidationError(
            f"Security Error: File content type ({mime_type}) is not allowed."
        )

    return file
