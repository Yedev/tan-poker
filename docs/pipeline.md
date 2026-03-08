# 游戏管线文档 (Game Pipeline)

## 整体架构分层

```
┌─────────────────────────────────────────────────────────────────┐
│                        BattleScene (UI层)                        │
│  动画 · 输入处理 · Phaser 场景切换 · 事件发射 · syncRegistry     │
├─────────────────────────────────────────────────────────────────┤
│                     LevelRuntime (游戏引擎层)                    │
│  棋盘状态 · 牌堆管理 · 弃牌验证 · 计分结算 · 关卡结算           │
├──────────────────┬──────────────────┬───────────────────────────┤
│  ScoreEngine     │  GameEventSystem  │  PhaseManager             │
│  计分计算        │  事件路由         │  阶段状态机               │
├──────────────────┴──────────────────┴───────────────────────────┤
│              PlayerProfile (跨关卡持久状态)                      │
│  level · score · gold · foundation · playerBuild                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关卡完整生命周期

```
TitleScene ──► BattleScene.create()
                    │
                    ├─ LevelRuntime.create(cfg, challengeCards, profile)
                    ├─ GameEventSystem.unregisterAll()
                    ├─ 注册增强卡 handlers: card.getHandlers(layerIndex, rt)
                    ├─ 注册挑战卡 handlers: challenge.getHandlers(rt)
                    ├─ initBoard() · initDeck()
                    └─ PhaseManager → LEVEL_START
```

---

## 阶段状态机

```
         ┌──────────────────────────────────────────┐
         │                                          │
         ▼                                          │ scoreChances > 0
    LEVEL_START                                     │ && score < target
         │                                          │ && !forceFailed
    emit level:start                                │
    flushSideEffects                                │
    fillHand()                                      │
         │                                          │
         ▼                                          │
   PLAYER_PLACING ◄──────────────────── SCORING ───┘
         │                                 ▲
    enableDrag                             │
    petrifiedSlots.clear()                 │ ui:score-requested
         │                                 │
    ┌────┴────────────────────────────────┐│
    │    玩家操作 (可循环)                 ││
    │                                     ││
    │  放牌 (placeCard)                   ││
    │    ├─ rt.placeCard()                ││
    │    │    └─ checkAndPerformCollapse()││
    │    │         └─ emit collapse:triggered
    │    ├─ emit card:placed              ││
    │    └─ flushSideEffects             ││
    │                                     ││
    │  弃牌 (ui:discard-requested)       ││
    │    ├─ rt.tryDiscard(cards)         ││
    │    ├─ emit card:discarded (×n)     ││
    │    └─ fillHand(discardCount)       ││
    └────────────────────────────────────┘│
                                          │
    ─────────────────────────────────────►┘
         点击 "计分"
```

---

## 计分阶段详细流程 (SCORING)

```
onScoring()
│
├─ emit score:start { scoreChancesRemaining }
├─ flushSideEffects
│
├─ 读取并清零 nextScoreFlatBonus (plunderBonus)
│
├─ rt.scoreAllLayers(baseCtx)
│    └─ ScoreEngine.scoreAllLayers()
│         对每个非空层：
│         ├─ detectHandType(cards)          → DetectedHand[]
│         ├─ calculateBaseScore(hands)      → baseScore
│         ├─ emit score:layer { layerIndex, cards, baseScore,
│         │                    scoreMultiplier=1.0, scoreBonusFlat=0 }
│         │    └─ [卡牌handlers可修改 scoreMultiplier / scoreBonusFlat]
│         │       示例: HollowBrick ×2.0, StraightFever +2.0, RoyalExclusive +50/皇室牌
│         │             共鸣破坏 ×0.5, 镜像世界翻转, 增强衰减系数
│         └─ layerScore = floor(baseScore × cappedMultiplier) + decayedFlat
│
├─ computeRoundScore(results, plunderBonus)
│    ├─ totalGained = Σ layerScore + plunderBonus
│    └─ goldEarned  = floor(totalGained / 10)
│
├─ 构建 ScoreEndContext { totalScoreGained, levelScoreBefore, layerResults,
│                         postLayerBonus=0, goldEarned }
├─ emit score:end
│    └─ [卡牌handlers可修改 postLayerBonus / goldEarned]
│       示例: Symbiosis 追加奖励分, GreedCurse 修改金币
├─ flushSideEffects
│
├─ 播放动画 (postLayerBonus浮字, goldEarned动画)
│
├─ rt.applyRoundScore(totalGained, postLayerBonus, goldEarned)
│    ├─ addScore(totalGained)
│    ├─ addScore(postBonus)      [若 > 0]
│    ├─ profile.gold += goldEarned [若 > 0]
│    ├─ scoringRoundsElapsed++
│    ├─ consumeScoreChance()     [scoreChances--]
│    └─ clearLayerOverrides()
│
└─ rt.shouldEndLevel(targetScore)?
      ├─ true (levelForceFailed || score≥target || scoreChances≤0)
      │    └─ PhaseManager → LEVEL_END
      └─ false
           ├─ rt.resetRound()    [恢复弃牌次数, cardsPlayedThisRound=0]
           ├─ fillHand()
           └─ PhaseManager → PLAYER_PLACING
```

---

## 关卡结算 (LEVEL_END)

```
onLevelEnd()
│
├─ rt.concludeLevel(targetScore)
│    ├─ foundationValue = Σ board[*].pokerSlots[*].rank
│    ├─ survived = !levelForceFailed && levelScore ≥ targetScore
│    ├─ bonusGold  = survived ? 5 + level×2 : 0
│    ├─ 更新 profile:
│    │    ├─ prevLevelScore / prevLevelTarget
│    │    ├─ score += levelScore
│    │    ├─ foundation = foundationValue (min 1)
│    │    └─ survived: gold += bonusGold, currentLevel++
│    └─ return { survived, bonusGold, isVictory, foundationValue }
│
├─ emit level:end { finalScore, targetScore, survived, foundationValue }
│    └─ [DebtCollect等挑战卡在此处理跨关逻辑]
│
├─ cleanupScene()
│    ├─ GameEventSystem.unregisterAll()
│    └─ scene.stop('UIScene')
│
└─ 场景切换:
     survived && isVictory → VictoryScene
     survived             → ShopScene { level: currentLevel }
     !survived            → GameOverScene
```

---

## 坍塌子流程 (Collapse)

```
placeCard()
    └─ checkAndPerformCollapse()
         ├─ checkCollapse(board, profile.foundation + tempFoundationBonus)
         │    └─ 检查任意层 weight > foundation → 触发坍塌
         └─ collapsed?
              ├─ 清空被摧毁层的所有格子
              ├─ emit collapse:triggered { triggerLayerIndex, destroyedCards }
              │    └─ [CollapsePlunder: nextScoreFlatBonus += top3.rank之和]
              └─ flushSideEffects
```

---

## 事件系统

```
发射方 (BattleScene)          事件名              监听方 (卡牌 handler)
─────────────────────────────────────────────────────────────────
onLevelStart          →  level:start      →  BlackMarket (设discardChances)
onLevelEnd            →  level:end        →  DebtCollect (读上关分差惩罚)
placeCard             →  card:placed      →  各种卡牌
discardCard           →  card:discarded   →  (预留)
fillHand              →  card:drawn       →  BlackHole(吞第5张), LuckyDraw(A→手牌+1)
scoreAllLayers(内部)  →  score:layer      →  增强卡(改乘数/加成), 共鸣破坏(降乘数)
onScoring             →  score:start      →  TimePressure等
onScoring             →  score:end        →  Symbiosis(postBonus), GreedCurse(gold), Petrify(石化)
executeCollapse       →  collapse:triggered → CollapsePlunder(掠夺加值)
```

---

## 数据流向

```
PlayerProfile (持久)
  └── playerBuild.deck ──────────────────► LevelRuntime.initDeck()
  └── playerBuild.activeEnhanceCards ────► BattleScene 注册 handler
  └── foundation ────────────────────────► checkCollapse() 阈值

LevelRuntime (关卡内)
  ├── board ─────────────────────────────► ScoreEngine 计分输入
  ├── hand ──────────────────────────────► HandAnimator 渲染
  ├── scoreChances ──────────────────────► UI 显示 / shouldEndLevel()
  ├── enhanceDecayMultiplier ────────────► scoreAllLayers() 衰减系数
  ├── nextScoreFlatBonus ────────────────► computeRoundScore() plunderBonus
  ├── petrifiedSlots ────────────────────► BattleScene 阻止出牌
  └── disabledSlots ─────────────────────► BattleScene 阻止放置

BaseEventContext (快照, 每次事件构建)
  ├── board: LayerSnapshot[]
  └── gameState: { level, score, gold, foundation, handSize,
                   scoreChances, discardChances, enhanceDecayMultiplier,
                   scoringRoundsElapsed, prevLevelScore, prevLevelTarget }
```

---

## 卡牌副作用 (SideEffect → EffectDelta)

| SideEffect 类型 | 作用 | EffectDelta |
|---|---|---|
| MODIFY_RANDOM_CARDS | 随机改变棋盘牌面值 | CARD_RANK_CHANGED |
| MODIFY_TOTAL_SCORE | 乘以系数修改总分 | SCORE_CHANGED |
| MODIFY_HAND_SIZE | 增减手牌上限 | HAND_TRIMMED |
| DESTROY_RANDOM_SLOT | 摧毁指定层随机格 | SLOT_CLEARED |
| DESTROY_RANDOM_BOARD_CARD | 摧毁随机棋盘牌 | SLOT_CLEARED |
| DESTROY_SPECIFIC_CARD | 精准摧毁指定格 | SLOT_CLEARED |
| MODIFY_GOLD | 修改金币 | GOLD_CHANGED |
| MODIFY_SCORE_CHANCE | 增减计分机会数 | SCORE_CHANCE_CHANGED |
| DISCARD_RANDOM_HAND | 随机弃手牌 | HAND_CARD_DISCARDED |
| APPLY_ENHANCE_DECAY | 增强衰减系数×factor | ENHANCE_DECAYED |
| FORCE_FAIL_LEVEL | 强制本关失败 | FORCE_FAIL |
| ADD_NEXT_SCORE_BONUS | 下次计分加值 | (直接修改 rt.nextScoreFlatBonus) |
| VOID_DRAWN_CARD | 摸到的牌直接弃掉 | (直接修改 rt.hand) |
| DISABLE_LAYER_SLOT | 永久禁用格子 | SLOT_CLEARED |
| TEMP_FOUNDATION_BONUS | 临时提升承重阈值 | (直接修改 rt.tempFoundationBonus) |
