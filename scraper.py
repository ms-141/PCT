from bs4 import BeautifulSoup
import requests
from urllib.parse import urljoin
import json
import csv
import re
import time


STOP_LABELS = [
    "Prerequisite(s):",
    "Recommended Preparation:",
    "Corequisite(s):",
    "Antirequisite(s):",
    "Note:",
    "Note(s):",
    "GNED Cluster",
]

METADATA_LABEL_PATTERN = re.compile(
    r"^(Credit\(s\):|[A-Za-z/&, -]+Hour\(s\):|[A-Za-z/&, -]*Schedule Type:)$"
)


def normalize_text(value):
    return " ".join(value.split())


def fetch_page(url, timeout=15, retries=3, delay_seconds=1):
    last_error = None

    for attempt in range(1, retries + 1):
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            return response
        except requests.RequestException as error:
            last_error = error
            print(f"Request failed ({attempt}/{retries}) for {url}: {error}")
            if attempt < retries:
                time.sleep(delay_seconds)

    raise last_error


def extract_description(block, title_tag):
    if not block:
        return ""

    description_parts = []
    skip_metadata_value = False

    for child in block.contents:
        if child == title_tag:
            continue

        if hasattr(child, "get_text"):
            text = normalize_text(child.get_text(" ", strip=True))
        else:
            text = normalize_text(str(child))

        if not text:
            continue

        if any(text.startswith(label) for label in STOP_LABELS):
            break

        if text.startswith("(formerly "):
            continue

        if METADATA_LABEL_PATTERN.match(text):
            skip_metadata_value = True
            continue

        if skip_metadata_value:
            skip_metadata_value = False
            continue

        description_parts.append(text)

    return normalize_text(" ".join(description_parts))


# Purpose: Collect course information by retrieving the raw html using BeuatifulSoup and save it as a JSON

#----------------------------------
# SETUP 

# main page for course catalog
url = "https://catalog.mtroyal.ca/content.php?catoid=38&navoid=3076"

#----------------------------------
# Data Collection

# 1. Catalog page urls
catalog_page_urls = [url,
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=2#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=3#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=4#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=5#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=6#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=7#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=8#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=9#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=10#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=11#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=12#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=13#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=14#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=15#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=16#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=17#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=18#acalog_template_course_filter",
                     "https://catalog.mtroyal.ca/content.php?catoid=38&catoid=38&navoid=3076&filter%5Bitem_type%5D=3&filter%5Bonly_active%5D=1&filter%5B3%5D=1&filter%5Bcpage%5D=19#acalog_template_course_filter",
                     ]

# 2. collect info from all course urls
all_course_links = set()

for page_url in catalog_page_urls:
    print(f"Fetching catalog page: {page_url}")
    try:
        page_response = fetch_page(page_url)
    except requests.RequestException as error:
        print(f"Skipped catalog page after retries: {page_url} ({error})")
        continue
    page_soup = BeautifulSoup(page_response.text, "html.parser")

    course_anchors = page_soup.select('a[href*="preview_course_nopop.php"]')
    for a in course_anchors:
        href = a.get("href")
        if href:
            full_url = urljoin(page_url, href)
            all_course_links.add(full_url)

course_links = sorted(all_course_links) 

print("There are:", len(course_links), "unique course links")

# 3. Visit each course link and collect title, prereq, description

def course_page_extract(course_url):
    try:
        response = fetch_page(course_url)
    except requests.RequestException as error:
        print(f"Skipped course page after retries: {course_url} ({error})")
        return None

    soup = BeautifulSoup(response.text, "html.parser")

    title_tag = soup.select_one("h1#course_preview_title")
    if not title_tag:
        return None

    title_text = " ".join(title_tag.get_text(" ", strip=True).split())

    course_code = ""
    course_title = title_text
    if " - " in title_text:
        parts = title_text.split(" - ", 1)
        course_code = parts[0].strip()
        course_title = parts[1].strip()

    block = title_tag.find_parent("p")
    description = extract_description(block, title_tag)
    prerequisites = ""

    if block:
        block_text = normalize_text(block.get_text(" ", strip=True))

        if "Prerequisite(s):" in block_text:
            prerequisites = block_text.split("Prerequisite(s):", 1)[1].strip()

            for label in STOP_LABELS[1:]:
                if label in prerequisites:
                    prerequisites = prerequisites.split(label, 1)[0].strip()

    return {
        "course_code": course_code,
        "course_title": course_title,
        "description": description,
        "prerequisites": prerequisites,
        "url": course_url,
    }

extracted_course_data = []

for i, link in enumerate(course_links, start=1):
    data = course_page_extract(link)
    if data:
        extracted_course_data.append(data)
    else:
        print(f"Skipped: {link}")

    if i % 50 == 0:
        print("Processed", i, "of", len(course_links))

# ----------------------------
# Save to JSON
with open("pct.json", "w", encoding="utf-8") as json_file:
    json.dump(extracted_course_data, json_file, indent=4)

# DONE
print("Script Complete. Records added: ", len(extracted_course_data))