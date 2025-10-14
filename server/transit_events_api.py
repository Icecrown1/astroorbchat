#!/usr/bin/env python3
"""
API для расчёта важных астрологических дат (транзиты) через Swiss Ephemeris
Принимает JSON на stdin, возвращает JSON на stdout
"""

import swisseph as swe
import json
import sys
from datetime import datetime, timedelta

ZODIAC_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", 
    "Leo", "Virgo", "Libra", "Scorpio",
    "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]

# Планеты для отслеживания транзитов
TRANSIT_PLANETS = {
    'Mercury': swe.MERCURY,
    'Venus': swe.VENUS,
    'Mars': swe.MARS,
    'Jupiter': swe.JUPITER,
    'Saturn': swe.SATURN,
    'Uranus': swe.URANUS,
    'Neptune': swe.NEPTUNE,
    'Pluto': swe.PLUTO,
}

def get_zodiac_sign(longitude):
    """Получить знак зодиака по долготе"""
    longitude = longitude % 360
    sign_index = int(longitude / 30)
    return ZODIAC_SIGNS[sign_index]


def find_retrograde_stations(planet_name, planet_id, start_jd, end_jd, limit):
    """Найти станции (ретроград/директ) для планеты"""
    events = []
    current_jd = start_jd
    step = 1.0  # 1 день
    
    prev_speed = None
    prev_jd = None
    
    while current_jd < end_jd and len(events) < limit:
        position, _ = swe.calc(current_jd, planet_id, swe.FLG_SWIEPH | swe.FLG_SPEED)
        speed = position[3]  # скорость в долготе
        
        if prev_speed is not None:
            # Ретроградное движение начинается когда скорость меняет знак с + на -
            if prev_speed > 0 and speed < 0:
                # Уточняем дату с точностью до часа
                exact_jd = refine_station(planet_id, prev_jd, current_jd)
                date_str = jd_to_date_string(exact_jd)
                sign = get_zodiac_sign(position[0])
                
                events.append({
                    'key': f"{date_str}|{planet_name}|retrograde-start",
                    'date': date_str,
                    'kind': 'retrograde-start',
                    'planet': planet_name,
                    'sign': sign,
                    'brief': f"{planet_name} в {sign} начинает ретроградное движение — пересмотрите планы в соответствующей сфере"
                })
            
            # Директное движение возобновляется когда скорость меняет знак с - на +
            elif prev_speed < 0 and speed > 0:
                exact_jd = refine_station(planet_id, prev_jd, current_jd)
                date_str = jd_to_date_string(exact_jd)
                sign = get_zodiac_sign(position[0])
                
                events.append({
                    'key': f"{date_str}|{planet_name}|retrograde-end",
                    'date': date_str,
                    'kind': 'retrograde-end',
                    'planet': planet_name,
                    'sign': sign,
                    'brief': f"{planet_name} в {sign} возвращается к директному движению — путь вперёд открыт"
                })
        
        prev_speed = speed
        prev_jd = current_jd
        current_jd += step
    
    return events


def refine_station(planet_id, start_jd, end_jd):
    """Уточнить момент станции с точностью до часа"""
    while (end_jd - start_jd) > 1.0/24:  # 1 час
        mid_jd = (start_jd + end_jd) / 2
        position, _ = swe.calc(mid_jd, planet_id, swe.FLG_SWIEPH | swe.FLG_SPEED)
        speed = position[3]
        
        if abs(speed) < 0.0001:  # близко к нулю
            return mid_jd
        
        # Сужаем интервал
        position_start, _ = swe.calc(start_jd, planet_id, swe.FLG_SWIEPH | swe.FLG_SPEED)
        if (position_start[3] > 0) == (speed > 0):
            start_jd = mid_jd
        else:
            end_jd = mid_jd
    
    return (start_jd + end_jd) / 2


def find_sign_ingresses(planet_name, planet_id, start_jd, end_jd, limit):
    """Найти входы планеты в новый знак"""
    events = []
    current_jd = start_jd
    step = 0.5  # полдня
    
    position, _ = swe.calc(current_jd, planet_id, swe.FLG_SWIEPH)
    prev_sign = get_zodiac_sign(position[0])
    prev_jd = current_jd
    
    while current_jd < end_jd and len(events) < limit:
        position, _ = swe.calc(current_jd, planet_id, swe.FLG_SWIEPH)
        current_sign = get_zodiac_sign(position[0])
        
        if current_sign != prev_sign:
            # Уточняем момент перехода
            exact_jd = refine_ingress(planet_id, prev_jd, current_jd, prev_sign, current_sign)
            date_str = jd_to_date_string(exact_jd)
            
            events.append({
                'key': f"{date_str}|{planet_name}|ingress|{current_sign}",
                'date': date_str,
                'kind': 'ingress',
                'planet': planet_name,
                'sign': current_sign,
                'brief': f"{planet_name} входит в {current_sign} — новая энергия в этой области жизни"
            })
            
            prev_sign = current_sign
        
        prev_jd = current_jd
        current_jd += step
    
    return events


def refine_ingress(planet_id, start_jd, end_jd, old_sign, new_sign):
    """Уточнить момент входа в знак"""
    while (end_jd - start_jd) > 1.0/24:  # 1 час
        mid_jd = (start_jd + end_jd) / 2
        position, _ = swe.calc(mid_jd, planet_id, swe.FLG_SWIEPH)
        mid_sign = get_zodiac_sign(position[0])
        
        if mid_sign == old_sign:
            start_jd = mid_jd
        else:
            end_jd = mid_jd
    
    return end_jd


def find_major_transits(planet_name, planet_id, natal_planets, start_jd, end_jd, limit):
    """Найти мажорные транзиты к натальным планетам"""
    events = []
    current_jd = start_jd
    step = 0.25  # 6 часов
    
    # Аспекты для отслеживания: соединение, секстиль, квадрат, трин, оппозиция
    aspects = {
        'conjunction': 0,
        'sextile': 60,
        'square': 90,
        'trine': 120,
        'opposition': 180
    }
    
    orb = 0.5  # орбис ±0.5° для точного транзита
    
    while current_jd < end_jd and len(events) < limit:
        position, _ = swe.calc(current_jd, planet_id, swe.FLG_SWIEPH)
        transit_lon = position[0]
        
        for natal_planet in natal_planets:
            natal_lon = natal_planet['longitude']
            natal_name = natal_planet['name']
            
            # Пропускаем транзит планеты к самой себе
            if planet_name == natal_name:
                continue
            
            angle = abs(transit_lon - natal_lon) % 360
            if angle > 180:
                angle = 360 - angle
            
            for aspect_name, aspect_angle in aspects.items():
                diff = abs(angle - aspect_angle)
                
                if diff < orb:
                    date_str = jd_to_date_string(current_jd)
                    
                    events.append({
                        'key': f"{date_str}|{planet_name}|major-transit|{natal_name}|{aspect_name}",
                        'date': date_str,
                        'kind': 'major-transit',
                        'planet': planet_name,
                        'natalTarget': {
                            'planet': natal_name,
                            'aspect': aspect_name
                        },
                        'brief': f"Транзитный {planet_name} формирует {aspect_name} к натальному {natal_name} — важное влияние"
                    })
                    
                    # Пропускаем вперёд, чтобы не дублировать
                    current_jd += 7  # 7 дней
                    break
        
        current_jd += step
    
    return events


def jd_to_date_string(jd):
    """Конвертировать юлианский день в строку YYYY-MM-DD"""
    year, month, day, hour = swe.revjul(jd)
    return f"{year:04d}-{month:02d}-{day:02d}"


def calculate_important_events(input_data):
    """
    Рассчитать важные астрологические события
    
    Args:
        input_data: dict с полями:
            - natal_planets: список планет из натальной карты [{name, longitude}, ...]
            - from_date: начальная дата в формате YYYY-MM-DD
            - to_date: конечная дата
            - limit: максимальное количество событий
    
    Returns:
        list важных событий, отсортированных по дате
    """
    natal_planets = input_data['natal_planets']
    from_date_str = input_data['from_date']
    to_date_str = input_data['to_date']
    limit = input_data.get('limit', 10)
    
    # Конвертируем даты в юлианские дни
    from_date = datetime.strptime(from_date_str, '%Y-%m-%d')
    to_date = datetime.strptime(to_date_str, '%Y-%m-%d')
    
    start_jd = swe.julday(from_date.year, from_date.month, from_date.day, 0, swe.GREG_CAL)
    end_jd = swe.julday(to_date.year, to_date.month, to_date.day, 0, swe.GREG_CAL)
    
    all_events = []
    
    # Для каждой транзитной планеты находим события
    for planet_name, planet_id in TRANSIT_PLANETS.items():
        # Ретрограды
        retrograde_events = find_retrograde_stations(planet_name, planet_id, start_jd, end_jd, limit)
        all_events.extend(retrograde_events)
        
        # Входы в знак
        ingress_events = find_sign_ingresses(planet_name, planet_id, start_jd, end_jd, limit)
        all_events.extend(ingress_events)
        
        # Мажорные транзиты к натальным планетам
        transit_events = find_major_transits(planet_name, planet_id, natal_planets, start_jd, end_jd, limit)
        all_events.extend(transit_events)
    
    # Сортируем по дате
    all_events.sort(key=lambda x: x['date'])
    
    # Ограничиваем количество
    return all_events[:limit]


def main():
    try:
        # Читаем входные данные из stdin
        input_data = json.load(sys.stdin)
        
        # Рассчитываем события
        events = calculate_important_events(input_data)
        
        # Возвращаем результат
        result = {
            'ok': True,
            'events': events
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)
        
    except Exception as e:
        error_result = {
            'ok': False,
            'error': str(e)
        }
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
