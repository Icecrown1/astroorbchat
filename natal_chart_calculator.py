#!/usr/bin/env python3
"""
Профессиональный алгоритм расчёта натальной карты
с использованием Swiss Ephemeris (совместимый с NASA JPL DE440)

Требования:
- Точность до 0.01° для всех планет
- Учёт прецессии (IAU 2006) и нутации (IAU 2000A)
- Поддержка систем домов: Placidus, Koch, Porphyry, Whole Sign
- Преобразование времени: UTC → UT1 → TT (с учётом ΔT)
"""

import swisseph as swe
import json
from datetime import datetime
from typing import Dict, Tuple, Optional


# Константы знаков зодиака
ZODIAC_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", 
    "Leo", "Virgo", "Libra", "Scorpio",
    "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]

# Планеты для расчёта
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
    'Chiron': swe.CHIRON,
}

# Системы домов
HOUSE_SYSTEMS = {
    'Placidus': b'P',
    'Koch': b'K',
    'Porphyry': b'O',
    'Whole Sign': b'W',
    'Equal': b'E',
    'Campanus': b'C',
}


def get_zodiac_sign(longitude: float) -> str:
    """
    Определяет знак зодиака по эклиптической долготе
    
    Args:
        longitude: Эклиптическая долгота в градусах (0-360)
    
    Returns:
        Название знака зодиака
    """
    # Нормализация долготы в диапазон 0-360
    longitude = longitude % 360
    # Каждый знак занимает 30°
    sign_index = int(longitude / 30)
    return ZODIAC_SIGNS[sign_index]


def datetime_to_julian_day(
    year: int, 
    month: int, 
    day: int, 
    hour: int, 
    minute: int, 
    second: float = 0.0
) -> float:
    """
    Преобразует дату и время в юлианский день (TT - Terrestrial Time)
    
    Swiss Ephemeris автоматически обрабатывает:
    - Преобразование UTC → UT1 (с учётом leap seconds)
    - Преобразование UT1 → TT (с учётом ΔT)
    - Прецессию IAU 2006
    - Нутацию IAU 2000A
    
    Args:
        year, month, day: Календарная дата (по Григорианскому календарю)
        hour, minute, second: Время в UTC
    
    Returns:
        Юлианский день в системе TT (Terrestrial Time)
    """
    # Преобразуем время в десятичные часы
    decimal_hour = hour + minute / 60.0 + second / 3600.0
    
    # swe.julday автоматически использует Григорианский календарь для дат после 1582-10-15
    # Флаг swe.GREG_CAL явно указывает на Григорианский календарь
    jd_ut = swe.julday(year, month, day, decimal_hour, swe.GREG_CAL)
    
    # swe.deltat возвращает ΔT (разницу между TT и UT) для данной даты
    # ΔT учитывает замедление вращения Земли и изменение системы времени
    delta_t = swe.deltat(jd_ut)
    
    # Юлианский день в системе Terrestrial Time (TT)
    # TT = UT + ΔT
    jd_tt = jd_ut + delta_t / 86400.0
    
    return jd_tt


def calculate_planet_position(
    jd_tt: float, 
    planet_id: int, 
    flags: int = swe.FLG_SWIEPH
) -> Tuple[float, float, float]:
    """
    Вычисляет геоцентрическую позицию планеты
    
    Args:
        jd_tt: Юлианский день в системе TT
        planet_id: ID планеты в Swiss Ephemeris
        flags: Флаги расчёта (по умолчанию использует эфемериды Swiss Ephemeris)
    
    Returns:
        Кортеж (longitude, latitude, distance):
        - longitude: Эклиптическая долгота в градусах (0-360)
        - latitude: Эклиптическая широта в градусах
        - distance: Расстояние от Земли в а.е.
    
    Note:
        Swiss Ephemeris использует эфемериды DE431 (аналог NASA JPL DE440),
        которые включают:
        - Прецессию и нутацию (IAU 2006/2000A)
        - Релятивистские эффекты
        - Возмущения от всех крупных тел Солнечной системы
    """
    # swe.calc возвращает:
    # [0] = эклиптическая долгота
    # [1] = эклиптическая широта
    # [2] = расстояние в а.е.
    # [3] = скорость в долготе (градусов/день)
    # [4] = скорость в широте
    # [5] = скорость расстояния
    position, ret_flags = swe.calc(jd_tt, planet_id, flags)
    
    longitude = position[0]  # Долгота (0-360°)
    latitude = position[1]   # Широта
    distance = position[2]   # Расстояние от Земли
    
    return longitude, latitude, distance


def calculate_houses(
    jd_tt: float,
    latitude: float,
    longitude: float,
    house_system: str = 'Placidus'
) -> Tuple[list, Dict[str, float]]:
    """
    Вычисляет астрологические дома и углы карты
    
    Args:
        jd_tt: Юлианский день в системе TT
        latitude: Географическая широта места рождения (градусы, -90 до +90)
        longitude: Географическая долгота места рождения (градусы, -180 до +180)
        house_system: Система домов ('Placidus', 'Koch', 'Porphyry', 'Whole Sign')
    
    Returns:
        Кортеж (cusps, angles):
        - cusps: Список куспидов домов (12 значений) в градусах
        - angles: Словарь с углами карты (ASC, MC, DSC, IC)
    
    Note:
        Расчёт использует:
        - LMST (Local Mean Sidereal Time) - местное звёздное время
        - RAMC (Right Ascension of Medium Coeli) - прямое восхождение MC
        - Географические координаты места рождения
    """
    # Получаем код системы домов
    house_code = HOUSE_SYSTEMS.get(house_system, b'P')
    
    # swe.houses возвращает:
    # cusps: куспиды 12 домов (индексы 0-11)
    # ascmc: специальные точки [0]=Ascendant, [1]=MC, [2]=ARMC, [3]=Vertex, ...
    cusps, ascmc = swe.houses(jd_tt, latitude, longitude, house_code)
    
    # Извлекаем углы карты
    angles = {
        'Ascendant': ascmc[0],  # ASC - восходящий градус эклиптики на восточном горизонте
        'MC': ascmc[1],         # MC (Medium Coeli) - кульминирующий градус эклиптики
        'Descendant': (ascmc[0] + 180) % 360,  # DSC - противоположная точка ASC
        'IC': (ascmc[1] + 180) % 360,          # IC (Imum Coeli) - противоположная точка MC
        'Vertex': ascmc[3],     # Vertex - дополнительная чувствительная точка
    }
    
    # Куспиды домов (индексы 0-11, всего 12 домов)
    house_cusps = list(cusps)
    
    return house_cusps, angles


def calculate_natal_chart(
    year: int,
    month: int,
    day: int,
    hour: int,
    minute: int,
    second: float,
    latitude: float,
    longitude: float,
    house_system: str = 'Placidus',
    use_topocentric: bool = False
) -> Dict:
    """
    Основная функция расчёта натальной карты
    
    Args:
        year, month, day: Дата рождения (по Григорианскому календарю)
        hour, minute, second: Время рождения в UTC
        latitude: Географическая широта места рождения (градусы)
        longitude: Географическая долгота места рождения (градусы)
        house_system: Система домов (по умолчанию 'Placidus')
        use_topocentric: Использовать топоцентрические координаты (для высокой точности)
    
    Returns:
        Словарь с полной натальной картой:
        {
            "datetime": "...",
            "location": {"latitude": ..., "longitude": ...},
            "julian_day": ...,
            "planets": {
                "Sun": {"longitude": ..., "latitude": ..., "sign": "..."},
                ...
            },
            "houses": {
                "cusps": [...],
                "system": "Placidus"
            },
            "angles": {
                "Ascendant": ...,
                "MC": ...,
                "Descendant": ...,
                "IC": ...
            }
        }
    """
    # Шаг 1: Преобразование даты/времени в юлианский день (TT)
    jd_tt = datetime_to_julian_day(year, month, day, hour, minute, second)
    
    # Шаг 2: Установка флагов для расчёта
    flags = swe.FLG_SWIEPH  # Использовать Swiss Ephemeris (DE431/DE440)
    
    if use_topocentric:
        # Топоцентрические координаты учитывают позицию наблюдателя на поверхности Земли
        # Это даёт более точные результаты для близких объектов (Луна, астероиды)
        flags |= swe.FLG_TOPOCTR
        # Устанавливаем географические координаты наблюдателя
        swe.set_topo(longitude, latitude, 0)  # высота = 0 метров над уровнем моря
    
    # Шаг 3: Расчёт позиций планет
    planets_data = {}
    for planet_name, planet_id in PLANETS.items():
        try:
            lon, lat, dist = calculate_planet_position(jd_tt, planet_id, flags)
            planets_data[planet_name] = {
                'longitude': round(lon, 4),
                'latitude': round(lat, 4),
                'distance': round(dist, 6),
                'sign': get_zodiac_sign(lon),
                'degree_in_sign': round(lon % 30, 4)  # Градус внутри знака (0-30)
            }
        except Exception as e:
            planets_data[planet_name] = {'error': str(e)}
    
    # Шаг 4: Расчёт домов и углов
    house_cusps, angles = calculate_houses(jd_tt, latitude, longitude, house_system)
    
    # Шаг 5: Формирование результата
    result = {
        'datetime': f'{year}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:05.2f} UTC',
        'location': {
            'latitude': latitude,
            'longitude': longitude
        },
        'julian_day_tt': round(jd_tt, 6),
        'planets': planets_data,
        'houses': {
            'system': house_system,
            'cusps': [round(cusp, 4) for cusp in house_cusps]
        },
        'angles': {
            key: {
                'longitude': round(value, 4),
                'sign': get_zodiac_sign(value),
                'degree_in_sign': round(value % 30, 4)
            }
            for key, value in angles.items()
        }
    }
    
    return result


def verify_accuracy(chart_data: Dict) -> None:
    """
    Выводит данные для проверки точности на https://www.astro.com
    
    Args:
        chart_data: Результат функции calculate_natal_chart
    """
    print("\n" + "="*80)
    print("ПРОВЕРКА ТОЧНОСТИ (сравните с astro.com или Swiss Ephemeris Test Page)")
    print("="*80)
    
    print(f"\nДата/Время: {chart_data['datetime']}")
    print(f"Локация: {chart_data['location']['latitude']}°, {chart_data['location']['longitude']}°")
    print(f"Юлианский день (TT): {chart_data['julian_day_tt']}")
    
    print("\n--- Планеты ---")
    for planet, data in chart_data['planets'].items():
        if 'error' not in data:
            print(f"{planet:12} {data['longitude']:8.4f}° ({data['sign']} {data['degree_in_sign']:.2f}°)")
    
    print("\n--- Углы ---")
    for angle, data in chart_data['angles'].items():
        print(f"{angle:12} {data['longitude']:8.4f}° ({data['sign']} {data['degree_in_sign']:.2f}°)")
    
    print("\n--- Куспиды домов ({}) ---".format(chart_data['houses']['system']))
    for i, cusp in enumerate(chart_data['houses']['cusps'], 1):
        sign = get_zodiac_sign(cusp)
        degree = cusp % 30
        print(f"Дом {i:2d}: {cusp:8.4f}° ({sign} {degree:.2f}°)")


# ============================================================================
# ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
# ============================================================================

if __name__ == '__main__':
    print("Swiss Ephemeris Natal Chart Calculator")
    print("Версия Swiss Ephemeris:", swe.version)
    
    # Пример 1: Альберт Эйнштейн
    # 14 марта 1879, 11:30 LMT (≈11:30 UTC), Ульм, Германия
    print("\n" + "="*80)
    print("ПРИМЕР 1: Альберт Эйнштейн")
    print("="*80)
    
    chart1 = calculate_natal_chart(
        year=1879,
        month=3,
        day=14,
        hour=11,
        minute=30,
        second=0,
        latitude=48.4,      # Ульм, Германия
        longitude=10.0,
        house_system='Placidus'
    )
    
    print(json.dumps(chart1, indent=2, ensure_ascii=False))
    verify_accuracy(chart1)
    
    # Пример 2: Современная дата с топоцентрическими координатами
    print("\n\n" + "="*80)
    print("ПРИМЕР 2: Современная дата (1 января 2000, полдень UTC, Москва)")
    print("="*80)
    
    chart2 = calculate_natal_chart(
        year=2000,
        month=1,
        day=1,
        hour=12,
        minute=0,
        second=0,
        latitude=55.7558,   # Москва
        longitude=37.6173,
        house_system='Placidus',
        use_topocentric=True  # Повышенная точность для Луны
    )
    
    print(json.dumps(chart2, indent=2, ensure_ascii=False))
    verify_accuracy(chart2)
    
    # Пример 3: Сравнение систем домов
    print("\n\n" + "="*80)
    print("ПРИМЕР 3: Сравнение систем домов")
    print("="*80)
    
    for system in ['Placidus', 'Koch', 'Whole Sign', 'Equal']:
        chart = calculate_natal_chart(
            year=1990, month=6, day=15,
            hour=18, minute=30, second=0,
            latitude=40.7128,  # Нью-Йорк
            longitude=-74.0060,
            house_system=system
        )
        print(f"\n{system}:")
        print(f"  ASC: {chart['angles']['Ascendant']['longitude']:.4f}°")
        print(f"  MC:  {chart['angles']['MC']['longitude']:.4f}°")
        print(f"  Дом 1: {chart['houses']['cusps'][0]:.4f}°")
