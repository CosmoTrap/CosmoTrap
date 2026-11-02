// Génère les bruitages et les voix françaises avec l'API ElevenLabs, puis met à jour public/audio/manifest.json.
// Usage : ELEVENLABS_API_KEY=xxx npx tsx scripts/generate-audio.ts [--voice <voice_id>] [--force]
// Les fichiers existants sont gardés (sauf --force). La musique (Suno) se dépose à la main : music_*.mp3.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fr } from '../src/i18n/fr'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) {
  console.error('Définis ELEVENLABS_API_KEY (clé API ElevenLabs) avant de lancer le script.')
  process.exit(1)
}
const args = process.argv.slice(2)
const force = args.includes('--force')
const VOICE = args.includes('--voice') ? args[args.indexOf('--voice') + 1] : 'pNInz6obpgDQGcFmaJgB' // voix multilingue par défaut
const OUT = join(process.cwd(), 'public', 'audio')
mkdirSync(OUT, { recursive: true })

// bruitages : prompts du brief (one-shot courts, boucles marquées loop)
const SFX: [string, string, number, boolean?][] = [
  ['sfx_door_open', 'sci-fi sliding blast door opening, pneumatic hiss, heavy metal servo, clunk at the end, one-shot', 1.5],
  ['sfx_door_locked', 'access denied buzzer on a spaceship keypad, two low synthetic beeps, one-shot', 0.8],
  ['sfx_pickup_o2', 'small pressurized oxygen canister picked up, short air hiss then soft rising chime, one-shot', 1.2],
  ['sfx_pickup_battery', 'batteries clicking into a flashlight, electric zap, rising power-up tone, one-shot', 1],
  ['sfx_pickup_water', 'plastic water pouch squeezed, liquid slosh, one-shot', 0.8],
  ['sfx_drink', 'person drinking water from a pouch, three gulps, satisfied exhale, close mic, one-shot', 2],
  ['sfx_breathe_o2', 'astronaut connecting oxygen tank to helmet, valve hiss, deep relieved breath inside helmet, one-shot', 2.5],
  ['sfx_pickup_key', 'magical sci-fi item acquired, bright glassy arpeggio, soft shimmer, one-shot', 1.5],
  ['sfx_pickup_bonus', 'small collectible sparkle, light metallic ting, one-shot', 0.7],
  ['sfx_lamp_on', 'tactile flashlight switch click, small electric hum, one-shot', 0.5],
  ['sfx_lamp_off', 'tactile flashlight switch click off, one-shot', 0.5],
  ['sfx_keypad', 'soft UI keypad beep, futuristic, short, one-shot', 0.5],
  ['sfx_success', 'positive confirmation chime spaceship computer, one-shot', 1.2],
  ['sfx_error', 'error buzz spaceship computer, one-shot', 0.7],
  ['sfx_valve', 'heavy metal valve wheel turning, pressure release, one-shot', 1.5],
  ['sfx_steam_loop', 'pressurized steam leaking from a broken pipe, constant hiss, loop', 4, true],
  ['sfx_power_up', 'spaceship power coming back online, deep electrical hum rising, lights buzzing on, relay clicks', 3],
  ['sfx_alarm_o2', 'low oxygen warning alarm inside space helmet, two-tone beep, one-shot', 0.8],
  ['sfx_heartbeat_loop', 'slow anxious heartbeat, muffled, loop', 3, true],
  ['amb_station_loop', 'space station interior ambience, air recyclers, distant hum, faint creaks, loop', 10, true],
  ['amb_wind_birds_loop', 'gentle wind in a valley with distant birds and a small river, loop', 10, true],
  ['sfx_launch', 'rocket engine ignition and liftoff from inside the cockpit, massive rumble, rattling', 6],
  ['sfx_radio_tune', 'radio static while tuning a dial, one-shot', 1],
  ['sfx_helicopter', 'helicopter approaching overhead, rotor thump growing louder', 5],
  ...[1, 2, 3, 4].map((i) => [`sfx_steps_metal_${i}`, `single footstep on metal grating, magnetic boots, variation ${i}, one-shot`, 0.5] as [string, string, number]),
  ...[1, 2, 3, 4].map((i) => [`sfx_steps_grass_${i}`, `single footstep on soft grass, variation ${i}, one-shot`, 0.5] as [string, string, number]),
]

// voix : toutes les répliques du jeu
const VOICES: [string, string][] = [
  ...fr.story.prologue.map((t, i) => [`voice_prologue_${i}`, t] as [string, string]),
  ...fr.briefing.map((t, i) => [`voice_briefing_${i}`, t] as [string, string]),
  ...Object.entries(fr.story.tours).flatMap(([z, lines]) => lines.map((t, i) => [`voice_tour_${z}_${i}`, t] as [string, string])),
  ['voice_radio', 'Signal reçu sur 121,5. Hélicoptère en route.'],
]

async function save(name: string, res: Response) {
  if (!res.ok) throw new Error(`${name} : ${res.status} ${await res.text()}`)
  writeFileSync(join(OUT, `${name}.mp3`), Buffer.from(await res.arrayBuffer()))
  console.log('✓', name)
}

for (const [name, text, duration, loop] of SFX) {
  if (!force && existsSync(join(OUT, `${name}.mp3`))) continue
  await save(
    name,
    await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text + (loop ? ', seamless loop' : ''), duration_seconds: duration, prompt_influence: 0.6 }),
    }),
  )
}
for (const [name, text] of VOICES) {
  if (!force && existsSync(join(OUT, `${name}.mp3`))) continue
  await save(
    name,
    await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8 } }),
    }),
  )
}

// manifeste : tous les fichiers audio présents
const { readdirSync } = await import('node:fs')
const files = readdirSync(OUT).filter((f) => /\.(mp3|ogg|m4a)$/.test(f)).map((f) => (f.endsWith('.mp3') ? f : f.replace(/\.(ogg|m4a)$/, '')))
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ files: [...new Set(files)] }, null, 2))
console.log(`Manifeste mis à jour : ${files.length} fichiers.`)
void readFileSync
