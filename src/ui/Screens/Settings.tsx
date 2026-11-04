import { audio } from '../../game/audio/audio'
import { saveSettings, useGame, type Settings as S } from '../../game/state'

/** applique et sauvegarde une modification de réglages */
export function update(p: Partial<S>) {
  const s = { ...useGame.getState().settings, ...p }
  useGame.setState({ settings: s })
  saveSettings(s)
  audio.setVolumes({ music: s.music * s.master, sfx: s.sfx * s.master, voice: s.voice * s.master, ambience: s.ambience })
}
