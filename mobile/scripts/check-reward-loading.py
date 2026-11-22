"""Exercise the release UI against controlled Capacitor ad callbacks."""
import os
from pathlib import Path
import runpy

from playwright.sync_api import sync_playwright

serve_bundle = runpy.run_path(str(Path(__file__).with_name("check-layout.py")))["serve_bundle"]
with serve_bundle() as address, sync_playwright() as pw:
    browser = pw.chromium.launch(channel=os.getenv("BROWSER_CHANNEL"))
    page = browser.new_page(viewport={"width": 360, "height": 740})
    page.set_default_timeout(6000)
    page.route("https://astro-orbi-android-sandbox.replit.app/**",
               lambda r: r.fulfill(json={"ok": True, "data": {"testAds": True}}))
    page.route("https://astroorbiapp.com/**", lambda r: r.abort())
    page.add_init_script("""window.fixture = {loads:0, shows:0, earned:false};
      window.Capacitor = {
        PluginHeaders:[{name:'PlayAds', methods:['prepare','loadReward','show'].map(name=>({name,rtype:'promise'}))}],
        nativePromise: async (_,method) => {
          if(method==='loadReward') {
            fixture.loads++;
            await new Promise((ok,fail)=>{fixture.ready=ok;fixture.fail=code=>fail({code})});
          }
          if(method==='show') {fixture.shows++;return {earned:fixture.earned}}
        }
      }""")
    page.goto(address)
    def click(label): page.get_by_role("button", name=label, exact=True).click()
    click("Открыть бесплатно")
    click("Три карты")
    click("Вытянуть три карты")
    button = page.locator(".reward-unlock:visible").first
    bonus = page.locator(".rewarded-advice:visible")
    for code, text in [("GMA_LOAD_2", "Ошибка сети"), ("GMA_LOAD_3", "нет тестового ролика"), ("AD_TIMEOUT", "15 секунд")]:
        button.click()
        assert button.is_disabled()
        page.evaluate("code=>fixture.fail(code)", code)
        page.get_by_role("status").filter(has_text=text).wait_for()
        assert button.is_enabled() and not bonus.count()
    button.click()
    click("Профиль")
    page.evaluate("fixture.ready()")
    page.go_back()
    button.wait_for()
    assert page.evaluate("fixture.shows") == 0
    button.click()
    page.evaluate("fixture.ready()")
    page.wait_for_function("fixture.shows===1")
    assert not bonus.count()
    page.evaluate("fixture.earned=true")
    button.click()
    page.evaluate("fixture.ready()")
    bonus.wait_for()
    assert page.evaluate("fixture.loads===6 && fixture.shows===2")
    browser.close()
print("PASS loading, network error, no fill, timeout, retry, navigation, dismissal and earned reward")
