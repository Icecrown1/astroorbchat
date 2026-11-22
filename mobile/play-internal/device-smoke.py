"""Exercise the installed WebView via Android accessibility on a disposable AVD."""
import json
import os
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

package = 'app.astroorbi.mobile'
results = Path('device-results')
results.mkdir(exist_ok=True)
outcomes = {}

def adb(*args, binary=False):
    value = subprocess.check_output(['adb', *args], timeout=60)
    return value if binary else value.decode().strip()

def launch():
    activity = adb('shell','cmd','package','resolve-activity','--brief',package).splitlines()[-1]
    adb('shell','am','start','-W','-n',activity)

def tree():
    adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
    return ET.fromstring(adb('exec-out', 'cat', '/sdcard/window.xml'))

def find(label, click=False):
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        try:
            root = tree()
        except (subprocess.SubprocessError, ET.ParseError):
            time.sleep(1)
            continue
        for n in root.iter('node'):
            labels = (n.get('text', ''), n.get('content-desc', ''))
            if any(label.casefold() in v.casefold() for v in labels):
                if click:
                    x1,y1,x2,y2 = map(int, re.findall(r'\d+', n.get('bounds')))
                    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                return
        time.sleep(.4)
    raise AssertionError('missing ' + label)

def screenshot(name):
    (results / (name + '.png')).write_bytes(adb('exec-out','screencap','-p',binary=True))

def check(name, fn):
    try:
        fn()
        outcomes[name] = 'pass'
    except Exception as exc:
        outcomes[name] = str(exc)
    screenshot(name)
    (results / 'scenarios.json').write_text(json.dumps(outcomes,ensure_ascii=False,indent=2),encoding='utf-8')

def daily():
    find('Открыть бесплатно', True)
    find('Вытянуть', True)
    find('Тема дня')

temp = Path(os.environ['RUNNER_TEMP'])
adb('shell','input','keyevent','KEYCODE_WAKEUP')
adb('shell','wm','dismiss-keyguard')
adb('shell','settings','put','system','screen_off_timeout','1800000')
outcomes['page-size-bytes'] = int(adb('shell','getconf','PAGE_SIZE'))
adb('install', str(temp / 'candidate-6.apk'))
launch()
check('v6-first-draw', daily)
adb('install','-r',str(temp / 'candidate-7.apk'))
launch()
check('upgrade-history', lambda: find('Посмотреть карту'))
adb('shell','wm','size','720x1280')
adb('shell','wm','density','320')
adb('shell','settings','put','system','font_scale','1.3')
adb('shell','am','force-stop',package)
launch()
check('large-font-home', lambda: find('Профиль'))
def catalog():
    find('Инструменты', True)
    find('Совместимость')
    find('Оракул')
check('catalog', catalog)
def profile():
    find('Профиль', True)
    find('Тестовый код')
check('profile', profile)
def external_return():
    adb('shell','am','force-stop',package)
    adb('shell','am','start','-a','android.intent.action.VIEW','-d','astroorbi-internal://payment-return',package)
    find('Баланс')
check('cold-return', external_return)
def offline():
    adb('shell','svc','wifi','disable')
    adb('shell','svc','data','disable')
    find('Главная', True)
    find('Посмотреть карту', True)
    find('Тема дня')
    adb('shell','input','keyevent','4')
    find('Посмотреть карту')
check('offline-back', offline)
print(json.dumps(outcomes,ensure_ascii=False))
raise SystemExit(any(v != 'pass' for k,v in outcomes.items() if k != 'page-size-bytes'))
