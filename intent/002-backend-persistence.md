# 意图：Memo 后端服务与持久化存储

作者：tony（产品发起人）。状态：已接受（2026-10-11，四项未决问题已决策）。

## 问题

工作台的全部领域数据目前仅存于单一浏览器的 localStorage：不跨设备、不跨浏览器，清理浏览器数据即全部丢失，也无法支撑多人协作，与「项目管理工作台」的产品定位不符。

## 提议的结果

交付 Memo 后端服务：任务、项目、成员、团队、动态等领域数据持久化到关系型数据库（如 PostgreSQL、MySQL）；前端经 API 读写数据，localStorage 从主存储降级为离线缓存或移除；演示种子数据模式保留可切换。

## 受影响的用户和系统

- 用户：全部 Memo 用户（跨设备使用与多人协作的基础）
- 系统：前端应用（实施时自 `src/frontend/` 迁至 `frontend/`；`core/store.js` 数据层引入 API 客户端，对上层保持接口不变）、新增 `backend/`（FastAPI）与 PostgreSQL、部署与运行环境（服务结构参考 fastapi/full-stack-fastapi-template）

## 约束

- 前端保持零 UI 框架、零运行时依赖的架构，数据层替换不得给前端引入运行时依赖
- 现有 UI 与交互不变，仅替换数据来源
- 认证方案最小可行；技术栈已决策：Python（FastAPI）+ PostgreSQL，自托管 Docker 部署，首版不做离线支持
- 界面默认语言为中文（沿用 001 已决策约定）

## 未决问题

- 后端技术栈偏好（Node.js / Go / Python / …）？——已决策：Python（FastAPI）。
- 数据库选型偏好（PostgreSQL / MySQL / 其他）？——已决策：PostgreSQL。
- 部署形态：自托管还是云服务？——已决策：自托管 Docker。
- 是否要求离线支持与冲突同步？——已决策：首版不做离线，在线优先。
