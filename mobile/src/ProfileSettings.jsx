import { useEffect, useState } from 'react';
import { onlineRequest } from './onlineApi';

const day = 24 * 60 * 60 * 1000;
const genders = { female: 'Женский', male: 'Мужской', other: 'Другое' };
const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'UTC' });

function profileFields(profile) {
  return {
    name: profile.name ?? '',
    gender: Object.hasOwn(genders, profile.gender) ? profile.gender : 'other',
    birthdayDate: profile.birthdayDate?.slice(0, 10) ?? '',
    birthTime: profile.birthTime ?? '',
    birthPlace: profile.birthPlace ?? '',
  };
}

function normalize(fields) {
  return { ...fields, name: fields.name.trim(), birthPlace: fields.birthPlace.trim() };
}

function matches(fields, profile) {
  const saved = normalize(profileFields(profile));
  return Object.keys(fields).every(key => fields[key] === saved[key]);
}

function birthdayAge(value, today) {
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value) return null;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const dateOfMonth = Number(value.slice(8, 10));
  const beforeBirthday = today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < dateOfMonth);
  return today.getFullYear() - year - Number(beforeBirthday);
}

export function CityField({ id = 'profile-place', name = 'birthPlace', value, change, disabled, required }) {
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const query = search.trim();
  useEffect(() => {
    if (disabled || query.length < 2) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const cities = await onlineRequest(`/api/cities/search?q=${encodeURIComponent(query)}&limit=5`);
        if (active && Array.isArray(cities)) setSuggestions({ query, cities });
      } catch {
        // The city can also be entered by hand.
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, disabled]);

  return <>
    <label htmlFor={id}>Город рождения</label>
    <input id={id} name={name} required={required} maxLength={120} value={value} placeholder="Например, Уфа, Россия"
      autoComplete="off" disabled={disabled} onChange={event => {
        setSearch(event.target.value);
        change(event.target.value);
      }} />
    {!disabled && query && suggestions?.query === query && suggestions.cities.length > 0 &&
      <div className="matrix-section-list" role="group" aria-label="Найденные города">
        {suggestions.cities.map(city => <button type="button" key={city} onClick={() => {
          change(city);
          setSearch('');
        }}>{city}</button>)}
      </div>}
  </>;
}

export function ProfileSettings({ account, openAccount, openNatal }) {
  const { token, profile, busy, run, refreshProfile, mergeProfile } = account;
  const [draft, setDraft] = useState(() => profileFields(profile));
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [unconfirmed, setUnconfirmed] = useState(null);
  const [serverDays, setServerDays] = useState(0);
  const today = new Date();
  const fields = normalize(draft);
  const age = birthdayAge(fields.birthdayDate, today);
  const dirty = !matches(fields, profile);
  const daysRemaining = serverDays || Math.max(0, Math.ceil(
    (new Date(profile.lastProfileUpdate || 0).getTime() + 30 * day - today.getTime()) / day,
  ));
  const reminders = profile.pushEnabled !== false;
  const birthDetailsChanged = ['birthdayDate', 'birthTime', 'birthPlace']
    .some(key => fields[key] !== profileFields(profile)[key]);

  function act(label, action) {
    run(async () => {
      setPending(label);
      setNotice('');
      setError('');
      try {
        await action();
      } catch (failure) {
        if (failure.expired) throw failure;
        setError(failure.message);
      } finally {
        setPending(null);
      }
    });
  }

  function update(name, value) {
    setDraft(previous => ({ ...previous, [name]: value }));
    setError('');
    setNotice('');
  }

  function updateField(event) {
    update(event.target.name, event.target.value);
  }

  function save(event) {
    event.preventDefault();
    if (busy || daysRemaining > 0 || !dirty || unconfirmed) return;
    if (!fields.name || age === null || age < 1 || age > 150) {
      setError('Укажи имя и дату рождения. Возраст должен быть от 1 до 150 лет.');
      return;
    }
    if (fields.birthTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.birthTime)) {
      setError('Проверь время рождения.');
      return;
    }

    act('save', async () => {
      let saved;
      try {
        saved = await onlineRequest('/api/user/update', {
          token, data: { ...fields, age, birthTime: fields.birthTime || null, birthPlace: fields.birthPlace || null },
        });
        if (!saved || !matches(fields, saved) || !saved.lastProfileUpdate) {
          throw Object.assign(new Error(), { uncertain: true });
        }
      } catch (failure) {
        if (Number.isInteger(failure.daysRemaining) && failure.daysRemaining > 0) {
          setServerDays(failure.daysRemaining);
          throw new Error(`До следующего изменения профиля — ${failure.daysRemaining} дн.`);
        }
        if (failure.uncertain) {
          setUnconfirmed(fields);
          throw new Error('Ответ не получен. Проверь, сохранились ли данные.');
        }
        throw failure;
      }
      mergeProfile(saved);
      setDraft(profileFields(saved));
      setNotice(birthDetailsChanged
        ? 'Данные сохранены. Открой натальную карту, чтобы пересчитать её по новым данным.'
        : 'Данные профиля сохранены.');
    });
  }

  function checkSaved() {
    act('check', async () => {
      const current = await refreshProfile(token);
      setServerDays(0);
      if (matches(unconfirmed, current)) {
        setDraft(profileFields(current));
        setNotice('Данные профиля сохранены.');
      } else {
        setNotice('Сервер пока показывает прежние данные. Черновик остался в форме.');
      }
      setUnconfirmed(null);
    });
  }

  function changeReminders() {
    act('reminders', async () => {
      try {
        const saved = await onlineRequest('/api/user/push', { token, method: 'PATCH', data: { enabled: !reminders } });
        if (typeof saved?.pushEnabled !== 'boolean') throw Object.assign(new Error(), { uncertain: true });
        mergeProfile({ pushEnabled: saved.pushEnabled });
      } catch (failure) {
        if (!failure.uncertain) throw failure;
        const current = await refreshProfile(token);
        if (current.pushEnabled !== !reminders) throw new Error('Изменение напоминаний не подтвердилось.');
      }
    });
  }

  const editingDisabled = busy || Boolean(unconfirmed) || daysRemaining > 0;

  return <section className="tarot-screen">
    <button className="secondary-button" type="button" disabled={busy} onClick={openAccount}>К профилю</button>
    <h1>Настройки профиля</h1>
    <form className="online-spread" onSubmit={save}>
      <h2>Данные рождения</h2>
      <p>Профиль можно менять раз в 30 дней.{daysRemaining > 0 && ` До следующего изменения — ${daysRemaining} дн.`}</p>
      <label htmlFor="profile-name">Имя</label>
      <input id="profile-name" name="name" value={draft.name} onChange={updateField} required disabled={editingDisabled} autoComplete="given-name" />
      <label htmlFor="profile-gender">Пол</label>
      <select id="profile-gender" name="gender" value={draft.gender} onChange={updateField} disabled={editingDisabled}>
        {Object.entries(genders).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      <label htmlFor="profile-birthday">Дата рождения</label>
      <input id="profile-birthday" name="birthdayDate" type="date" value={draft.birthdayDate} onChange={updateField}
        max={[today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')}
        required disabled={editingDisabled} />
      <label htmlFor="profile-time">Время рождения</label>
      <input id="profile-time" name="birthTime" type="time" value={draft.birthTime} onChange={updateField} disabled={editingDisabled} />
      <CityField value={draft.birthPlace} change={city => update('birthPlace', city)} disabled={editingDisabled} />
      {!draft.birthTime && <p>Без точного времени натальная карта строится на 12:00.</p>}
      <button type="submit" disabled={editingDisabled || !dirty}>
        {pending === 'save' ? 'Сохраняем…' : 'Сохранить данные'}
      </button>
      {unconfirmed && <button className="secondary-button" type="button" onClick={checkSaved} disabled={busy}>Проверить сохранение</button>}
    </form>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    {profile.birthdayDate && profile.birthPlace && <button className="secondary-button" type="button" disabled={busy} onClick={openNatal}>
      Открыть натальную карту
    </button>}
    <section className="profile-card" aria-label="Напоминания в Telegram">
      <h2>Напоминания в Telegram</h2>
      <button className="secondary-button" type="button" role="switch" aria-checked={reminders}
        disabled={busy} aria-label="Напоминания в Telegram" onClick={changeReminders}>
        {pending === 'reminders' ? 'Сохраняем…' : reminders ? 'Включены' : 'Выключены'}
      </button>
    </section>
  </section>;
}

export function BirthDetails({ profile, openSettings, busy }) {
  const fields = profileFields(profile);
  const date = new Date(fields.birthdayDate);
  const showDate = Number.isFinite(date.getTime()) && (fields.birthPlace || birthdayAge(fields.birthdayDate, new Date()) > 0);
  return <div className="profile-card">
    <h2>Данные рождения</h2>
    <p>{[showDate && dateFormat.format(date), fields.birthTime, fields.birthPlace].filter(Boolean).join(' · ') ||
      'Добавь данные рождения для персональных расчётов.'}</p>
    <button type="button" className="secondary-button" disabled={busy} onClick={openSettings}>Настройки профиля</button>
  </div>;
}
