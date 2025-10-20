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


if __name__ == '__main__':
    try:
        # Читаем входные данные из stdin
        input_data = json.load(sys.stdin)
        
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
