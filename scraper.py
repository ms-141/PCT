from bs4 import BeautifulSoup
import requests

# Need to loop over every course link and collect relevent iinfo.


url = "https://catalog.mtroyal.ca/content.php?catoid=38&navoid=3076"
response  = requests.get(url)

print(response)
# print(response.text)

soup = BeautifulSoup(response.text, "html.parser")

# only prints the first a tag element
print(soup.a)


course_links = soup.select('a[href*="preview_course_nopop.php]')
print(course_links)


page_links = soup.select('a[href*="filter%5Bcpage%5D"]')
print(page_links)

