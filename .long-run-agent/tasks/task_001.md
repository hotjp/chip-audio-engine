# task_001

## ⚠️ 重要提示（Agent 必读）

**当前位置**: `.long-run-agent/tasks/task_001.md`（任务描述文件）

**工作目录**: 项目根目录（`.long-run-agent` 的同级目录）

**产出物**: 请在项目根目录或适当子目录创建交付物

**这是配置文件**，不是最终产出！

## 描述

项目骨架：package.json + tsconfig.json + 构建配置


## 需求 (requirements)

初始化 npm 包（name: chip-audio-engine）、TypeScript 配置（strict mode, target ES2020, moduleResolution node16）、构建脚本（tsc 编译）。确保 tsc 编译零错误，产物在 dist/ 目录。



## 验收标准 (acceptance)


- tsc 编译零错误

- dist/ 目录存在

- index.ts 导出空对象






## 设计方案 (design)

<!-- 在此填写架构设计、技术选型、实现思路 -->


## 验证证据（完成前必填）

<!-- 标记完成前，请提供以下证据： -->

- [ ] **实现证明**: 简要说明如何实现
- [ ] **测试验证**: 如何验证功能正常（测试步骤/截图/命令输出）
- [ ] **影响范围**: 是否影响其他功能

### 测试步骤
1. 
2. 
3. 

### 验证结果
<!-- 粘贴验证截图、命令输出或测试结果 -->
## 交付物 (deliverables)

- package.json
- tsconfig.json
- src/index.ts
- .gitignore

## 设计方案 (design)

npm 包，TypeScript strict mode，ES2020 target，node16 moduleResolution。
构建用 tsc，产物输出到 dist/。
入口文件 src/index.ts 先导出空对象占位。
gitignore 忽略 node_modules 和 dist。
