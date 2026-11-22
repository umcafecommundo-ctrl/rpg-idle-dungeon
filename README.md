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
