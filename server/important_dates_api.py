#!/usr/bin/env python3
"""
API для расчёта важных астрологических дат:
- Лунные фазы (новолуние, полнолуние)
- Транзиты планет (смена знаков зодиака)
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
    'Sun': swe.SUN,
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
    """Определяет знак зодиака по долготе"""
    longitude = longitude % 360
    sign_index = int(longitude / 30)
    return ZODIAC_SIGNS[sign_index]

def get_sign_index(sign_name):
    """Возвращает индекс знака (0-11)"""
    return ZODIAC_SIGNS.index(sign_name)

def jd_to_datetime(jd):
    """Конвертирует юлианский день в datetime"""
    # Эпоха Unix в юлианских днях
    unix_epoch_jd = swe.julday(1970, 1, 1, 0, swe.GREG_CAL)
    timestamp = (jd - unix_epoch_jd) * 86400
    return datetime.utcfromtimestamp(timestamp)

def find_lunar_phases(start_jd, end_jd):
    """
    Находит все новолуния и полнолуния в заданном периоде
    
    Args:
        start_jd: Начальный юлианский день
        end_jd: Конечный юлианский день
    
    Returns:
        Список словарей с информацией о лунных фазах
    """
    phases = []
    search_jd = start_jd
    
    # Ищем все лунные фазы в периоде
    while search_jd < end_jd:
        # Получаем позиции Солнца и Луны
        sun_pos, _ = swe.calc(search_jd, swe.SUN, swe.FLG_SWIEPH)
        moon_pos, _ = swe.calc(search_jd, swe.MOON, swe.FLG_SWIEPH)
        
        sun_lon = sun_pos[0]
        moon_lon = moon_pos[0]
        
        # Разница долгот (угол между Солнцем и Луной)
        diff = (moon_lon - sun_lon + 360) % 360
        
        # Определяем ближайшую фазу
        next_phase_angle = None
        phase_type = None
        
        if diff < 180:
            # Ближайшее новолуние (0°)
            if diff < 90:
                next_phase_angle = 0
                phase_type = 'new_moon'
            # Ближайшее полнолуние (180°)
            else:
                next_phase_angle = 180
                phase_type = 'full_moon'
        else:
            # Ближайшее новолуние (360°/0°)
            if diff > 270:
                next_phase_angle = 360
                phase_type = 'new_moon'
            # Ближайшее полнолуние (180°)
            else:
                next_phase_angle = 180
                phase_type = 'full_moon'
        
        # Вычисляем сколько времени до следующей фазы
        # Луна движется примерно на 13° в день относительно Солнца
        angle_to_phase = (next_phase_angle - diff + 360) % 360
        if angle_to_phase > 180:
            angle_to_phase = 360 - angle_to_phase
        
        days_to_phase = angle_to_phase / 13.0
        phase_jd = search_jd + days_to_phase
        
        # Уточняем с шагом 1 час
        for _ in range(int(days_to_phase * 24) + 48):  # +48 часов запас
            sun_pos, _ = swe.calc(phase_jd, swe.SUN, swe.FLG_SWIEPH)
            moon_pos, _ = swe.calc(phase_jd, swe.MOON, swe.FLG_SWIEPH)
            
            sun_lon = sun_pos[0]
            moon_lon = moon_pos[0]
            diff = (moon_lon - sun_lon + 360) % 360
            
            # Проверяем новолуние (соединение)
            if phase_type == 'new_moon' and (diff < 0.5 or diff > 359.5):
                if phase_jd >= start_jd and phase_jd < end_jd:
                    phases.append({
                        'type': 'new_moon',
                        'date': jd_to_datetime(phase_jd).isoformat(),
                        'jd': phase_jd,
                        'sign': get_zodiac_sign(sun_lon),
                        'degree': round(sun_lon % 30, 2)
                    })
                break
            
            # Проверяем полнолуние (оппозиция)
            if phase_type == 'full_moon' and abs(diff - 180) < 0.5:
                if phase_jd >= start_jd and phase_jd < end_jd:
                    phases.append({
                        'type': 'full_moon',
                        'date': jd_to_datetime(phase_jd).isoformat(),
                        'jd': phase_jd,
                        'sign': get_zodiac_sign(moon_lon),
                        'degree': round(moon_lon % 30, 2)
                    })
                break
            
            phase_jd += 1.0 / 24.0  # Шаг 1 час
        
        # Переходим к следующему циклу (~29.5 дней)
        search_jd += 14.75  # Половина лунного цикла
    
    # Сортируем по дате и убираем дубликаты
    phases.sort(key=lambda x: x['jd'])
    unique_phases = []
    last_jd = 0
    for phase in phases:
        # Игнорируем фазы ближе чем 1 день друг к другу
        if phase['jd'] - last_jd > 1:
            unique_phases.append(phase)
            last_jd = phase['jd']
    
    return unique_phases

def find_planet_transits(start_jd, end_jd, days_forward=60):
    """
    Находит транзиты планет (переходы между знаками зодиака)
    
    Args:
        start_jd: Начальный юлианский день
        end_jd: Конечный юлианский день
        days_forward: Сколько дней вперёд искать
    
    Returns:
        Список словарей с информацией о транзитах
    """
    transits = []
    
    for planet_name, planet_id in TRANSIT_PLANETS.items():
        # Получаем текущую позицию планеты
        current_pos, _ = swe.calc(start_jd, planet_id, swe.FLG_SWIEPH)
        current_lon = current_pos[0]
        current_sign = get_zodiac_sign(current_lon)
        current_sign_idx = get_sign_index(current_sign)
        
        # Ищем момент перехода в следующий знак
        search_jd = start_jd
        step = 0.1  # Шаг поиска (0.1 день = 2.4 часа)
        
        # Для медленных планет используем больший шаг
        if planet_name in ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']:
            step = 1.0  # 1 день
        
        while search_jd < end_jd:
            pos, _ = swe.calc(search_jd, planet_id, swe.FLG_SWIEPH)
            lon = pos[0]
            sign = get_zodiac_sign(lon)
            sign_idx = get_sign_index(sign)
            
            # Проверяем переход в новый знак
            if sign_idx != current_sign_idx:
                # Уточняем момент перехода с точностью до часа
                precise_jd = search_jd - step
                for _ in range(int(step * 24) + 24):  # Ищем с точностью до часа + запас
                    precise_pos, _ = swe.calc(precise_jd, planet_id, swe.FLG_SWIEPH)
                    precise_lon = precise_pos[0]
                    precise_sign = get_zodiac_sign(precise_lon)
                    
                    if precise_sign == sign:
                        # Нашли точный момент перехода
                        date = jd_to_datetime(precise_jd)
                        
                        transits.append({
                            'type': 'planet_transit',
                            'planet': planet_name,
                            'date': date.isoformat(),
                            'jd': precise_jd,
                            'from_sign': current_sign,
                            'to_sign': sign,
                            'degree': 0.0  # Всегда 0° при переходе
                        })
                        break
                    
                    precise_jd += 1.0 / 24.0  # Шаг 1 час
                
                # Обновляем текущий знак
                current_sign = sign
                current_sign_idx = sign_idx
            
            search_jd += step
    
    # Сортируем по дате
    transits.sort(key=lambda x: x['jd'])
    return transits

def calculate_important_dates(params):
    """
    Главная функция расчёта важных дат
    
    Args:
        params: dict с полями:
            - start_date: ISO формат (YYYY-MM-DD)
            - days_forward: количество дней вперёд (по умолчанию 60)
    
    Returns:
        dict с событиями
    """
    start_date_str = params.get('start_date')
    days_forward = params.get('days_forward', 60)
    
    # Парсим дату
    if start_date_str:
        start_date = datetime.fromisoformat(start_date_str)
    else:
        start_date = datetime.utcnow()
    
    # Вычисляем юлианские дни
    start_jd = swe.julday(
        start_date.year, 
        start_date.month, 
        start_date.day, 
        0,  # Полночь UTC
        swe.GREG_CAL
    )
    
    end_date = start_date + timedelta(days=days_forward)
    end_jd = swe.julday(
        end_date.year,
        end_date.month,
        end_date.day,
        0,
        swe.GREG_CAL
    )
    
    print(f"[IMPORTANT DATES] Calculating from {start_date.date()} to {end_date.date()}", file=sys.stderr)
    print(f"[IMPORTANT DATES] JD range: {start_jd} to {end_jd}", file=sys.stderr)
    
    # Ищем лунные фазы
    lunar_phases = find_lunar_phases(start_jd, end_jd)
    print(f"[IMPORTANT DATES] Found {len(lunar_phases)} lunar phases", file=sys.stderr)
    
    # Ищем транзиты планет
    planet_transits = find_planet_transits(start_jd, end_jd, days_forward)
    print(f"[IMPORTANT DATES] Found {len(planet_transits)} planet transits", file=sys.stderr)
    
    # Объединяем все события
    all_events = lunar_phases + planet_transits
    all_events.sort(key=lambda x: x['jd'])
    
    # Убираем служебное поле jd из результата
    for event in all_events:
        del event['jd']
    
    return {
        'events': all_events,
        'period': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
            'days': days_forward
        }
    }

def main():
    try:
        # Читаем входные данные из stdin
        input_data = json.load(sys.stdin)
        
        print(f"[IMPORTANT DATES] Input: {input_data}", file=sys.stderr)
        
        # Вычисляем важные даты
        result = calculate_important_dates(input_data)
        
        # Выводим результат
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        print(f"[IMPORTANT DATES ERROR] {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        
        error_result = {
            'error': str(e),
            'traceback': traceback.format_exc()
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()
