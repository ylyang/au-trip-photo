import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /const RESTAURANT_BOOKINGS = \[/, 'booking checklist data must exist');
assert.match(html, /餐厅预订清单/, 'booking checklist must be visible in the food section');
assert.match(html, /Higher Ground',note:'2 人 · 订位已确认/, 'Higher Ground must be marked confirmed');
assert.match(html, /time:'12:15–13:45'[^\n]*Higher Ground/, 'Higher Ground confirmed booking time must be shown');
assert.match(html, /booking-action confirmed/, 'confirmed bookings need a distinct non-action state');

for(const provider of [
  'sevenrooms.com/explore/higherground/reservations',
  'asado.melbourne/bookings',
  'opentable.com.au/r/coral-sea-pavilion-reservations-airlie-beach',
  'opentable.com.au/r/the-deck-airlie-beach-reservations-airlie-beach',
  'sevenrooms.com/explore/glenmorehotel/reservations'
]){
  assert.ok(html.includes(provider), `missing verified reservation route: ${provider}`);
}

for(const phone of [
  '+61 3 8899 6219',
  '+61 3 9088 8600',
  '+61 7 4964 1300',
  '+61 7 4948 2721',
  '+61 2 9247 4794'
]){
  assert.ok(html.includes(phone), `missing telephone fallback: ${phone}`);
}

assert.match(html, /Stalactites[\s\S]*?2 人晚餐不接受预约/, 'Stalactites must be described as walk-in for two');
assert.match(html, /name:'Coogee 海边快速午餐'[^\n]*level:'无需预订'/, 'D9 quick lunch must not become a reservation requirement');
assert.match(html, /晚餐 · Coral Sea Pavilion（建议预约）/, 'D5 dinner must use a currently verifiable restaurant');
assert.doesNotMatch(html, /晚餐 · Fish D’Vine（建议预约）/, 'the unverified Fish D’Vine dinner must not remain in the itinerary');
assert.match(html, /p\.book \|\| p\.bookNote/, 'POI detail sheets must expose booking guidance');

console.log('PASS: verified restaurant booking links, phone fallbacks, walk-in guidance, and D5 replacement are present.');
