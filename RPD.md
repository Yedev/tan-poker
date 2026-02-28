# 游戏设计说明书：叠牌 (Stacking Cards)
**版本**：v3.0 | **引擎**：Phaser 3 + TypeScript + Vite

---

## 1. 游戏概述

| 字段 | 内容 |
|------|------|
| 游戏名称 | 叠牌 (Stacking Cards) |
| 核心标签 | 卡牌构筑 · Roguelike · 类小丑牌 · 数值策略 · 物理叠塔 |
| 一句话介绍 | 结合扑克牌型与物理承重逻辑的肉鸽卡牌游戏——凑出高分牌型的同时，必须保证底层"地基"足够稳固，否则触发**坍塌**、全盘皆输。 |
| 分辨率 | 1280 × 720（16:9），`Phaser.Scale.FIT` 自适应 |
| 渲染器 | `Phaser.AUTO`（优先 WebGL，降级 Canvas）|

---

## 2. 核心术语

| 术语 | 定义 |
|------|------|
| **扑克牌** | 基础卡牌，共 52 张（无大小王），含黑桃♠ 红桃♥ 梅花♣ 方块♦ 四种花色 |
| **消耗牌** | 一次性战术卡牌，打出后产生即时效果，进入弃牌堆 |
| **增强牌** | 安装于每层专属槽位的被动卡牌，**通过订阅游戏事件**产生增益效果，关卡间保留继承 |
| **挑战牌** | 系统"诅咒"卡，**通过订阅游戏事件**产生负面效果，随关卡难度递增数量 |
| **牌组** | 玩家卡组库，由【扑克牌】+【消耗牌】构成 |
| **牌面值** | 卡牌数字大小（2～10，J=11，Q=12，K=13，A=14 或 1），同时决定计分与坍塌承重 |
| **牌型** | 降低成型门槛至 **3 张**，支持：单张、对子、顺子（3张+）、同花（3张+）、同花顺、三条 |
| **游戏阶段** | 战斗关卡内的状态机节点，控制当前允许的操作与 UI 状态 |
| **游戏事件** | 阶段内发生的具名动作，增强牌与挑战牌的所有效果均通过订阅事件触发 |

---

## 3. 核心机制

### 3.1 计分机制

游戏按**层**单独计算，最终分数为各层叠加。

```
单层得分 = [∑ (组合内牌面值之和 × 该牌型倍率)] × 本层增强牌乘区
```

**牌型倍率参考（待平衡）：**

| 牌型 | 最低张数 | 倍率（初始参考） |
|------|----------|-----------------|
| 单张 | 1 | 1.0× |
| 对子 | 2 | 2.0× |
| 三条 | 3 | 3.0× |
| 顺子 | 3 | 3.5× |
| 同花 | 3 | 4.0× |
| 同花顺 | 3 | 6.0× |

**计分示例**：第 3 层放置【2♠, 2♥, 4♣】

- 【2, 2】→ 对子：`(2+2) × 2.0 = 8`
- 【4】→ 单张：`4 × 1.0 = 4`
- 第 3 层总分（无增强牌）= `(8 + 4) × 1.0 = 12`

---

### 3.2 坍塌机制 ⚡ 核心特色

扑克牌放置遵循**上轻下重**的物理承重逻辑。

**触发条件**：任意槽位发生变化后，若某层的牌面值总和 **< 其上方所有层的牌面值总和之和**，触发**坍塌**。

**坍塌惩罚**：该层上方的**所有层**扑克牌被直接摧毁（不进入弃牌堆，永久消失）。

**机制示例：**

```
第1层（顶）：8♠              总重：8
第2层（中）：10♥ + J♠(11)   总重：21   → 1+2层累计：29
第3层（底）：9♣ + 8♦ + 9♠   总重：26

上方累计重量 29 > 底层承重 26 ➜ 触发坍塌！第1、2层所有牌被摧毁。
```

---

### 3.3 基层继承机制

- **关卡结束时**：桌面存活扑克牌的牌面值之和 → 成为下一关的**基层承重值**，存入 `GameState`。
- **第一关**：基层承重视为 `Infinity`，不从底部坍塌。
- **后续关卡**：1、2、3 层建立在上一关基层之上，通关前须尽可能在底层留高数值牌。

---

## 4. 游戏阶段系统（Phase System）

### 4.1 阶段定义

战斗关卡内部运行一个有限状态机，共四个阶段，由 `PhaseManager` 统一管理。

```typescript
// types/game.ts
export type GamePhase =
  | 'LEVEL_START'    // 关卡开始：初始化桌面、发初始手牌、触发关卡开始事件
  | 'PLAYER_PLACING' // 玩家放置：允许拖牌、使用消耗牌、移动增强牌、弃牌
  | 'SCORING'        // 计分：锁定交互，执行逐层计分动画与结算
  | 'LEVEL_END'      // 关卡结束：记录基层、结算金币、跳转商店或结算
```

### 4.2 阶段转移规则

```
          初始化完毕
              ↓
        LEVEL_START
              ↓ 发牌动画结束，自动进入
        PLAYER_PLACING ◄─────────────────────┐
              ↓ 玩家点击【计分】按钮           │
           SCORING                            │
              ↓ 结算完毕                      │
     ┌────────┴─────────┐                    │
 还有计分次数？        全部耗尽？              │
     │ YES              │ NO                  │
     │                  ↓                    │
     │            LEVEL_END                  │
     │                  ↓                    │
     │         达到目标分？                   │
     │        ┌─────┴──────┐                 │
     │      YES            NO                │
     │        ↓             ↓                │
     │   VictoryScene  GameOverScene          │
     │                                       │
     └───────────────────────────────────────┘
       （重置弃牌次数，重新进入 PLAYER_PLACING）
```

### 4.3 PhaseManager 职责

```typescript
// logic/PhaseManager.ts
class PhaseManager {
  private phase: GamePhase = 'LEVEL_START';

  getPhase(): GamePhase;

  // 转移到指定阶段，自动触发对应的进入事件
  transitionTo(next: GamePhase): void;

  // 各阶段入口处理
  private onEnterLevelStart(): void;   // emit GAME_EVENTS.LEVEL_START
  private onEnterPlayerPlacing(): void;// emit GAME_EVENTS.PLAYER_PLACING_START（解锁交互）
  private onEnterScoring(): void;      // emit GAME_EVENTS.SCORE_START
  private onEnterLevelEnd(): void;     // emit GAME_EVENTS.LEVEL_END
}
```

**阶段与 UI 交互锁定：**

| 阶段 | 拖拽放牌 | 弃牌 | 使用消耗牌 | 移动增强牌 | 计分按钮 |
|------|----------|------|-----------|-----------|---------|
| LEVEL_START | ✗ | ✗ | ✗ | ✗ | ✗ |
| PLAYER_PLACING | ✓ | ✓ | ✓ | ✓ | ✓ |
| SCORING | ✗ | ✗ | ✗ | ✗ | ✗ |
| LEVEL_END | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 5. 游戏事件系统（Game Event System）

### 5.1 设计原则

增强牌与挑战牌的所有效果**不在计分函数或 BattleScene 中硬编码**，而是通过订阅具名游戏事件来驱动。`GameEventSystem` 充当事件总线，卡牌效果作为处理器注册其上。每次玩家动作或阶段转移都会向系统派发事件，已注册的卡牌处理器按顺序响应。

```
玩家操作 / 阶段转移
       ↓
  GameEventSystem.emit(eventName, context)
       ↓
  遍历已注册的 handlers（增强牌 + 挑战牌）
       ↓
  每个 handler 读取 context，修改 context.scoreModifier / context.board 等
       ↓
  BattleScene 读取最终 context 应用结果
```

### 5.2 游戏事件枚举

```typescript
// events/GameEvents.ts
export const GAME_EVENTS = {

  // ── 阶段事件 ──────────────────────────────────────
  LEVEL_START:          'level:start',         // 关卡开始，发牌前
  LEVEL_END:            'level:end',           // 关卡结束，跳转前

  // ── 玩家操作事件 ──────────────────────────────────
  CARD_PLACED:          'card:placed',         // 玩家将一张扑克牌拖入槽位
  CARD_DISCARDED:       'card:discarded',      // 玩家弃牌（可一次弃多张，每张单独触发）
  CARD_DRAWN:           'card:drawn',          // 从牌库摸一张牌到手牌
  CONSUME_CARD_USED:    'consume:used',        // 玩家打出消耗牌
  ENHANCE_CARD_MOVED:   'enhance:moved',       // 玩家在槽位间移动增强牌

  // ── 计分事件 ──────────────────────────────────────
  SCORE_START:          'score:start',         // 玩家点击计分，动画开始前
  SCORE_LAYER:          'score:layer',         // 单层计分结算时（每层一次）
  SCORE_END:            'score:end',           // 本次计分全部层结算完毕

  // ── 系统事件 ──────────────────────────────────────
  COLLAPSE_TRIGGERED:   'collapse:triggered',  // 坍塌发生（仅通知，不可在此修改阻止坍塌）

} as const;

export type GameEventName = typeof GAME_EVENTS[keyof typeof GAME_EVENTS];
```

### 5.3 事件上下文（Event Context）

每个事件携带一个**可变的上下文对象**，处理器可以读取和修改它，修改结果在所有处理器执行完毕后由调用方统一应用。

```typescript
// types/events.ts

// 所有事件共享的基础字段
export interface BaseEventContext {
  phase: GamePhase;
  level: number;
  board: LayerSnapshot[];    // 当前桌面各层只读快照（深拷贝，防止处理器污染状态）
  gameState: GameStateSnapshot;
}

// LEVEL_START
export interface LevelStartContext extends BaseEventContext {
  targetScore: number;
}

// CARD_PLACED
export interface CardPlacedContext extends BaseEventContext {
  card: CardData;            // 被放置的牌
  layerIndex: number;        // 放置到第几层（0=顶层）
  slotIndex: number;         // 该层第几个槽位
}

// CARD_DISCARDED
export interface CardDiscardedContext extends BaseEventContext {
  card: CardData;            // 被弃掉的牌
}

// CARD_DRAWN
export interface CardDrawnContext extends BaseEventContext {
  card: CardData;            // 摸到的牌
}

// CONSUME_CARD_USED
export interface ConsumeCardUsedContext extends BaseEventContext {
  consumeCardId: string;     // 消耗牌 id
  targetCard?: CardData;     // 目标扑克牌（若有）
  targetLayerIndex?: number;
}

// ENHANCE_CARD_MOVED
export interface EnhanceCardMovedContext extends BaseEventContext {
  enhanceCardId: string;
  fromLayerIndex: number;
  toLayerIndex: number;
}

// SCORE_START / SCORE_END
export interface ScoreStartContext extends BaseEventContext {
  scoreChancesRemaining: number;
}

// SCORE_LAYER —— 处理器通过修改此 context 改变最终计分
export interface ScoreLayerContext extends BaseEventContext {
  layerIndex: number;
  cards: CardData[];
  detectedHandTypes: DetectedHand[];   // scoring.ts 检测到的牌型列表
  baseScore: number;                   // 纯牌型计算出的基础分（只读参考）
  scoreMultiplier: number;             // 乘区，初始为 1.0，处理器可叠加
  scoreBonusFlat: number;              // 平加分，处理器可叠加
  overrideLayerWeight: number | null;  // 若非 null，覆盖本层的坍塌承重值
}

// SCORE_END
export interface ScoreEndContext extends BaseEventContext {
  totalScoreGained: number;    // 本次计分获得的总分（只读）
}

// LEVEL_END
export interface LevelEndContext extends BaseEventContext {
  finalScore: number;
  targetScore: number;
  survived: boolean;
  foundationValue: number;     // 本关存活牌总值，将成为下一关基层
}

// COLLAPSE_TRIGGERED
export interface CollapseTriggeredContext extends BaseEventContext {
  triggerLayerIndex: number;          // 哪一层承重不足
  destroyedLayerIndices: number[];    // 被摧毁的层
  destroyedCards: CardData[];
}
```

### 5.4 GameEventSystem 实现

```typescript
// events/GameEventSystem.ts

type EventHandler<T extends BaseEventContext = BaseEventContext> = (ctx: T) => void;

interface RegisteredHandler {
  sourceId: string;          // 卡牌 id，用于卸载时精确删除
  sourceType: 'enhance' | 'challenge';
  eventName: GameEventName;
  handler: EventHandler<any>;
  priority: number;          // 数值越小越先执行，默认 0；负值可插队（特殊牌专用）
}

class GameEventSystem {
  private static instance: GameEventSystem;
  private handlers: RegisteredHandler[] = [];

  static getInstance(): GameEventSystem;

  // 注册单张卡牌的所有事件处理器（关卡开始时由 BattleScene 批量调用）
  register(handler: RegisteredHandler): void;

  // 卸载指定来源的所有处理器（关卡结束、增强牌被移除时调用）
  unregister(sourceId: string): void;

  // 卸载所有处理器（关卡结束时全量清理）
  unregisterAll(): void;

  // 派发事件，按 priority 顺序执行所有匹配的处理器
  emit<T extends BaseEventContext>(eventName: GameEventName, context: T): T;
  // 注意：emit 返回处理器链修改后的 context，调用方负责应用最终结果
}
```

---

## 6. 场景设计（Phaser Scene 架构）

### 6.1 场景列表

```
BootScene → PreloadScene → TitleScene → ShopScene ⇄ BattleScene (+ UIScene 并行)
                                                  ↓           ↓
                                           GameOverScene  VictoryScene
```

Phaser 场景注册顺序（`main.ts`）：
```typescript
scene: [BootScene, PreloadScene, TitleScene, ShopScene, BattleScene, UIScene, GameOverScene, VictoryScene]
```

---

### 6.2 BootScene

**职责**：仅加载进度条所需极少量资源，跳转 PreloadScene。

```
加载内容：loading-bar.png, loading-bg.png
完成后：this.scene.start('PreloadScene')
```

---

### 6.3 PreloadScene

**职责**：统一预加载全部资源，展示带进度条的 Loading 界面。所有资源 key 统一在 `config.ts` 的 `ASSET_KEYS` 枚举中定义。

| 类型 | key 示例 | 文件路径 |
|------|----------|----------|
| spritesheet | `CARDS_SHEET` | `assets/images/cards/sheet.png` |
| image | `SLOT_BG` | `assets/images/ui/slot.png` |
| image | `SLOT_DANGER` | `assets/images/ui/slot-danger.png` |
| image | `ENHANCE_SLOT_BG` | `assets/images/ui/enhance-slot.png` |
| image | `PARTICLE_SPARK` | `assets/images/effects/spark.png` |
| audio | `BGM_BATTLE` | `assets/audio/bgm/battle.ogg` |
| audio | `SFX_CARD_PLACE` | `assets/audio/sfx/card-place.ogg` |
| audio | `SFX_COLLAPSE` | `assets/audio/sfx/collapse.ogg` |
| audio | `SFX_SCORE` | `assets/audio/sfx/score.ogg` |

---

### 6.4 ShopScene

**职责**：关卡间中转，购买/管理卡牌，安装增强牌。从 `GameState` 读取持久数据，不接触 `GameEventSystem`（事件系统仅在战斗内活跃）。

**功能模块（均为 `Container` 对象）：**
- 商品货架：随机生成 3～5 个可购买的消耗牌 / 增强牌 / 卡包
- 增强牌槽位面板：3 层各自的增强牌槽，支持拖拽替换
- 牌组查看器：展示当前完整牌组
- 离开按钮：→ `this.scene.start('BattleScene', { level: n })`

---

### 6.5 BattleScene（核心战斗场景）

**职责**：持有 `PhaseManager` 和 `GameEventSystem`，协调阶段转移、派发游戏事件、管理 `BoardSlot` 与 `Card` 对象，通过 `registry` 向并行 `UIScene` 推送显示数据。

**不负责**：分数显示文字（由 UIScene 负责）、卡牌效果逻辑（由各卡牌的 handler 负责）。

#### 初始化流程

```typescript
// BattleScene.create()
create() {
  // 1. 启动并行 HUD
  this.scene.launch('UIScene');

  // 2. 初始化事件系统，注册本关所有卡牌的 handlers
  const ges = GameEventSystem.getInstance();
  ges.unregisterAll();
  GameState.getInstance().enhanceSlots.forEach(card => {
    if (card) ges.register(...card.getHandlers());
  });
  GameState.getInstance().challengeCards.forEach(card => {
    ges.register(...card.getHandlers());
  });

  // 3. 创建桌面与手牌对象
  this.initBoard();
  this.initHand();

  // 4. 启动阶段状态机
  this.phaseManager = new PhaseManager();
  this.phaseManager.transitionTo('LEVEL_START');
}
```

#### 桌面布局

```
金字塔形插槽布局（1280×720 基准）：

层1（顶）：  [增强槽] [扑克槽]
层2（中）：  [增强槽] [扑克槽] [扑克槽]
层3（底）：  [增强槽] [扑克槽] [扑克槽] [扑克槽]
──────────────────────────────────────────────────
           基层承重显示：XXX（继承自上一关）
```

#### 关键操作与事件派发对照

| 操作 | 派发事件 | 额外逻辑 |
|------|----------|----------|
| 发牌完毕（LEVEL_START 结束） | `LEVEL_START` → 转 `PLAYER_PLACING` | — |
| 拖牌落入槽位 | `CARD_PLACED` | 触发坍塌检测 |
| 弃牌（每张） | `CARD_DISCARDED` | — |
| 补牌到手牌（每张） | `CARD_DRAWN` | — |
| 打出消耗牌 | `CONSUME_CARD_USED` | 执行消耗牌即时效果 |
| 移动增强牌 | `ENHANCE_CARD_MOVED` | 重新注册移动后的 handler |
| 点击计分 | `SCORE_START` → 逐层 `SCORE_LAYER` → `SCORE_END` | 见计分流程 |
| 关卡结束 | `LEVEL_END` | 记录基层，跳转场景 |
| 坍塌发生 | `COLLAPSE_TRIGGERED` | 动画 + 销毁 Card 对象 |

#### 计分流程（SCORING 阶段）

```
PhaseManager.transitionTo('SCORING')
  ↓
emit(SCORE_START, context)               ← 处理器可在此重置临时状态
  ↓
for each layer (top → bottom):
  构建 ScoreLayerContext（含 baseScore / scoreMultiplier=1.0 / scoreBonusFlat=0）
  ↓
  emit(SCORE_LAYER, layerContext)        ← 增强牌处理器在此修改 multiplier / bonus
  ↓
  finalLayerScore = (baseScore × layerContext.scoreMultiplier) + layerContext.scoreBonusFlat
  ↓
  播放该层计分动画（Tween Timeline）
  ↓
emit(SCORE_END, { totalScoreGained })    ← 挑战牌处理器在此扣分/制造破坏
  ↓
检查通关条件
  ├─ 达标 → PhaseManager.transitionTo('LEVEL_END')
  └─ 未达标且还有次数 → PhaseManager.transitionTo('PLAYER_PLACING')
```

#### 移动增强牌后的处理

```typescript
// BattleScene.ts — 增强牌从 layerA 移动到 layerB 后
onEnhanceMoved(card: EnhanceCardData, from: number, to: number) {
  const ctx = buildContext<EnhanceCardMovedContext>({ ... });
  GameEventSystem.getInstance().emit(GAME_EVENTS.ENHANCE_CARD_MOVED, ctx);

  // 重新注册该卡牌的 handlers（移动后所在层变化，context 中的 layerIndex 需更新）
  const ges = GameEventSystem.getInstance();
  ges.unregister(card.id);
  ges.register(...card.getHandlers(to)); // 传入新的 layerIndex
}
```

---

### 6.6 UIScene（并行 HUD 场景）

**职责**：纯显示层，监听 `registry` 数据变化与 `EventBus` 通知，不接触游戏逻辑。

**阶段感知**：监听 `registry` 中的 `phase` 字段，根据阶段切换按钮的启用/禁用状态与 UI 高亮。

```typescript
// UIScene.ts
create() {
  // 监听 registry 驱动文本更新
  this.registry.events.on('changedata-score',  (_, v) => this.scoreText.setText(`${v}`));
  this.registry.events.on('changedata-phase',  (_, v) => this.onPhaseChange(v));

  // 按钮通过 EventBus 向 BattleScene 传递意图
  this.scoreBtn.on('pointerup',   () => EventBus.emit(GAME_EVENTS.SCORE_START));
  this.discardBtn.on('pointerup', () => EventBus.emit('ui:discard-requested'));
}

private onPhaseChange(phase: GamePhase) {
  // 根据阶段锁定/解锁按钮
  const isPlacing = phase === 'PLAYER_PLACING';
  this.scoreBtn.setInteractive(isPlacing);
  this.discardBtn.setInteractive(isPlacing);
}
```

**显示内容：**
- 当前分数 / 目标分数
- 剩余计分次数（3次/关）
- 剩余弃牌次数（2次/次计分）
- 当前挑战牌列表（图标 + 名称 + 触发事件标注）
- 当前游戏阶段指示（调试用，发布时可隐藏）
- 【计分】【弃牌】操作按钮

---

### 6.7 GameOverScene / VictoryScene

**职责**：结算展示，读取 `GameState`，提供重开 / 返回标题选项。退出前调用 `GameEventSystem.getInstance().unregisterAll()` 清理残留处理器。

---

## 7. 增强牌系统（事件驱动重构）

### 7.1 设计模型

每张增强牌不再是"在计分函数里 if/else 判断"的硬编码逻辑，而是一个**携带事件订阅声明的数据结构**。安装时向 `GameEventSystem` 注册处理器，卸载时反注册。

```typescript
// types/cards.ts
export interface EnhanceCardDef {
  id: string;
  name: string;
  description: string;       // UI 展示文案
  spriteFrame: number;       // spritesheet 帧序号

  // 返回该卡牌在指定 layerIndex 上的所有事件处理器注册声明
  // layerIndex 决定处理器只响应本层的 SCORE_LAYER 事件
  getHandlers(layerIndex: number): RegisteredHandler[];
}
```

### 7.2 增强牌实现示例

**【顺子狂热】**：本层含顺子，计分乘区 +2.0

```typescript
// cards/enhance/StraightFever.ts
export const StraightFever: EnhanceCardDef = {
  id: 'enhance_straight_fever',
  name: '顺子狂热',
  description: '本层含顺子时，本层计分乘区 +2.0',
  spriteFrame: 0,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: this.id,
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return; // 只响应本层
        const hasStraight = ctx.detectedHandTypes.some(h => h.type === 'straight');
        if (hasStraight) {
          ctx.scoreMultiplier += 2.0;
        }
      },
    }];
  },
};
```

**【空心砖】**：本层计分值翻倍，承重计算时视为 0

```typescript
export const HollowBrick: EnhanceCardDef = {
  id: 'enhance_hollow_brick',
  name: '空心砖',
  description: '本层计分牌面值翻倍，但该层在坍塌承重中视为 0',
  spriteFrame: 1,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: this.id,
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        ctx.scoreMultiplier *= 2.0;
        ctx.overrideLayerWeight = 0; // 承重视为 0，极高坍塌风险
      },
    }];
  },
};
```

**【皇室专属】**：本层每有一张 J/Q/K，平加 +50 分

```typescript
export const RoyalExclusive: EnhanceCardDef = {
  id: 'enhance_royal_exclusive',
  name: '皇室专属',
  description: '本层每有一张 J/Q/K，本层计分 +50',
  spriteFrame: 2,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: this.id,
      sourceType: 'enhance',
      eventName: GAME_EVENTS.SCORE_LAYER,
      priority: 0,
      handler(ctx: ScoreLayerContext) {
        if (ctx.layerIndex !== layerIndex) return;
        const royalCount = ctx.cards.filter(c => c.rank >= 11 && c.rank <= 13).length;
        ctx.scoreBonusFlat += royalCount * 50;
      },
    }];
  },
};
```

**【幸运摸牌】**：每次摸到 A，手牌上限临时 +1（本关有效）

```typescript
export const LuckyDraw: EnhanceCardDef = {
  id: 'enhance_lucky_draw',
  name: '幸运摸牌',
  description: '每次从牌库摸到 A，本关手牌上限 +1',
  spriteFrame: 3,

  getHandlers(layerIndex: number): RegisteredHandler[] {
    return [{
      sourceId: this.id,
      sourceType: 'enhance',
      eventName: GAME_EVENTS.CARD_DRAWN,         // 订阅摸牌事件
      priority: 0,
      handler(ctx: CardDrawnContext) {
        if (ctx.card.rank === 14) {
          GameState.getInstance().handSize += 1;
        }
      },
    }];
  },
};
```

---

## 8. 挑战牌系统（事件驱动重构）

### 8.1 设计模型

挑战牌与增强牌共用同一套注册机制，区别在于 `sourceType: 'challenge'` 且效果为负面。挑战牌**不绑定特定层**，通常订阅 `SCORE_END` 或 `LEVEL_START` 等全局事件。

```typescript
export interface ChallengeCardDef {
  id: string;
  name: string;
  description: string;
  triggerEventName: GameEventName; // UI 上展示"在XX时触发"
  spriteFrame: number;

  getHandlers(): RegisteredHandler[];
}
```

### 8.2 挑战牌实现示例

**【酸雨腐蚀】**：每次计分结束后，随机 3 张桌面牌牌面值 -2

```typescript
export const AcidRain: ChallengeCardDef = {
  id: 'challenge_acid_rain',
  name: '酸雨腐蚀',
  description: '每次计分结束后，随机降低桌面 3 张牌牌面值 -2（可能引发连锁坍塌）',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 10,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: this.id,
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 10, // 挑战牌统一使用正优先级，在增强牌之后执行
      handler(ctx: ScoreEndContext) {
        // handler 只描述"意图"，实际修改 Card 对象由 BattleScene 监听结果后执行
        // 通过在 ctx 中附加副作用指令，保持 handler 与 Phaser 对象解耦
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({
          type: 'MODIFY_RANDOM_CARDS',
          count: 3,
          valueChange: -2,
          recalculateCollapse: true,
        });
      },
    }];
  },
};
```

**【强震】**：每次计分结束后，总得分扣除 10%

```typescript
export const Earthquake: ChallengeCardDef = {
  id: 'challenge_earthquake',
  name: '强震',
  description: '每次计分结束后，当前总得分扣除 10%',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 11,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: this.id,
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 10,
      handler(ctx: ScoreEndContext) {
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({
          type: 'MODIFY_TOTAL_SCORE',
          multiplier: 0.9,
        });
      },
    }];
  },
};
```

**【扣留】**：每次计分结束后，本关手牌上限永久 -1

```typescript
export const Detention: ChallengeCardDef = {
  id: 'challenge_detention',
  name: '扣留',
  description: '每次计分结束后，本关手牌上限 -1',
  triggerEventName: GAME_EVENTS.SCORE_END,
  spriteFrame: 12,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: this.id,
      sourceType: 'challenge',
      eventName: GAME_EVENTS.SCORE_END,
      priority: 10,
      handler(ctx: ScoreEndContext) {
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({
          type: 'MODIFY_HAND_SIZE',
          delta: -1,
          trimExcess: true,      // 若手牌当前超出新上限，销毁末尾牌
        });
      },
    }];
  },
};
```

**【开局诅咒】**：关卡开始时，随机摧毁底层一个槽位（订阅 `LEVEL_START`）

```typescript
export const OpeningCurse: ChallengeCardDef = {
  id: 'challenge_opening_curse',
  name: '开局诅咒',
  description: '关卡开始时，随机摧毁底层一个已放置的槽位',
  triggerEventName: GAME_EVENTS.LEVEL_START,
  spriteFrame: 13,

  getHandlers(): RegisteredHandler[] {
    return [{
      sourceId: this.id,
      sourceType: 'challenge',
      eventName: GAME_EVENTS.LEVEL_START,
      priority: 10,
      handler(ctx: LevelStartContext) {
        if (!ctx.sideEffects) ctx.sideEffects = [];
        ctx.sideEffects.push({
          type: 'DESTROY_RANDOM_SLOT',
          layerIndex: 2,         // 底层（index 2）
          count: 1,
          recalculateCollapse: false, // 开局摧毁不触发坍塌
        });
      },
    }];
  },
};
```

### 8.3 副作用指令处理（BattleScene）

`handler` 向 `ctx.sideEffects` 追加指令，BattleScene 在 `emit()` 返回后统一执行，保持 handler 零 Phaser 依赖：

```typescript
// BattleScene.ts — 计分结束后处理副作用
private applyScoreEndSideEffects(ctx: ScoreEndContext) {
  for (const effect of ctx.sideEffects ?? []) {
    switch (effect.type) {
      case 'MODIFY_RANDOM_CARDS':
        this.modifyRandomCards(effect.count, effect.valueChange);
        if (effect.recalculateCollapse) this.runCollapseCheck();
        break;
      case 'MODIFY_TOTAL_SCORE':
        GameState.getInstance().score *= effect.multiplier;
        this.registry.set('score', GameState.getInstance().score);
        break;
      case 'MODIFY_HAND_SIZE':
        GameState.getInstance().handSize += effect.delta;
        if (effect.trimExcess) this.trimHandToLimit();
        break;
      case 'DESTROY_RANDOM_SLOT':
        this.destroyRandomSlot(effect.layerIndex, effect.count);
        break;
    }
  }
}
```

---

## 9. 消耗牌系统

消耗牌效果为**即时触发**，不通过事件订阅驱动，而是在打出时直接调用效果函数，并向 `GameEventSystem` 派发 `CONSUME_CARD_USED` 事件（供增强牌/挑战牌响应）。

```typescript
export interface ConsumeCardDef {
  id: string;
  name: string;
  description: string;
  requiresTarget: boolean; // 是否需要选中一张桌面牌
  execute(ctx: ConsumeCardUsedContext, scene: BattleScene): void; // 即时效果
}
```

| 名称 | 触发方式 | 效果 |
|------|----------|------|
| 混凝土 | 即时（需选目标） | 目标牌面值临时 +5，触发坍塌检测 |
| 精准爆破 | 即时（需选目标） | 摧毁目标牌，不触发坍塌 |
| 暗箱操作 | 即时（需选2张手牌） | 将选中两张牌替换为黑桃A |
| 千斤顶 | 即时 | 本次计分基层承重临时 +20 |

---

## 10. 美术与 UI/UX 规范

**视觉风格**：像素风（Pixel Art），统一使用 `this.add.image` / `spritesheet` 渲染，禁止在游戏主场景中使用 DOM 元素。

**资源规格：**

| 资源 | 规格 | 备注 |
|------|------|------|
| 扑克牌正面 | 64 × 90 px | spritesheet，52帧，按 suit×rank 排列 |
| 扑克牌背面 | 64 × 90 px | 单图 |
| BoardSlot 背景 | 72 × 98 px | 含高亮帧（正常 / 悬停 / 危险）|
| 增强牌图标 | 48 × 48 px | spritesheet |
| 挑战牌图标 | 48 × 48 px | spritesheet |
| 消耗牌图标 | 48 × 48 px | spritesheet |
| 粒子贴图 | 8 × 8 px | spark / dust 各一张 |

**关键交互反馈：**

**① 动态承重预警**：拖拽悬停时实时计算假设结果，危险层红色高亮，不等待 drop 确认。

**② 计分动画**：`this.tweens.createTimeline()` 逐张顺序弹跳，配合 `SCORE_LAYER` 事件逐层触发。

**③ 坍塌动画**：`cameras.main.shake(300, 0.015)` + 粒子爆碎 + Card 淡出销毁。

**④ 阶段过渡提示**：阶段转移时在 UIScene 播放短暂的全屏提示文字（"计分中..." / "关卡结束"），持续 0.8s 后自动消失。

**⑤ 挑战牌触发提示**：挑战牌效果执行时，在 UIScene 弹出对应挑战牌图标 + 名称的浮窗动画，让玩家清楚感知"是哪张挑战牌造成了这个后果"。

---

## 11. 技术架构

### 11.1 目录结构

```
/
├── public/
│   └── assets/
│       ├── images/
│       │   ├── cards/           # sheet.png（52帧）, back.png
│       │   ├── ui/              # slot.png, slot-hover.png, slot-danger.png, enhance-slot.png
│       │   └── effects/         # spark.png, dust.png
│       └── audio/
│           ├── bgm/             # battle.ogg
│           └── sfx/             # card-place.ogg, collapse.ogg, score.ogg
│
└── src/
    ├── main.ts
    ├── config.ts                # ASSET_KEYS, HAND_TYPE_MULTIPLIERS, PHASE 常量
    │
    ├── types/
    │   ├── card.ts              # Suit, Rank, HandType, CardData, Layer, CollapseResult
    │   ├── game.ts              # GamePhase, ShopItem, SideEffect, LayerSnapshot
    │   └── events.ts            # 所有 EventContext 接口
    │
    ├── events/
    │   ├── GameEvents.ts        # GAME_EVENTS 枚举
    │   └── GameEventSystem.ts   # 注册/派发/卸载处理器
    │
    ├── logic/
    │   ├── PhaseManager.ts      # 阶段状态机，调用 GameEventSystem.emit
    │   ├── collapse.ts          # checkCollapse(), getLayerWeight(), getWeightAbove()
    │   ├── scoring.ts           # detectHandType(), calculateLayerScore()
    │   └── deck.ts              # createDeck(), shuffle(), draw()
    │
    ├── state/
    │   └── GameState.ts         # 跨场景持久单例
    │
    ├── scenes/
    │   ├── BootScene.ts
    │   ├── PreloadScene.ts
    │   ├── TitleScene.ts
    │   ├── ShopScene.ts
    │   ├── BattleScene.ts       # 持有 PhaseManager，协调事件派发与副作用执行
    │   ├── UIScene.ts           # 并行 HUD，监听 registry + EventBus
    │   ├── GameOverScene.ts
    │   └── VictoryScene.ts
    │
    ├── gameobjects/
    │   ├── Card.ts              # extends Image，含拖拽逻辑
    │   ├── BoardSlot.ts         # Zone + Image，吸附与高亮
    │   ├── EnhanceCard.ts       # extends Image，展示用
    │   └── ConsumeCard.ts       # extends Image，展示用
    │
    ├── cards/
    │   ├── enhance/             # 每张增强牌一个文件
    │   │   ├── StraightFever.ts
    │   │   ├── HollowBrick.ts
    │   │   ├── RoyalExclusive.ts
    │   │   └── LuckyDraw.ts
    │   ├── challenge/           # 每张挑战牌一个文件
    │   │   ├── AcidRain.ts
    │   │   ├── Earthquake.ts
    │   │   ├── Detention.ts
    │   │   └── OpeningCurse.ts
    │   └── consume/             # 每张消耗牌一个文件
    │       ├── Concrete.ts
    │       ├── PrecisionBlast.ts
    │       ├── DarkDeal.ts
    │       └── Jackscrew.ts
    │
    └── utils/
        └── SoundManager.ts
```

### 11.2 关键模块接口

**`state/GameState.ts`**
```typescript
class GameState {
  private static instance: GameState;
  static getInstance(): GameState;

  currentLevel: number;
  score: number;
  gold: number;
  handSize: number;
  scoreChances: number;
  discardChances: number;
  foundation: number;
  tempFoundationBonus: number;

  deck: CardData[];
  enhanceSlots: (EnhanceCardDef | null)[];   // 长度固定为 3
  challengeCards: ChallengeCardDef[];

  reset(): void;
  resetRound(): void;
}
```

**`logic/collapse.ts`**
```typescript
export function getLayerWeight(layer: Layer): number;
// 若 layer 含 overrideLayerWeight（来自 SCORE_LAYER 事件结果），返回 override 值

export function getWeightAbove(layers: Layer[], targetIndex: number): number;

export function checkCollapse(layers: Layer[]): CollapseResult;
```

**`logic/scoring.ts`**
```typescript
export function detectHandType(cards: CardData[]): DetectedHand[];

export function calculateBaseScore(hands: DetectedHand[]): number;
// 只计算纯牌型得分，不含增强牌乘区（乘区由 SCORE_LAYER 事件处理器叠加）
```

### 11.3 Scene 数据传递规范

| 场景跳转 | 传递方式 | 数据 |
|----------|----------|------|
| TitleScene → ShopScene | `scene.start(key, data)` | `{ isFirstRun: true }` |
| ShopScene → BattleScene | `scene.start(key, data)` | `{ level: n }` |
| BattleScene ↔ UIScene | `registry` + `EventBus` | phase, score, chances |
| BattleScene → ShopScene/GameOver | `GameState` 单例 | 持久跨关数据 |

---

## 12. 开发与平衡性建议

**事件优先级约定**：增强牌统一使用 `priority: 0`，挑战牌统一使用 `priority: 10`，保证增益效果先于惩罚效果计算，符合玩家直觉。需要插队的特殊牌使用负优先级（如 `priority: -5`）。

**副作用与 Phaser 解耦**：handler 内部禁止直接操作 Phaser 对象（Card / BoardSlot），所有对游戏对象的修改通过 `ctx.sideEffects` 指令传递给 BattleScene 执行，保证 `cards/` 目录下代码零 Phaser 依赖，可独立单测。

**logic/ 单测优先**：`collapse.ts`、`scoring.ts`、`PhaseManager.ts`、`GameEventSystem.ts` 均无 Phaser 依赖，优先用 Vitest 覆盖边界情况后再接入场景。

**空心砖连锁风险**：`overrideLayerWeight = 0` 意味着该层上方任何一张牌都将导致坍塌，UI 上需要有常驻红色警告标识，并在玩家拖牌悬停时第一时间触发承重预警。

**增强牌移除时机**：增强牌被从槽位移走（`ENHANCE_CARD_MOVED` 或商店替换）时，必须立即调用 `GameEventSystem.unregister(card.id)`，防止已卸载的增强牌仍在响应事件。

**Scene 内存管理**：`BattleScene` 退出时：① `this.scene.stop('UIScene')`；② `GameEventSystem.getInstance().unregisterAll()`；③ 销毁所有 Card / BoardSlot 对象。