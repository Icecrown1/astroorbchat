import { plate } from './Editorial';

const format = value => Number(value).toLocaleString('ru-RU');

export function StarConfirmation({ title, balance, cost, onCancel, onConfirm, busy }) {
  const enough = balance != null && Number.isFinite(Number(balance)) && Number(balance) >= cost;
  return <section className="result-card star-confirmation" aria-label="Подтверждение разбора">
    <div className="bill-heading"><h2>Подтверждение разбора</h2><img src={plate(title === 'Совместимость' ? 'couple' : title === 'Вопрос Оракулу' ? 'owl' : 'hand')} alt="" /></div>
    <h3>{title}</h3>
    <dl>
      <div><dt>Баланс</dt><dd>{balance == null ? '—' : `${format(balance)} ★`}</dd></div>
      <div><dt>Стоимость</dt><dd>{format(cost)} ★</dd></div>
      {enough && <div><dt>Останется</dt><dd>{format(Number(balance) - cost)} ★</dd></div>}
    </dl>
    {enough ? <p>Списание с баланса приложения.</p> : <p>Недостаточно звёзд для этого разбора.</p>}
    <button type="button" disabled={!enough || busy} onClick={onConfirm}>Списать {format(cost)} ★</button>
    <button type="button" className="secondary-button" onClick={onCancel}>Отмена</button>
  </section>;
}
