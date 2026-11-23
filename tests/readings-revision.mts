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
