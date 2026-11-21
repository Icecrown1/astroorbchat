"""Exercise the installed web bundle at phone sizes, using a synthetic account."""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from shutil import which
from threading import Thread
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

MOBILE = Path(__file__).resolve().parents[1]
SCREENS = MOBILE / "layout-preview"
PROFILE = dict(id="test", name="Саша", birthdayDate="1998-06-07", birthTime="12:45",
               birthPlace="Казань", billingTier="standard", tier="standard", orbs=50)


@contextmanager
def serve_bundle():
    handler = partial(SimpleHTTPRequestHandler, directory=MOBILE / "dist")
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}/"
        finally:
            server.shutdown()
            thread.join()


def natal_fixture():
    positions = dict(Sun=70, Moon=149, Mercury=69, Venus=114, Mars=11, Jupiter=241,
                     Saturn=80, Uranus=322, Neptune=287, Pluto=203)
    signs = "Aries Taurus Gemini Cancer Leo Virgo Libra Scorpio Sagittarius Capricorn Aquarius Pisces".split()
    planets = {name: dict(longitude=d, sign=signs[d // 30], degree_in_sign=d % 30)
               for name, d in positions.items()}
    return {"data": {"planets": planets, "houses": {"cusps": list(range(10, 360, 30))},
                     "aspects": [dict(planet1="Sun", planet2="Moon", type="sextile")]}}


def reading_fixture(spread):
    ids = {"three": ["star", "moon", "sun"], "daily": ["ace-of-cups"]}[spread]
    return dict(id=spread, spread=spread, createdAt="2026-11-21T08:00:00Z",
                cards=[dict(cardId=c, reversed=False, position=i) for i, c in enumerate(ids)],
                interpretation={"cards": [{"text": s} for s in (
                    "Прислушайся к своей интуиции.", "Дай себе время отделить ощущения от фактов.",
                    "Выбери один простой шаг на сегодня.")] })


def exercise(page, url):
    draws, errors = [], []
    page.on("pageerror", lambda exc: errors.append(str(exc)))

    def api(route):
        path = urlparse(route.request.url).path
        if path == "/api/tarot/draw":
            spread = route.request.post_data_json["spread"]
            draws.append(spread)
            data = reading_fixture(spread)
        else:
            data = {"/api/mobile/auth/exchange": {"token": "local-test"},
                    "/api/user/me": PROFILE, "/api/tarot/history": [],
                    "/api/tarot/status": {"costs": {"three": 3}, "dailyDone": False},
                    "/api/natal/me": natal_fixture()}[path]
        route.fulfill(json={"ok": True, "data": data},
                      headers={"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"})

    page.route("https://astroorbiapp.com/**", api)
    button = lambda name: page.get_by_role("button", name=name, exact=True)
    nav = lambda name: page.get_by_role("navigation").get_by_role("button", name=name, exact=True).click()

    def tool(name):
        nav("Инструменты")
        page.locator(".illustrated-index button:visible").filter(has=page.get_by_text(name, exact=True)).click()

    def capture(name):
        page.evaluate("document.fonts.ready")
        page.evaluate("Promise.all([...document.images].filter(i => i.offsetWidth && i.loading !== 'lazy').map(i => i.decode()))")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Overflow on {name}"
        page.screenshot(path=SCREENS / f"{name}.png")

    page.goto(url)
    capture("01-home")
    nav("Инструменты")
    capture("02-tools")
    tool("Матрица судьбы")
    page.locator("#birthday").fill("1998-06-07")
    button("Рассчитать матрицу").click()
    node = page.locator(".matrix-plate:visible").get_by_role("button").nth(1)
    node.click()
    assert node.get_attribute("aria-pressed") == "true"
    page.locator(".matrix-plate:visible").scroll_into_view_if_needed()
    capture("06-matrix")
    button("Увеличить схему").click()
    assert page.locator(".chart-size-zoomed:visible").count() == 1

    nav("Профиль")
    page.locator("#link-code").fill("A" * 22)
    button("Войти").click()
    page.get_by_role("heading", name=PROFILE["name"]).wait_for()
    capture("03-profile")
    page.get_by_role("button", name="Данные рождения").click()
    page.get_by_role("heading", name="Настройки профиля").wait_for()
    nav("Профиль")
    page.get_by_role("button", name="Баланс и подписка").click()
    capture("09-stars")
    tool("Натальная карта")
    dial = page.locator(".sky-dial:visible")
    dial.wait_for()
    capture("04-natal")
    dial.get_by_role("button", name="Плутон").click()
    assert page.get_by_label("Выбрать планету").input_value() == "Pluto"
    button("Дома").click()
    page.get_by_label("Выбрать дом").select_option("6")
    assert page.locator(".object-seal:visible").inner_text() == "6"
    tool("Оракул")
    capture("07-oracle")
    tool("Совместимость")
    capture("08-compatibility")

    tool("Таро")
    page.select_option("#online-spread", "three")
    question = "На что обратить внимание сейчас?"
    page.locator("#tarot-question").fill(question)
    button("Сделать расклад · 3 ★").click()
    button("Отмена").click()
    assert not draws and page.locator("#tarot-question").input_value() == question
    button("Сделать расклад · 3 ★").click()
    button("Списать 3 ★").click()
    page.locator(".three-cards:visible button").nth(1).click()
    assert page.locator(".card-meaning:visible h3").inner_text() == "Луна"
    capture("05-tarot")
    assert draws == ["three"]
    button("Выбрать другой расклад").click()
    page.select_option("#online-spread", "daily")
    page.locator(".online-spread:visible button[type=submit]").click()
    page.locator(".one-card:visible").wait_for()
    capture("10-daily")
    button("Офлайн").click()
    button("Три карты").click()
    button("Вытянуть три карты").click()
    assert page.locator(".three-cards:visible button").count() == 3
    nav("Профиль")
    page.get_by_role("button", name="История раскладов").click()
    page.locator("details:visible summary").last.click()
    assert page.locator("details[open] .spread-gallery:visible").count() == 1
    for width in (320, 360, 430):
        page.set_viewport_size({"width": width, "height": 740})
        nav("Главная")
        capture(f"home-{width}")
        tool("Совместимость")
        capture(f"compatibility-{width}")
    assert not errors, errors


if __name__ == "__main__":
    SCREENS.mkdir(exist_ok=True)
    with serve_bundle() as address, sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=which("google-chrome") or which("chromium"))
        page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        exercise(page, address)
        browser.close()
