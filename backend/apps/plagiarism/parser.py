import os
import re
import requests
from bs4 import BeautifulSoup


def parse_moss_results(moss_url: str) -> list[dict]:
    """
    Fetch and parse the MOSS HTML report page.
    Returns a list of match dicts. File names in MOSS output are expected to be
    in the format "{student_id}_{original_filename}" as set during submission.

    Returns:
        [
          {
            'student_a_id': int,
            'student_b_id': int,
            'similarity_a': int,
            'similarity_b': int,
            'lines_matched': int,
            'moss_link': str,
          },
          ...
        ]
    """
    response = requests.get(moss_url, timeout=60)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'lxml')
    matches = []

    for row in soup.find_all('tr')[1:]:
        cells = row.find_all('td')
        if len(cells) < 3:
            continue

        link_a = cells[0].find('a')
        link_b = cells[1].find('a')
        lines_text = cells[2].get_text(strip=True)

        if not link_a or not link_b:
            continue

        def extract(link):
            # link text is like "23_main.py (72%)" or may include a path
            text = link.get_text()
            try:
                pct = int(text.split('(')[1].rstrip('%)'))
                filename = text.split('(')[0].strip()
            except (IndexError, ValueError):
                return None, None

            base_name = os.path.basename(filename)
            match = re.match(r'(-?\d+)_', base_name)
            if not match:
                return None, None

            try:
                student_id = int(match.group(1))
            except ValueError:
                return None, None

            return student_id, pct

        sid_a, pct_a = extract(link_a)
        sid_b, pct_b = extract(link_b)

        if None in (sid_a, pct_a, sid_b, pct_b):
            continue

        try:
            lines = int(lines_text)
        except ValueError:
            lines = 0

        matches.append({
            'student_a_id': sid_a,
            'student_b_id': sid_b,
            'similarity_a': pct_a,
            'similarity_b': pct_b,
            'lines_matched': lines,
            'moss_link': link_a['href'],
        })

    return matches
