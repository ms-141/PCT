from bs4 import BeautifulSoup
import requests
from urllib.parse import urljoin
import json
import csv
import re
import time


# Purpose: Collect course information by retrieving the raw html using BeuatifulSoup

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
    page_response = requests.get(page_url, timeout=15)
    page_response.raise_for_status() # outputs errors
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
    response = requests.get(course_url, timeout=15)
    response.raise_for_status()
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
    prerequisites = ""

    if block:
        block_text = " ".join(block.get_text(" ", strip=True).split())

        if "Prerequisite(s):" in block_text:
            prerequisites = block_text.split("Prerequisite(s):", 1)[1].strip()

            stop_labels = [
                "Recommended Preparation:",
                "Corequisite(s):",
                "Antirequisite(s):",
                "Note:",
                "GNED Cluster",
            ]

            for label in stop_labels:
                if label in prerequisites:
                    prerequisites = prerequisites.split(label, 1)[0].strip()

    return {
        "course_code": course_code,
        "course_title": course_title,
        "prerequisites": prerequisites,
        "url": course_url,
    }

extracted_course_data = []

for i, link in enumerate(course_links, start=1):
    data = course_page_extract(link)
    if data:
        extracted_course_data.append(data)

    if i % 50 == 0:
        print("Processed", i, "of", len(course_links))

# ----------------------------
# Save to JSON
with open("pct.json", "w", encoding="utf-8") as json_file:
    json.dump(extracted_course_data, json_file, indent=4)

# DONE
print("Script Complete. Records added: ", len(extracted_course_data))