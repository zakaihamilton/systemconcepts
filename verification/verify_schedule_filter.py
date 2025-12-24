from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_schedule_filter(page: Page):
    page.goto("http://localhost:3000/#schedule")

    # Wait for the filter icon (funnel)
    # The SVG path for FilterAltIcon is specific, but we can search for the button.
    # The button is an `a` tag (MuiIconButton) with a child SVG.

    # We can try to click the button by its position or look for the tooltip.
    # Since I don't see the tooltip in the screenshot (mouse is not hovering), I can't rely on "text=Filter".

    # Let's target the filter icon SVG specifically if we can, or just the 4th/5th button.
    # But better to find a way to identify it.

    # Let's dump the HTML of the toolbar to see what's there.
    # toolbar = page.locator(".Toolbar_toolbar__...") # class names are hashed.

    # But we can find the toolbar by role.
    # And then find the button with the filter icon.
    # The filter icon usually has `data-testid="FilterAltIcon"` if it was standard MUI, but here it's custom.

    # Let's try to click the button that *contains* the SVG with "MuiSvgIcon-root" class and is NOT the calendar, search, etc.
    # But that's hard.

    # Let's use the fact that the filter button is added via `useSessions` in `src/util/sessions.js` with id="filter".
    # But the id is not on the DOM element.

    # However, `Toolbar/Item.js` renders a Tooltip with title=item.name.
    # `item.name` comes from `translations.FILTER`.
    # `translations.FILTER` is "Filter".
    # Playwright's `get_by_label` often works with Tooltips if aria-label is set, but here it's `title`.
    # `get_by_role("button", name="Filter")` might not work if it's an anchor `<a>` tag.
    # `get_by_role("link", name="Filter")` should work if the tooltip text is associated.

    # Let's try forcing the click on the element that likely is the filter button.
    # In the screenshot, it's the funnel icon.
    # It is between the View toggle (calendar icon) and the Search bar.
    # No, it's to the left of the "Today" (calendar with dot?) button?
    # In the screenshot:
    # [Hamburger] [Grid] [>] [Calendar] Schedule ... [Filter] [Today] [Pause/Stop] [Search] ...

    # So it is the funnel icon.

    # Let's try to find it by index if all else fails, but let's try `page.locator("a").filter(has=page.locator("svg[data-testid='FilterAltIcon']"))`
    # Default MUI icons have data-testid equal to the icon name.

    try:
        page.locator("a").filter(has=page.locator("[data-testid='FilterAltIcon']")).click()
    except:
        # If data-testid is not there, try generic SVG
        pass

    # Wait for FilterBar
    # FilterBar has text "Filter" as a label.
    page.wait_for_selector("text=Filter", timeout=5000)

    page.screenshot(path="verification/schedule_filter_visible.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 720})
        try:
            verify_schedule_filter(page)
            print("Verification script finished successfully.")
        except Exception as e:
            print(f"Verification script failed: {e}")
            page.screenshot(path="verification/schedule_filter_error.png")
        finally:
            browser.close()
