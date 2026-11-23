# Masmorra Idle

RPG idle 2D, vista de cima, em pixel art (sprites 100% originais, gerados por código), pensado para celular em modo retrato.
React + TypeScript + Vite; o combate é desenhado em `<canvas>` com tick fixo de 20 Hz.

```bash
npm install
npm run dev        # http://localhost:5173 (use o modo celular do navegador)
npm run build      # checagem de tipos + build de produção em dist/
npm run sim -- 40 45   # tabela de balanceamento no terminal: nível 40, 45 s por cenário
```

## O que tem
- **6 classes** (Cavaleiro, Bárbaro, Arqueiro, Mago, Clérigo, Necromante): atributos FOR/AGI/INT/VIT/SAB, crescimento por nível, 8 skills ativas (níveis 1/5/10/20/35/50/75/100), 4 passivas e árvore de talentos com 3 ramos. Cada classe guarda o próprio progresso e dá para trocar a qualquer momento.
- **10 tipos de mob** + 6 chefes com mecânicas (reforços, enfurecer abaixo de 30% de HP, pisão em área). Variantes **elite** (2x HP + modificador: regenera, reflete, veloz, blindado) e **chefe**.
- **7 tipos de dano** × **7 categorias de mob** com tabela de fraquezas/resistências (`src/data/mobs.ts`), visível em *Mapas → tabela de vantagens*.
- **Atividades**: Caçada solo, Hordas, Chefes, Dungeon (andares, chefe a cada 5) e Party (você + 3 mercenários).
- **7 mapas** desbloqueados por nível. Cada mapa mostra o **medidor de eficiência** (XP/h e risco) das 6 classes naquela atividade.
- **Barra de skills** 1–0 (8 skills + poções de HP/MP) com sombra radial de recarga e *auto-cast* por slot (botão “A”). Toque num inimigo para focar o alvo.
- **Equipamentos** (comum/raro/épico/lendário, 7 slots, afixos aleatórios incluindo dano contra tipos de mob), poções automáticas configuráveis, loja, renascimento (Nv 100+) e talentos.
- **Save** automático em `localStorage`, exportar/importar como texto, e **ganhos offline** (limite 8 h, 85% de eficiência) com tela de resumo.
- **Tela de debug/balanceamento** (⚙ → debug): roda a simulação das 6 classes em todos os cenários e verifica a regra de design.

## Cidade e ambientação (v2)
- **Vila Pedrafria**: cidade segura (toque para andar, BFS), praça com fonte, ruas de pedra, casas, árvores, postes, bancos, aldeões, gatos, pássaros e ciclo dia/noite (luzes acendem à noite). Sem combate e sem ganho de XP/offline enquanto você estiver nela.
- **Funcionando**: Ferreiro (comprar com estoque rotativo de 3h, melhorar +1 a +10 com falha a partir do +6, reparar durabilidade, baú), Loja de Itens (poções, elixires de buff, Pergaminho de Teleporte e de XP), Mercado (vender/venda rápida por raridade), Portal (mapas), Taverna (mercenários), Guilda (trocar de classe com custo, resetar talentos) e Templo (renascimento). Loja de Magia, Banco e Joalheiro têm NPC e placa, mas a tela é “em breve”.
- **Mapas com arte própria**: Floresta e Cripta (chão em manchas com 4–5 variações, decalques, objetos com colisão, copas acima do personagem, luz/escuridão, partículas, água/chama animadas, música e sons procedurais). Os demais mapas ainda usam o fundo genérico.
- Dados: `src/data/mapart.ts` (arte dos mapas), `src/data/town.ts` (layout da cidade), `src/data/shops.ts` (consumíveis, melhorias, serviços).

## IA de combate e início de jogo (v3)
- **IA de posicionamento** (`src/engine/ai.ts`, parâmetros por classe em `src/data/ai.ts`): a cada 0,15 s avalia tiles candidatos (distância ideal, espaço livre, linha de visão, medo de mobs corpo a corpo com posição prevista, cantos/becos, AoE de chefe, centro da caçada) e anda até o melhor por A*. Mapa de abertura pré-calculado, recuo em arco, desiste de recuar se os mobs colam, e usa Salto/Teleporte/Empurrão/Investida como último recurso. Skills de controle são usadas em mobs que se aproximam; skills de emergência ficam guardadas.
- **Debug da IA**: botão “IA” no campo (ou ⚙ → Debug da IA) mostra heatmap das notas, mapa de abertura, caminho, alcance/ideal/segurança, e sliders para ajustar os pesos ao vivo.
- **Início**: abertura pulável (~40 s) → escolha de classe com prévia animada → visão do poder final → caçada com dicas contextuais, 7 missões encadeadas (Espada do Iniciante, mini-chefe Rato Albino com armadura rara garantida, volta à cidade com surpresa, baú trancado do nível 10), recompensa a cada nível 2–10, atividades liberadas por nível, área trancada com silhuetas “???” e teaser de recompensa offline de 1 h. Tudo em `src/data/onboarding.ts`.
- XP dos níveis iniciais foi reduzido para o nível 10 sair em ~5–9 min (meça com a classe: ver `EARLY_FACTOR` em `formulas.ts`).

## Rodada 4: IA sem teleporte, UX, eventos e retenção
- **IA**: removido todo teleporte. As classes têm uma **Manobra** real (Salto, Investida, Impulso Arcano, Passo Sombrio, Empurrão Sagrado; nível 12) — o personagem anda em alta velocidade até 2,6 tiles e para ao bater em parede ou mob. Reação antecipada (tempo até o contato), corredor livre e área alcançável na nota de posição, **modo cercado** (luta para abrir caminho) e log dos motivos no debug. Teste: `npm run test:ai` (100 combates, falha se a posição saltar mais que a velocidade permitida).
- **UX**: barra fixa “Próximo objetivo”, bolinhas vermelhas nas abas, 1 ação recomendada com seta/brilho, tooltips por toque (números, tipos fortes/fracos, status), comparação com setas verde/vermelha, botão “Equipar melhores itens”, botões de 44 px, sons de clique.
- **Eventos** (`src/data/events.json`): mob dourado, invasão com barra de progresso, chefe errante com aviso, missões diárias + login de 7 dias, baú do cristal com timer, bônus de fim de semana, conquistas com títulos e bônus, bestiário com bônus por tipo, central de avisos e “dobrar ganhos offline” (ponto de integração em `src/engine/ads.ts`, sem anúncio real).
- **Progressão**: `docs/progressao.md` (gerado por `npm run prog`) traz os desbloqueios e o tempo estimado do nível 1 ao 50.
- Fase 2 (não feito): chuva de tesouro, fenda dimensional, chefe mundial com ranking, eventos sazonais e passe de temporada.

## Estrutura
```
src/data/      classes.ts  mobs.ts  maps.ts  items.ts  types.ts   ← tudo que se balanceia
src/engine/    formulas.ts (curvas de nível/mob e atributos) battle.ts (combate) sim.ts (simulação)
               game.ts (estado, loop, offline) loot.ts save.ts efficiency.ts
src/render/    renderer.ts (canvas + HUD) sprites.ts icons.ts (pixel art procedural)
src/ui/        App.tsx panels.tsx settings.tsx
```
Para balancear: edite `refHp/refAtk/refDef` em `formulas.ts` (dificuldade dos mobs), `dmgMult/hpMult/defMult` e skills em `classes.ts`, e confira com `npm run sim`.

## Nota sobre a regra de balanceamento
“Cada classe no top 2 de ≥ 2 atividades e última em ≥ 1” é matematicamente impossível com 6 classes e 5 atividades (só há 10 vagas de top 2 para 12 exigidas). A verificação é feita por **cenário = atividade × espécie de mob** (50 cenários), ranqueando por XP/min já descontando mortes. Ela passa na maioria dos níveis testados (10–140, 200), mas falha por margem pequena em alguns (ex.: 5, 55, 160, 180: uma classe nunca fica em último). Veja o resultado exato para qualquer nível na tela de debug e ajuste `dmgMult` em `classes.ts`.
