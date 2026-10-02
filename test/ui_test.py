import asyncio, json, pathlib
from playwright.async_api import async_playwright

HERE = pathlib.Path(__file__).parent.resolve()
results = []
def check(name, ok, extra=""):
    results.append(ok); print(("PASS " if ok else "FAIL ") + name + (f"  [{extra}]" if extra else ""))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1280, "height": 900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"file://{HERE}/harness.html")

        # signed-out screen
        check("login button shown", await pg.locator("#login").count() == 1)
        await pg.click("#login")
        check("login handler fires", await pg.evaluate("window.calls.login") == 1)

        # denied screen
        await pg.evaluate("ui.denied({email:'someone@x.com', provider:'saml.okta'})")
        t = await pg.inner_text("#root")
        check("denied screen shows email+provider", "someone@x.com" in t and "saml.okta" in t)

        # app: active only by default
        counts = await pg.evaluate("window.__counts")
        await pg.evaluate("ui.app({email:'user@example.com'}); ui.setActive(window.__active)")
        n = await pg.locator(".card").count()
        check("active sites listed, closed hidden", n == counts["active"], f"{n} cards")
        check("count label", (await pg.inner_text(".count")).startswith(f"{counts['active']} site"))

        # XSS
        pw = await pg.evaluate("window.pwned")
        check("hostile data not executed", pw is None, f"pwned={pw}")
        check("hostile data shown as literal text", "<img src=x" in await pg.inner_text(".list"))
        check("no <script>/<img> injected from data", await pg.locator(".list script, .list img").count() == 0)

        # search
        await pg.fill("#q", "comcast")
        n2 = await pg.locator(".card").count()
        check("search narrows results", 0 < n2 < n, f"{n2} for 'comcast'")
        await pg.fill("#q", "zzzz-nothing")
        check("empty state", await pg.locator(".empty").count() == 1)
        await pg.fill("#q", "")

        # secondary-only filter
        await pg.check("#sec")
        n3 = await pg.locator(".card").count()
        check("secondary ISP filter", 0 < n3 < n, f"{n3}")
        await pg.uncheck("#sec")

        # expand detail
        first = pg.locator(".card").first
        await first.locator(".head").click()
        check("card expands", await first.locator(".detail").is_visible())
        txt = await first.locator(".detail").inner_text()
        check("detail has Primary ISP + Contacts", "Primary ISP" in txt and "Contacts" in txt.replace("CONTACTS","Contacts") or "CONTACTS" in txt)
        await first.screenshot(path=str(HERE / "shot_card.png"))

        # include closed -> lazy load once
        await pg.check("#closed")
        await pg.wait_for_function(f"document.querySelectorAll('.card').length == {counts['active'] + counts['closed']}")
        check("include closed loads all", True, f"{counts['active'] + counts['closed']} cards")
        check("closed loaded once", await pg.evaluate("window.calls.closedLoads") == 1)
        await pg.uncheck("#closed"); await pg.check("#closed")
        check("closed not re-fetched", await pg.evaluate("window.calls.closedLoads") == 1)

        # sign out
        await pg.click("#logout")
        check("logout handler fires", await pg.evaluate("window.calls.logout") == 1)

        # screenshots desktop + mobile
        await pg.uncheck("#closed")
        await pg.screenshot(path=str(HERE / "shot_desktop.png"))
        await pg.set_viewport_size({"width": 390, "height": 800})
        await pg.screenshot(path=str(HERE / "shot_mobile.png"))
        scroll_w = await pg.evaluate("document.documentElement.scrollWidth")
        check("no horizontal scroll on phone width", scroll_w <= 391, f"scrollWidth={scroll_w}")
        check("no page errors", not errs, "; ".join(errs))
        await b.close()
    print(f"\n{sum(results)}/{len(results)} passed")

asyncio.run(main())
