import assert from 'node:assert/strict';
import { calendarNumber, connection, yearSpread, birthPositions } from '../shared/campCards';
import { compactCard, cardMeaning, linkStory } from '../shared/campReadings';
import { indexSource, readIndices } from '../shared/campIndices';
import { natalAspects } from '../shared/readingThemes';
import { calcMatrixFromISO } from '../shared/matrix';

for (let i=1;i<=52;i++) {
  const url=new URL(indexSource(i,i));
  const d='2000-'+url.searchParams.get('month1')!.padStart(2,'0')+'-'+url.searchParams.get('day1')!.padStart(2,'0');
  assert.equal(calendarNumber(d),i);
  assert.ok(cardMeaning(i).length>60);
  assert.ok(birthPositions(i).periods.length===7);
}
assert.equal(new Set(Array.from({length:52},(_,i)=>cardMeaning(i+1))).size,52);
assert.equal(calendarNumber('2000-12-31'),0);
assert.equal(compactCard(birthPositions(40).cosmicLesson),'6♥');
assert.equal(compactCard(birthPositions(9).cosmicLesson),'4♥');
assert.ok(calcMatrixFromISO('1999-02-11T00:00:00.000Z')?.ageDecades.length===8);
assert.equal(yearSpread(29,19)?.periods.length,7);
const a=calendarNumber('2000-09-15')!, d=calendarNumber('2026-11-23')!;
const day=connection(a,d);
assert.deepEqual([d,a,day.field,day.second,day.first].map(compactCard),['10♥','9♣','6♦','3♠','2♥']);
// Daily positions returned by the public Tragos daily form on 2026-11-23.
const dayReferences = [
  ['2000-09-15', '2000-11-23', '10♥ 9♣ 6♦ 3♠ 2♥'],
  ['2000-05-13', '2000-12-01', '4♦ 6♦ 10♥ A♠ 3♠'],
  ['2000-02-29', '2000-03-01', '9♠ 9♣ 5♣ A♣ A♠'],
  ['2000-03-01', '2000-02-29', '9♣ 9♠ 5♣ A♠ A♣'],
  ['2000-12-25', '2000-01-01', 'K♠ 6♥ 6♥ 6♥ Q♥'],
  ['2000-01-03', '2000-12-30', 'A♥ J♠ Q♠ K♠ 10♠'],
  ['2000-01-31', '2000-02-28', '10♣ 9♣ 6♠ 3♣ 2♣'],
  ['2000-01-01', '2000-01-01', 'K♠ K♠ K♠ K♠ K♠'],
  ['2000-04-01', '2000-04-01', '7♠ 7♠ A♠ 8♦ 8♦'],
  ['2000-05-01', '2000-07-25', '3♣ 5♠ 8♥ J♣ K♠'],
  ['2000-02-11', '2000-12-22', '9♥ A♠ 10♠ 6♥ J♦'],
  ['2000-12-22', '2000-02-11', 'A♠ 9♥ 10♠ J♦ 6♥'],
  ['2000-07-17', '2000-09-07', '4♦ J♣ 2♥ 6♦ K♣'],
  ['2000-10-01', '2000-11-01', '6♦ 8♦ A♣ 7♠ 9♠'],
  ['2000-08-18', '2000-09-21', '3♣ 8♣ J♦ A♥ 6♥'],
  ['2000-05-29', '2000-07-20', '8♣ 3♣ J♦ 6♥ A♥'],
  ['2000-11-18', '2000-11-28', '5♥ 2♣ 7♣ Q♣ 9♦'],
  ['2000-06-01', '2000-01-06', '8♠ 3♠ J♦ 6♦ A♦'],
  ['2000-11-06', '2000-02-01', 'J♠ A♦ Q♣ 10♣ K♠'],
  ['2000-08-13', '2000-05-20', 'Q♣ K♣ Q♠ J♣ Q♣'],
] as const;
for (const [birth, target, expected] of dayReferences) {
  const first=calendarNumber(birth)!, second=calendarNumber(target)!;
  const positions=connection(first,second);
  assert.equal([second,first,positions.field,positions.second,positions.first].map(compactCard).join(' '),expected);
}
const [aspect]=natalAspects([{name:'Mercury',position:355},{name:'Uranus',position:55}]);
assert.equal(aspect.ru,'Секстиль'); assert.match(aspect.text,/Меркурий.+Уран/);
assert.throws(()=>readIndices('<html>temporarily unavailable</html>'));
if (process.argv.includes('--live')) {
  for (const [first,second,expected] of [[40,9,[6,0,5,6,-1,5]],[9,40,[6,-1,5,6,0,5]],[44,37,[6,2,1,5,4,-1]]] as const) {
    const response=await fetch(indexSource(first,second),{signal:AbortSignal.timeout(12000)});
    assert.equal(response.status,200);
    const rows=readIndices(await response.text());
    assert.deepEqual(rows.flatMap(r=>[r.attraction,r.tension,r.compatibility]),expected);
    assert.ok(rows[0].links.some(link=>linkStory(link,false).length>80));
  }
}
console.log('Reading regression checks passed');
