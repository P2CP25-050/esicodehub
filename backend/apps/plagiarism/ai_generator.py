"""Gemini Flash integration for generating AI reference solutions."""

import os

import google.generativeai as genai

genai.configure(api_key=os.getenv('GEMINI_API_KEY', ''))

EXTENSION_MAP = {
    'python':     'py',
    'c':          'c',
    'c++':        'cpp',
    'java':       'java',
    'javascript': 'js',
}

STYLES = {
    'verbose': (
        "Write a complete, well-commented {language} solution for the following assignment. "
        "Use descriptive variable names, add docstrings, and explain each major step in"
        "comments.\n\n"
        "Assignment: {description}\n\n"
        "Return ONLY the code, no markdown fences, no explanation."
    ),
    'minimal': (
        "Write a concise, minimal {language} solution for the following assignment. "
        "Use short variable names, no comments, no extra whitespace.\n\n"
        "Assignment: {description}\n\n"
        "Return ONLY the code, no markdown fences, no explanation."
    ),
    'beginner': (
        "Write a {language} solution for the following assignment as a first-year "
        "computer science student would write it. Use simple logic, avoid advanced "
        "language features, use basic variable names like i, j, temp, result, arr.\n\n"
        "Assignment: {description}\n\n"
        "Return ONLY the code, no markdown fences, no explanation."
    ),
    'structured': (
        "Write a {language} solution for the following assignment using a different "
        "structural approach than the most obvious one. For example, if iteration is "
        "the obvious approach, use recursion instead, or vice versa.\n\n"
        "Assignment: {description}\n\n"
        "Return ONLY the code, no markdown fences, no explanation."
    ),
}


def strip_markdown_fences(text: str) -> str:
    """Remove ```python ... ``` style fences if the model ignores our instruction."""
    lines = text.strip().splitlines()
    if lines and lines[0].startswith('```'):
        lines = lines[1:]
    if lines and lines[-1].strip() == '```':
        lines = lines[:-1]
    return '\n'.join(lines)


def generate_reference_solution(
    language: str,
    style: str,
    assignment_title: str,
    assignment_description: str,
) -> str:
    """
    Call Gemini Flash and return the generated code as a plain string.
    Raises ValueError if the style is unsupported.
    Raises RuntimeError if Gemini returns an empty response.
    """
    if style not in STYLES:
        raise ValueError(f"No prompt template for style: {style}")

    prompt_template = STYLES[style]
    description = (
        f"Title: {assignment_title}\n{assignment_description}"
        if assignment_description
        else f"Title: {assignment_title}"
    )

    prompt = prompt_template.format(language=language, description=description)

    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content(prompt)

    if not response.text:
        raise RuntimeError(
            f"Gemini returned an empty response for language={language} style={style}"
        )

    return strip_markdown_fences(response.text)
