# CAE Score v2 Composer Guide

## 1. 格式速查

结构：`meta` `tracks` `patterns` `chapters` `score`。音符 `[note,duration,beat?]`，如 `["G3","q",1]` `["R","h","3-4"]`。Pattern `"$p.track"` 或 `{"$ref":"p.track","transpose":5}`。复用 `"ref":3` `"silence":true`。过渡 `"blend":{"next":"ch","weight":0.3}`。velocity 锚定 chapter：`["intro:start",0.4]`。

## 2. 章节过渡

**同调转换**：保留 pad 长音，鼓组最后2小节退出，旋律下行收束根音，新章从 pad 加入。
**升调过渡**：找 pivot chord（如 Gm 的 VI=Eb=Bb 大调 IV），倒数第2小节 pivot，最后1小节新调 I 级建立。
**舒缓→激烈**：bass 独奏1小节，kick half-time 变标准4/4，snare 16分 roll，arp 加密。
**激烈→舒缓**：先撤 hihat/snare，kick 变 half-time，旋律下行收窄，pad 保留长音。

## 3. 和声进行

大调：`I-V-vi-IV` `I-IV-V-I` `I-vi-IV-V`
小调：`i-iv-VII-III` `i-VI-III-VII` `i-iv-V-i`
芯片：平行五度/八度、power chord 循环、单音 bass 暗示和弦

## 4. 旋律衔接

动机重复2次后第3次变奏。跳跃不超八度，超则插经过音。乐句结束落和弦音（大调1/3/5级，小调1/4/5级）。乐句间用共同音或级进衔接。

## 5. 鼓组编排

标准4/4：kick 1&3 + snare 2&4 + hihat 8th。Half-time：kick 1 + snare 3 + hihat quarter。渐强：前2小节仅 kick 1，第3小节加 snare 3，第4小节加 hihat 8th，第5小节 kick 每拍。

## 6. 动态曲线

渐强=velocity上升(0.4→0.95)+音符加密(h→q→e)+音域扩大。渐弱=反向。高潮保持最高velocity但插休止。同chapter velocity变化不超0.3，transition允许突变。

## 7. 风格参考

8bit-nes：4轨(2 pulse+triangle+noise)，旋律简单，无复杂和声，时值以q/h为主。
16bit-sfc：7-8轨(lead/harmony/bass/pad/arp/鼓组)，和声丰富，可用e/s加密。
场景：标题(上行琶音+大调)→战斗(小调+密集鼓)→商店(舒缓少鼓)→Boss(半音阶+不协和)→结束(下行+fade)。
