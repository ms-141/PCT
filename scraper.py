from bs4 import BeautifulSoup
import requests
from urllib.parse import urljoin

# Need to loop over every course link and collect relevent info

#----------------------------------
# SETUP 

# main page for course catalog
url = "https://catalog.mtroyal.ca/content.php?catoid=38&navoid=3076"

# use the requests library to retrieve
response  = requests.get(url)

# Use beautifulsoup to create an iterable object
soup = BeautifulSoup(response.text, "html.parser")

course_links = []

course_anchors = soup.select('a[href*="preview_course_nopop.php"]')
for a in course_anchors:
    href = a.get("href")
    if href:
        full_url = urljoin(url, href)
        course_links.append(full_url)

print("There are: ", len(course_links), " course links")
print(course_links[:10])


page_links = soup.select('a[href*="filter%5Bcpage%5D"]')
# print(page_links)

# save the list of links into an array




# save the list of page links into an array

