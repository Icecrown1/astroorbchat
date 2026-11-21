"""Exercise the installed web bundle at phone sizes, using a synthetic account."""
from contextlib import contextmanager
from functools import partial
from hashlib import sha256
from math import floor
import re
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
    ids = {"three": ["four-of-wands", "moon", "sun"], "daily": ["ace-of-cups"],
           "celtic": ["fool", "ten-of-wands", "lovers", "star", "death", "emperor", "tower",
                      "queen-of-cups", "wheel-of-fortune", "knight-of-swords"]}[spread]
    return dict(id=spread, spread=spread, createdAt="2026-11-21T08:00:00Z",
                cards=[dict(cardId=c, reversed=i == 1, position=i) for i, c in enumerate(ids)],
                interpretation={"synthesis": "Общий смысл расклада.", "cards": [
                    {"text": f"Трактовка для позиции {i + 1}."} for i in range(len(ids))]})


def check_deck():
    deck = (MOBILE.parent / "shared/tarot.ts").read_text()
    ids = re.findall(r"\{ id: '([a-z-]+)', suit:", deck)
    assert len(set(ids)) == len(ids) == 78
    art = MOBILE / "src/art/deck"
    assert {p.stem for p in art.glob("*.webp")} == set(ids)
    for card in ids:
        source = art / f"{card}.webp"
        expected = sha256(source.read_bytes()).digest()
        assert any(sha256(f.read_bytes()).digest() == expected
                   for f in (MOBILE / "dist/assets").glob(f"{card}-*.webp")), card


def check_paper(page, selector):
    # Sample inside the actual artwork (object-fit: contain can leave an empty gutter).
    art = page.locator(selector)
    art.evaluate("img => img.decode()")
    sample = art.evaluate("""img => {
      const box = img.getBoundingClientRect();
      const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      return [box.x + (box.width - w) / 2 + .10*w, box.y + (box.height - h) / 2 + .06*h];
    }""")
    clip = dict(x=floor(sample[0]), y=floor(sample[1]), width=3, height=3)
    ink = art.screenshot()
    paper = page.screenshot(clip=clip)
    art.evaluate("img => img.style.opacity = '0'")
    assert page.screenshot(clip=clip) == paper, f"Visible paper rectangle: {selector}"
    assert art.screenshot() != ink, f"Artwork disappeared: {selector}"
    art.evaluate("img => img.style.opacity = ''")


def check_celtic_cross(page):
    board = page.get_by_role("group", name="Схема Кельтского креста")
    board.wait_for()
    cards = board.get_by_role("button")
    assert cards.count() == 10
    assert cards.locator(".position-label").all_text_contents() == list(map(str, range(1, 11)))
    for width in (390, 320, 360):
        page.set_viewport_size({"width": width, "height": 844})
        board.evaluate("el => el.scrollIntoView({block:'center', behavior:'instant'})")
        boxes = [card.bounding_box() for card in cards.all()]
        xs = [box["x"] + box["width"] / 2 for box in boxes]
        ys = [box["y"] + box["height"] / 2 for box in boxes]
        assert all(box["width"] >= 44 and box["height"] >= 44 for box in boxes)
        assert board.evaluate("el => el.scrollWidth <= el.clientWidth && document.documentElement.scrollWidth <= innerWidth")
        assert xs[3] < xs[0] < xs[5] < xs[6] and max(xs[6:]) - min(xs[6:]) < 1
        assert ys[4] < ys[0] < ys[1] < ys[2] and abs(ys[3] - ys[5]) < 1
        assert ys[9] < ys[8] < ys[7] < ys[6]
        assert boxes[1]["width"] > boxes[1]["height"] and boxes[0]["width"] < boxes[0]["height"]
        assert abs(xs[0] - xs[1]) < 6 and boxes[0]["y"] + boxes[0]["height"] > boxes[1]["y"]
        if width == 390:
            board.locator("img").evaluate_all("imgs => Promise.all(imgs.map(img => img.decode()))")
            board.screenshot(path=SCREENS / "12-celtic-cross.png")
        if width == 320:
            for i, card in enumerate(cards.all()):
                # The upper half of the first card remains exposed above the crossing card.
                box = boxes[i]
                card.tap(position={"x": box["width"] / 2, "y": 12 if i == 0 else box["height"] / 2})
                viewer = page.get_by_role("dialog")
                assert viewer.locator(".viewer-paging span").inner_text() == f"{i + 1} из 10"
                assert viewer.locator("header span").inner_text().startswith(f"{i + 1}. ")
                assert viewer.locator("img.reversed").count() == int(i == 1)
                viewer.get_by_role("button", name="Закрыть карту").click()
                viewer.wait_for(state="hidden")
    page.set_viewport_size({"width": 390, "height": 844})
    face = cards.first.locator(".tarot-face")
    assert face.evaluate("el => getComputedStyle(el).animationName") == "tarot-float"
    page.emulate_media(reduced_motion="reduce")
    assert face.evaluate("el => getComputedStyle(el).animationName === 'none' && getComputedStyle(el).boxShadow !== 'none'")
    page.emulate_media(reduced_motion="no-preference")


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
                    "/api/tarot/status": {"costs": {"three": 3, "celtic": 10}, "dailyDone": False},
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
    check_paper(page, ".index-row:visible img[src*=hand]")
    tool("Матрица судьбы")
    page.locator("#birthday").fill("1998-06-07")
    button("Рассчитать матрицу").click()
    ticks = page.locator(".matrix-plate:visible .age-tick")
    assert ticks.all_text_contents() == list(map(str, range(80)))
    assert page.locator(".matrix-plate:visible .decade").all_text_contents() == list(map(str, range(0, 80, 10)))
    node = page.locator(".matrix-plate:visible").get_by_role("button").nth(1)
    node.click()
    assert node.get_attribute("aria-pressed") == "true"
    page.locator(".matrix-plate:visible").evaluate("svg => svg.scrollIntoView({block:'center'})")
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
    check_paper(page, ".front-art:visible[src*=moon]")
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
    meanings = page.locator(".card-meaning:visible")
    meanings.first.wait_for()
    assert meanings.locator("h3").all_text_contents() == ["Четвёрка Жезлов", "Луна", "Солнце"]
    assert meanings.locator("p").all_text_contents() == [
        f"Трактовка для позиции {i}." for i in range(1, 4)]
    capture("05-tarot")
    page.locator(".three-cards:visible button").first.click()
    viewer = page.get_by_role("dialog")
    viewer.wait_for()
    assert "/four-of-wands-" in viewer.locator("img").get_attribute("src")
    assert viewer.bounding_box() == {"x": 0, "y": 0, "width": 390, "height": 844}
    assert viewer.locator("img").evaluate("async img => { await img.decode(); return img.naturalWidth === 768 && img.naturalHeight === 1152 }")
    capture("11-four-of-wands")
    button("Следующая карта").click()
    assert viewer.get_by_role("heading").inner_text() == "Луна"
    assert viewer.locator("img.reversed").count() == 1
    page.go_back()
    viewer.wait_for(state="hidden")
    assert meanings.count() == 3
    page.locator(".three-cards:visible button").last.click()
    button("Закрыть карту").click()
    viewer.wait_for(state="hidden")
    assert draws == ["three"]
    button("Выбрать другой расклад").click()
    page.select_option("#online-spread", "daily")
    page.locator(".online-spread:visible button[type=submit]").click()
    page.locator(".one-card:visible").wait_for()
    capture("10-daily")
    button("Выбрать другой расклад").click()
    page.select_option("#online-spread", "celtic")
    page.locator("#tarot-question").fill(question)
    button("Сделать расклад · 10 ★").click()
    button("Списать 10 ★").click()
    check_celtic_cross(page)
    assert draws == ["three", "daily", "celtic"]
    assert meanings.count() == 10
    assert meanings.last.locator("p").inner_text() == "Трактовка для позиции 10."
    button("Офлайн").click()
    button("Три карты").click()
    button("Вытянуть три карты").click()
    assert page.locator(".three-cards:visible button").count() == 3
    assert meanings.count() == 3
    page.locator(".three-cards:visible button").first.click()
    page.keyboard.press("Escape")
    viewer.wait_for(state="hidden")
    assert button("Офлайн").get_attribute("aria-pressed") == "true"
    nav("Профиль")
    page.get_by_role("button", name="История раскладов").click()
    page.locator("details:visible summary").last.click()
    saved = page.locator("details[open] .spread-gallery:visible")
    assert saved.count() == 1
    saved.locator(".card-button").first.click()
    viewer.wait_for()
    assert viewer.locator("img").evaluate("async img => { await img.decode(); return img.naturalWidth === 768 }")
    button("Закрыть карту").click()
    viewer.wait_for(state="hidden")
    for width in (320, 360, 430):
        page.set_viewport_size({"width": width, "height": 740})
        nav("Главная")
        capture(f"home-{width}")
        tool("Совместимость")
        capture(f"compatibility-{width}")
    assert not errors, errors


if __name__ == "__main__":
    check_deck()
    SCREENS.mkdir(exist_ok=True)
    with serve_bundle() as address, sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=which("google-chrome") or which("chromium"))
        page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="ru-RU")
        exercise(page, address)
        browser.close()
