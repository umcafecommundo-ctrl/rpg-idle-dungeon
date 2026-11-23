/** Ponto de integração de anúncios recompensados. Substitua pela SDK real (AdMob, Unity Ads etc.). Nenhum anúncio real é exibido. */
export async function showRewardedAd(_placement: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 900)); // simula a duração do vídeo
  return true; // true = o jogador assistiu até o fim
}
