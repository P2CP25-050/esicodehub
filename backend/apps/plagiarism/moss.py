import os
import mosspy

MOSS_USER_ID = int(os.getenv('MOSS_USER_ID', '0'))

EXTENSION_LANGUAGE_MAP = {
    'py':   'python',
    'c':    'c',
    'h':    'c',
    'cpp':  'cc',
    'cc':   'cc',
    'cxx':  'cc',
    'hpp':  'cc',
    'java': 'java',
    'js':   'javascript',
    'ts':   'javascript',
}

LANGUAGE_MOSS_ID = {
    'python':     'python',
    'c':          'c',
    'c++':        'cc',
    'java':       'java',
    'javascript': 'javascript',
}


def get_file_language(filename: str, assignment_languages: list[str]) -> str | None:
    """
    Returns the language identifier for a file if its extension matches
    one of the assignment's configured languages. Returns None if the file
    should be skipped (wrong extension, or unsupported type like .txt, .md, .css).
    """
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    lang = EXTENSION_LANGUAGE_MAP.get(ext)
    if not lang:
        return None
    # Check if this language is in the assignment's configured languages
    for assigned_lang in assignment_languages:
        if LANGUAGE_MOSS_ID.get(assigned_lang.lower()) == lang:
            return lang
    return None


def run_moss_for_language(
    language: str,
    file_entries: list[tuple[str, int]]  # list of (local_file_path, student_id)
) -> str:
    """
    Submit a group of files for one language to MOSS.
    Files are named {student_id}_{original_filename} so the parser can extract
    the student ID back from MOSS output.
    Returns the MOSS result URL.
    Raises RuntimeError if MOSS returns an empty URL.
    """
    if len(file_entries) < 2:
        raise ValueError(f"Need at least 2 files to run MOSS for {language}.")

    moss_lang = LANGUAGE_MOSS_ID.get(language)
    if not moss_lang:
        raise ValueError(f"Unsupported MOSS language: {language}")

    m = mosspy.Moss(MOSS_USER_ID, moss_lang)
    for local_path, _ in file_entries:
        m.addFile(local_path)

    url = m.send()
    if not url:
        raise RuntimeError(
            f"MOSS returned an empty URL for language '{language}'. "
            "This may indicate a network issue or that MOSS rejected the submission."
        )
    return url
