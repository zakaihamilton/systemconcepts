from playwright.sync_api import sync_playwright

def verify_sessions_search():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to sessions page
        page.goto("http://localhost:3000/#sessions")

        # Wait for either table or "No Items" message
        try:
            page.wait_for_selector("text=No Items", timeout=10000)
            print("Found 'No Items' message")
        except:
            try:
                page.wait_for_selector("table", timeout=5000)
                print("Found table")
            except:
                print("Could not find table or empty message")
                page.screenshot(path="verification/load_fail.png")
                raise

        # Initial screenshot
        page.screenshot(path="verification/sessions_initial.png")

        # Type in search box
        try:
            # The search component has an aria-label "search" on the input
            # But we might need to click the container first to expand it if it's not desktop
            # The container has a click handler that focuses the input.

            # Let's try to click the search icon wrapper first to ensure focus
            # The structure is <div class="search ..."> <div class="searchIcon">...</div> <InputBase ...> </div>

            # We can find the input by placeholder (SEARCH + "...") which is usually "Search..."
            search_input = page.get_by_placeholder("Search…") # Note the ellipsis character used in code

            if not search_input.is_visible():
                print("Input not visible, looking for SearchIcon...")
                # Try to click the search icon to expand
                # This is tricky without a clear selector, but let's try get_by_label on the input if hidden?
                # Or generic get_by_role('textbox') might find it even if hidden?
                pass

            # Force click the input using JS if needed, or just type
            # If the input is technically in the DOM but hidden via opacity/width

            # Let's try filling directly. If it fails, we know why.
            search_input.fill("Test Search")
            print("Typed in search box")

        except Exception as e:
            print(f"Error interacting with search: {e}")
            # Fallback: try to match standard "Search..." if the ellipsis is different
            try:
                page.get_by_placeholder("Search...").fill("Test Search")
                print("Typed in search box (fallback)")
            except Exception as e2:
                print(f"Fallback failed: {e2}")
                page.screenshot(path="verification/search_error.png")
                raise

        # Wait for potential re-render
        page.wait_for_timeout(1000)

        # Take screenshot of search results
        page.screenshot(path="verification/sessions_search_result.png")

        browser.close()

if __name__ == "__main__":
    verify_sessions_search()
