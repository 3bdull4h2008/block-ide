export let actx: AudioContext | null = null

export function blip(freq: number, dur = 0.06, type: OscillatorType = 'sine', gain = 0.07): void {
  try {
    actx ??= new AudioContext()
    if (actx.state === 'suspended') void actx.resume()
    const o = actx.createOscillator()
    const g = actx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(gain, actx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur)
    o.connect(g)
    g.connect(actx.destination)
    o.start()
    o.stop(actx.currentTime + dur)
  } catch {
    /* audio is best-effort */
  }
}

export const blipError = (): void => blip(200, 0.08, 'square', 0.04)
export const blipSuccess = (): void => blip(740, 0.07, 'sine', 0.08)
export const blipDrop = (): void => { blip(740, 0.07, 'sine', 0.08); setTimeout(() => blip(980, 0.05, 'sine', 0.05), 60) }
export const blipSlot = (): void => blip(660, 0.05, 'sine', 0.06)
