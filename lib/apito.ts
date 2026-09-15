/**
 * O aviso do fim do descanso (SPEC §3.2 e §7): vibração e um bipe curto.
 * Nada de arquivo de áudio — o som é gerado na hora com a WebAudio API, então
 * funciona offline e não pesa no precache do service worker.
 */
"use client";

let contexto: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Classe =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Classe) return null;
  contexto ??= new Classe();
  return contexto;
}

/** Dois bipes curtos. Silencioso quando o aparelho não deixa tocar. */
export function apitar(): void {
  try {
    const ctx = audio();
    if (!ctx) return;
    void ctx.resume?.();
    const agora = ctx.currentTime;
    for (const atraso of [0, 0.22]) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      ganho.gain.setValueAtTime(0.0001, agora + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.25, agora + atraso + 0.01);
      ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.16);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(agora + atraso);
      osc.stop(agora + atraso + 0.18);
    }
  } catch {
    // sem áudio: o timer continua valendo
  }
}

export function vibrar(padrao: number | number[] = [180, 90, 180]): void {
  try {
    navigator.vibrate?.(padrao);
  } catch {
    // sem vibração: segue o jogo
  }
}

/**
 * A voz do timer de intervalos (SPEC §3.3): fala "corrida" / "caminhada" na
 * troca de bloco, em pt-BR e sem baixar nada. Opcional por preferência; se o
 * aparelho não tiver `speechSynthesis`, a vibração continua avisando.
 */
export function falar(texto: string): void {
  try {
    const sintese = window.speechSynthesis;
    if (!sintese || texto.trim() === "") return;
    sintese.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    fala.rate = 1;
    sintese.speak(fala);
  } catch {
    // sem voz: a vibração e a tela já avisam
  }
}

/** Cala a voz (sair da tela, encerrar a sessão). */
export function calar(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // nada a fazer
  }
}
