import os
import magic
from rest_framework import serializers


SAFE_TEXT_EXTENSIONS = {
    '.c', '.cc', '.cpp', '.cs', '.css', '.csv', '.go', '.h', '.hpp', '.html', '.ini',
    '.java', '.js', '.json', '.jsx', '.kt', '.kts', '.md', '.php', '.py', '.rb', '.rs',
    '.scala', '.sh', '.sql', '.svg', '.swift', '.toml', '.ts', '.tsx', '.txt', '.xml',
    '.yaml', '.yml', '.zsh',
}

SAFE_TEXT_FILENAMES = {
    'dockerfile', '.env', '.gitignore', '.gitattributes', '.editorconfig', 'makefile',
}


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

    # Fallback for environments where libmagic can classify text files as
    # application/octet-stream. We allow known safe text/code filenames and
    # extensions if the sampled content is UTF-8 and contains no null bytes.
    file_name = os.path.basename(file.name).lower()
    looks_like_text_file = (
        ext in SAFE_TEXT_EXTENSIONS
        or file_name in SAFE_TEXT_FILENAMES
    )
    if not is_valid_mime and looks_like_text_file:
        sample = file.read(4096)
        file.seek(0)
        if b'\x00' not in sample:
            try:
                sample.decode('utf-8')
                is_valid_mime = True
            except UnicodeDecodeError:
                is_valid_mime = False

    # If the MIME is not in the list it is mostly a Trojan hourse
    if not is_valid_mime:
        raise serializers.ValidationError(
            f"Security Error: File content type ({mime_type}) is not allowed."
        )

    return file
