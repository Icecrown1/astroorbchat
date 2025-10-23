#!/usr/bin/env python3
"""
API wrapper для расчёта натальной карты через Swiss Ephemeris
Принимает JSON на stdin, возвращает JSON на stdout
"""

import swisseph as swe
import json
import sys
from datetime import datetime


ZODIAC_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", 
    "Leo", "Virgo", "Libra", "Scorpio",
    "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]

PLANETS = {
    'Sun': swe.SUN,
    'Moon': swe.MOON,
    'Mercury': swe.MERCURY,
    'Venus': swe.VENUS,
    'Mars': swe.MARS,
    'Jupiter': swe.JUPITER,
    'Saturn': swe.SATURN,
    'Uranus': swe.URANUS,
    'Neptune': swe.NEPTUNE,
    'Pluto': swe.PLUTO,
    'North Node': swe.TRUE_NODE,
    'South Node': swe.TRUE_NODE  # South Node рассчитывается как North Node + 180°
}

HOUSE_SYSTEMS = {
    'Placidus': b'P',
    'Koch': b'K',
    'Porphyry': b'O',
    'Whole Sign': b'W',
}


def get_zodiac_sign(longitude):
    longitude = longitude % 360
    sign_index = int(longitude / 30)
    return ZODIAC_SIGNS[sign_index]


def calculate_natal_chart(birth_data):
    """
    Рассчитывает натальную карту
    
    Args:
        birth_data: dict с полями:
            - year, month, day, hour, minute (обязательные)
            - latitude, longitude (обязательные)
            - house_system (опционально, по умолчанию 'Placidus')
    
    Returns:
        dict с рассчитанной натальной картой
    """
    year = birth_data['year']
    month = birth_data['month']
    day = birth_data['day']
    hour = birth_data['hour']
    minute = birth_data['minute']
    latitude = birth_data['latitude']
    longitude = birth_data['longitude']
    house_system = birth_data.get('house_system', 'Placidus')
    
    # ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ
    print(f"[NATAL CALC] INPUT DATA:", file=sys.stderr)
    print(f"  Date: {year}-{month:02d}-{day:02d}", file=sys.stderr)
    print(f"  Time: {hour:02d}:{minute:02d}", file=sys.stderr)
    print(f"  Location: {latitude}°N, {longitude}°E", file=sys.stderr)
    print(f"  House system: {house_system}", file=sys.stderr)
    
    # Преобразуем в десятичные часы
    decimal_hour = hour + minute / 60.0
    print(f"  Decimal hour: {decimal_hour}", file=sys.stderr)
    
    # Юлианский день
    jd_ut = swe.julday(year, month, day, decimal_hour, swe.GREG_CAL)
    delta_t = swe.deltat(jd_ut)
    jd_tt = jd_ut + delta_t / 86400.0
    
    print(f"  Julian Day (UT): {jd_ut}", file=sys.stderr)
    print(f"  Delta T: {delta_t} sec", file=sys.stderr)
    print(f"  Julian Day (TT): {jd_tt}", file=sys.stderr)
    
    # Рассчитываем позиции планет
    planets_data = {}
    north_node_lon = None
    
    for planet_name, planet_id in PLANETS.items():
        try:
            # Специальная обработка для South Node
            if planet_name == 'South Node':
                if north_node_lon is None:
                    # Если North Node еще не рассчитан, рассчитываем его
                    nn_position, _ = swe.calc(jd_tt, swe.TRUE_NODE, swe.FLG_SWIEPH)
                    north_node_lon = nn_position[0]
                
                # South Node = North Node + 180°
                lon = (north_node_lon + 180) % 360
                planets_data[planet_name] = {
                    'longitude': round(lon, 4),
                    'latitude': 0,  # South Node всегда на эклиптике
                    'sign': get_zodiac_sign(lon),
                    'degree_in_sign': round(lon % 30, 4)
                }
            else:
                position, _ = swe.calc(jd_tt, planet_id, swe.FLG_SWIEPH)
                lon = position[0]
                
                # Сохраняем долготу North Node для расчета South Node
                if planet_name == 'North Node':
                    north_node_lon = lon
                
                planets_data[planet_name] = {
                    'longitude': round(lon, 4),
                    'latitude': round(position[1], 4),
                    'sign': get_zodiac_sign(lon),
                    'degree_in_sign': round(lon % 30, 4)
                }
        except Exception as e:
            planets_data[planet_name] = {'error': str(e)}
    
    # Рассчитываем дома и углы
    house_code = HOUSE_SYSTEMS.get(house_system, b'P')
    cusps, ascmc = swe.houses(jd_tt, latitude, longitude, house_code)
    
    print(f"[NATAL CALC] HOUSES & ANGLES:", file=sys.stderr)
    print(f"  Ascendant: {ascmc[0]:.4f}° = {get_zodiac_sign(ascmc[0])} {ascmc[0] % 30:.2f}°", file=sys.stderr)
    print(f"  MC: {ascmc[1]:.4f}° = {get_zodiac_sign(ascmc[1])} {ascmc[1] % 30:.2f}°", file=sys.stderr)
    
    angles = {
        'Ascendant': {
            'longitude': round(ascmc[0], 4),
            'sign': get_zodiac_sign(ascmc[0]),
            'degree_in_sign': round(ascmc[0] % 30, 4)
        },
        'MC': {
            'longitude': round(ascmc[1], 4),
            'sign': get_zodiac_sign(ascmc[1]),
            'degree_in_sign': round(ascmc[1] % 30, 4)
        },
        'Descendant': {
            'longitude': round((ascmc[0] + 180) % 360, 4),
            'sign': get_zodiac_sign((ascmc[0] + 180) % 360),
            'degree_in_sign': round(((ascmc[0] + 180) % 360) % 30, 4)
        },
        'IC': {
            'longitude': round((ascmc[1] + 180) % 360, 4),
            'sign': get_zodiac_sign((ascmc[1] + 180) % 360),
            'degree_in_sign': round(((ascmc[1] + 180) % 360) % 30, 4)
        }
    }
    
    house_cusps = [round(cusp, 4) for cusp in cusps]
    
    return {
        'planets': planets_data,
        'houses': {
            'system': house_system,
            'cusps': house_cusps
        },
        'angles': angles,
        'julian_day': round(jd_tt, 6)
    }


def calculate_transits(transit_data):
    """
    Рассчитывает позиции планет на указанную дату (транзиты)
    
    Args:
        transit_data: dict с полями:
            - year, month, day, hour, minute (обязательные)
    
    Returns:
        dict с позициями планет
    """
    year = transit_data['year']
    month = transit_data['month']
    day = transit_data['day']
    hour = transit_data['hour']
    minute = transit_data['minute']
    
    print(f"[TRANSITS] Calculating for {year}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}", file=sys.stderr)
    
    # Преобразуем в десятичные часы
    decimal_hour = hour + minute / 60.0
    
    # Юлианский день
    jd_ut = swe.julday(year, month, day, decimal_hour, swe.GREG_CAL)
    delta_t = swe.deltat(jd_ut)
    jd_tt = jd_ut + delta_t / 86400.0
    
    # Рассчитываем позиции планет
    planets_data = {}
    north_node_lon = None
    
    for planet_name, planet_id in PLANETS.items():
        try:
            # Специальная обработка для South Node
            if planet_name == 'South Node':
                if north_node_lon is None:
                    # Если North Node еще не рассчитан, рассчитываем его
                    nn_position, _ = swe.calc(jd_tt, swe.TRUE_NODE, swe.FLG_SWIEPH)
                    north_node_lon = nn_position[0]
                
                # South Node = North Node + 180°
                lon = (north_node_lon + 180) % 360
                planets_data[planet_name] = {
                    'longitude': round(lon, 4),
                    'latitude': 0,  # South Node всегда на эклиптике
                    'sign': get_zodiac_sign(lon),
                    'degree_in_sign': round(lon % 30, 4)
                }
            else:
                position, _ = swe.calc(jd_tt, planet_id, swe.FLG_SWIEPH)
                lon = position[0]
                
                # Сохраняем долготу North Node для расчета South Node
                if planet_name == 'North Node':
                    north_node_lon = lon
                
                planets_data[planet_name] = {
                    'longitude': round(lon, 4),
                    'latitude': round(position[1], 4),
                    'sign': get_zodiac_sign(lon),
                    'degree_in_sign': round(lon % 30, 4)
                }
        except Exception as e:
            print(f"[TRANSITS] Warning: couldn't calculate {planet_name}: {e}", file=sys.stderr)
            continue
    
    print(f"[TRANSITS] Calculated {len(planets_data)} planets", file=sys.stderr)
    
    return {
        'planets': planets_data,
        'date': f"{year}-{month:02d}-{day:02d}",
        'time': f"{hour:02d}:{minute:02d}"
    }


def calculate_solar_return_time(natal_sun_longitude, birth_month, birth_day, target_year):
    """
    Находит точное время Solar Return - момент, когда Солнце возвращается в натальную позицию
    
    Args:
        natal_sun_longitude: Долгота Солнца при рождении (0-360°)
        birth_month: Месяц рождения (1-12)
        birth_day: День рождения (1-31)
        target_year: Целевой год для расчета Solar Return
    
    Returns:
        dict с полями: year, month, day, hour, minute - точное время Solar Return
    """
    print(f"[SOLAR RETURN] Calculating for target year {target_year}", file=sys.stderr)
    print(f"[SOLAR RETURN] Natal Sun longitude: {natal_sun_longitude}°", file=sys.stderr)
    
    # Начинаем с предполагаемой даты (день рождения в целевом году)
    # Солнце может вернуться на день раньше или позже из-за високосных годов
    search_year = target_year
    search_month = birth_month
    search_day = birth_day
    
    # Проверяем возможные дни вокруг дня рождения
    for day_offset in range(-2, 3):  # Проверяем от -2 до +2 дней
        try:
            test_day = birth_day + day_offset
            test_month = birth_month
            test_year = target_year
            
            # Корректируем месяц/год если day выходит за границы
            if test_day < 1:
                test_month -= 1
                if test_month < 1:
                    test_month = 12
                    test_year -= 1
                # Получаем последний день предыдущего месяца
                import calendar
                test_day = calendar.monthrange(test_year, test_month)[1] + test_day
            else:
                # Проверяем максимальный день для текущего месяца
                import calendar
                max_day = calendar.monthrange(test_year, test_month)[1]
                if test_day > max_day:
                    test_day -= max_day
                    test_month += 1
                    if test_month > 12:
                        test_month = 1
                        test_year += 1
            
            # Ищем точное время в этом дне
            for hour_offset in range(0, 24):
                jd_ut = swe.julday(test_year, test_month, test_day, hour_offset, swe.GREG_CAL)
                delta_t = swe.deltat(jd_ut)
                jd_tt = jd_ut + delta_t / 86400.0
                
                # Получаем позицию Солнца
                sun_position, _ = swe.calc(jd_tt, swe.SUN, swe.FLG_SWIEPH)
                current_sun_lon = sun_position[0]
                
                # Нормализуем углы для сравнения (учитываем переход через 0°)
                diff = abs(current_sun_lon - natal_sun_longitude)
                if diff > 180:
                    diff = 360 - diff
                
                # Если разница меньше 1°, уточняем с помощью минут
                if diff < 1.0:
                    # Ищем точное время с шагом в 1 минуту
                    best_minute = 0
                    min_diff = diff
                    
                    for minute_offset in range(0, 60):
                        decimal_hour = hour_offset + minute_offset / 60.0
                        jd_ut = swe.julday(test_year, test_month, test_day, decimal_hour, swe.GREG_CAL)
                        delta_t = swe.deltat(jd_ut)
                        jd_tt = jd_ut + delta_t / 86400.0
                        
                        sun_position, _ = swe.calc(jd_tt, swe.SUN, swe.FLG_SWIEPH)
                        current_sun_lon = sun_position[0]
                        
                        diff = abs(current_sun_lon - natal_sun_longitude)
                        if diff > 180:
                            diff = 360 - diff
                        
                        if diff < min_diff:
                            min_diff = diff
                            best_minute = minute_offset
                    
                    print(f"[SOLAR RETURN] Found at {test_year}-{test_month:02d}-{test_day:02d} {hour_offset:02d}:{best_minute:02d}", file=sys.stderr)
                    print(f"[SOLAR RETURN] Sun longitude difference: {min_diff:.4f}°", file=sys.stderr)
                    
                    return {
                        'year': test_year,
                        'month': test_month,
                        'day': test_day,
                        'hour': hour_offset,
                        'minute': best_minute
                    }
        except Exception as e:
            print(f"[SOLAR RETURN] Error checking day offset {day_offset}: {e}", file=sys.stderr)
            continue
    
    # Если не нашли точное время, возвращаем день рождения в полдень
    print(f"[SOLAR RETURN] WARNING: Could not find exact time, using birthday noon", file=sys.stderr)
    return {
        'year': target_year,
        'month': birth_month,
        'day': birth_day,
        'hour': 12,
        'minute': 0
    }


if __name__ == '__main__':
    try:
        # Читаем входные данные из stdin
        input_data = json.load(sys.stdin)
        
        # Определяем тип запроса
        request_type = input_data.get('type', 'natal_chart')
        
        if request_type == 'solar_return_time':
            # Рассчитываем точное время Solar Return
            natal_sun_longitude = input_data['natal_sun_longitude']
            birth_month = input_data['birth_month']
            birth_day = input_data['birth_day']
            target_year = input_data['target_year']
            
            result = calculate_solar_return_time(
                natal_sun_longitude,
                birth_month,
                birth_day,
                target_year
            )
        elif request_type == 'transits':
            # Рассчитываем транзиты
            result = calculate_transits(input_data)
        else:
            # Рассчитываем натальную карту
            result = calculate_natal_chart(input_data)
        
        # Выводим результат в stdout
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)
        
    except Exception as e:
        # В случае ошибки выводим её в stderr
        error_result = {
            'error': str(e),
            'type': type(e).__name__
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)
