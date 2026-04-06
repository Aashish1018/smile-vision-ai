from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8080")

        # force light mode
        page.evaluate("() => localStorage.setItem('dv-theme', 'light')")
        page.reload()
        page.wait_for_timeout(2000)

        page.screenshot(path="screenshot-light.png")

        # also capture dashboard
        page.goto("http://localhost:8080/dashboard")
        page.wait_for_timeout(2000)
        page.screenshot(path="screenshot-light-dashboard.png")

        browser.close()

if __name__ == "__main__":
    run()