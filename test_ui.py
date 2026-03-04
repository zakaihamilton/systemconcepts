import sys
from playwright.sync_api import sync_playwright

def test_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:3000/")
        page.screenshot(path="ui_screenshot.png")
        browser.close()

if __name__ == "__main__":
    test_ui()
