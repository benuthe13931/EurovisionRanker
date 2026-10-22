import assert from 'node:assert/strict';
import { createServer } from 'vite';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};
const server = await createServer({
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54321'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-key'),
  },
  server: { middlewareMode: true },
});
try {
  const { allSongs, dataByRegion, regionForContest } = await server.ssrLoadModule('/src/data/years.ts');
  const { sourceSongsForSettings, defaultQuizSettings } = await server.ssrLoadModule('/src/utils/trivia.ts');
  const global = await server.ssrLoadModule('/src/utils/regionalGlobalRanking.ts');
  const { regionalTriviaStorage } = await server.ssrLoadModule('/src/utils/regionalTriviaStorage.ts');
  const { rankingContextFromKey } = await server.ssrLoadModule('/src/utils/storage.ts');
  const europe = dataByRegion.europe;
  const asia = dataByRegion.asia;
  assert(europe.allSongs.length && asia.allSongs.length);
  assert.equal(europe.allSongs.length + asia.allSongs.length, allSongs.length);
  for (const region of ['europe', 'asia']) {
    const data = dataByRegion[region];
    assert(data.allSongs.every(song => regionForContest(song.contestId) === region));
    assert(data.countries.every(country => country.songs.every(song => regionForContest(song.contestId) === region)));
    for (const scope of ['year', 'country', 'expert']) {
      const songs = sourceSongsForSettings({ ...defaultQuizSettings, region, scope, year: data.years[0].id, countrySlug: data.countries[0].slug });
      assert(songs.length);
      assert(songs.every(song => regionForContest(song.contestId) === region));
    }
  }
  assert.equal(sourceSongsForSettings({ ...defaultQuizSettings, region: 'europe', year: '2026-asia' }).length, 0);
  const ranking = songs => ({ globalOrder: songs.map(s => s.id), insertedYears: [], totalSongCount: songs.length, manualAdjustments: [], updatedAt: new Date().toISOString() });
  const oldEurope = ranking(europe.allSongs.slice(0, 2));
  localStorage.setItem('eurovision-ranker:global-ranking', JSON.stringify(oldEurope));
  assert.deepEqual((await global.loadRegionalGlobalRanking('europe')).globalOrder, oldEurope.globalOrder);
  await global.saveRegionalGlobalRanking(ranking(asia.allSongs), 'asia');
  assert.deepEqual((await global.loadRegionalGlobalRanking('europe')).globalOrder, oldEurope.globalOrder);
  await global.saveRegionalGlobalRanking(ranking(europe.allSongs.slice(0, 3)), 'europe');
  assert.equal((await global.loadRegionalGlobalRanking('asia')).globalOrder.length, asia.allSongs.length);
  await global.clearRegionalGlobalRanking('asia');
  assert.equal((await global.loadRegionalGlobalRanking('europe')).globalOrder.length, 3);
  assert.equal((await global.loadRegionalGlobalRanking('asia')).globalOrder.length, 0);
  const europeQuiz = regionalTriviaStorage('europe');
  const asiaQuiz = regionalTriviaStorage('asia');
  const legacyQuiz = { settings: { scope: 'expert' }, savedAt: '2026-01-01' };
  localStorage.setItem('eurovision-ranker:trivia-session', JSON.stringify(legacyQuiz));
  assert.deepEqual(europeQuiz.loadLocalTriviaSession(), legacyQuiz);
  assert.equal(asiaQuiz.loadLocalTriviaSession(), null);
  asiaQuiz.saveLocalTriviaSession({ settings: { region: 'asia' }, savedAt: '2026-02-01' });
  assert.deepEqual(europeQuiz.loadLocalTriviaSession(), legacyQuiz);
  await europeQuiz.clearTriviaSession();
  assert.equal(europeQuiz.loadLocalTriviaSession(), null);
  assert.equal(asiaQuiz.loadLocalTriviaSession().settings.region, 'asia');
  assert.notDeepEqual(rankingContextFromKey('global:asia'), rankingContextFromKey('global'));
  assert.notDeepEqual(rankingContextFromKey('country:australia:asia'), rankingContextFromKey('country:australia'));
  // Exercise the synced JSON contract without contacting a server.
  const { supabase } = await server.ssrLoadModule('/src/utils/supabase.ts');
  const remote = new Map();
  supabase.rpc = async (name, args) => {
    const type = name.includes('trivia') ? 'trivia' : 'global';
    if (name.startsWith('get_')) return { data: remote.get(type) ?? null, error: null };
    if (name.startsWith('save_')) {
      remote.set(type, structuredClone(args.p_state));
      return { data: args.p_state, error: null };
    }
    throw new Error(`Unexpected RPC: ${name}`);
  };
  localStorage.setItem('eurovision-ranker:active-profile', JSON.stringify({ id: '00000000-0000-4000-8000-000000000001' }));
  await global.saveRegionalGlobalRanking(oldEurope, 'europe');
  await global.saveRegionalGlobalRanking(ranking(asia.allSongs), 'asia');
  await global.clearRegionalGlobalRanking('europe');
  assert.equal((await global.loadRegionalGlobalRanking('asia')).globalOrder.length, asia.allSongs.length);
  assert.equal((await global.loadRegionalGlobalRanking('europe')).globalOrder.length, 0);
  await europeQuiz.saveRemoteTriviaSession(legacyQuiz);
  await asiaQuiz.saveRemoteTriviaSession({ settings: { region: 'asia' }, savedAt: '2026-02-01' });
  await europeQuiz.clearTriviaSession();
  assert.equal(await europeQuiz.loadRemoteTriviaSession(), null);
  assert.equal((await asiaQuiz.loadRemoteTriviaSession()).settings.region, 'asia');
  assert.equal((await asiaQuiz.getTriviaSessionMetadata()).hasSession, true);
  console.log('PASS: region datasets, trivia pools, legacy saves, independent global saves/resets, independent quiz saves/resets, snapshot scopes');
} finally {
  await server.close();
}
