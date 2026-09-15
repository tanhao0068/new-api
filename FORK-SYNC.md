# mibi-api 二次开发 fork + 同步架构

> 定位：在 `QuantumNous/new-api`（48k star，活性极高、每日推进）上做定制开发，同时持续与上游合流。

## 为什么改架构

旧做法（`tien2022/mibiia`）把 new-api 源码**内联成子目录**、靠手动 `git merge` 合上游，
`master` 与 `upstream/main` **无共同历史**——每合一次上游，冲突面越大、越难定位。
真实 fork 保留上游完整提交历史，合流变成可预测的 **fast-forward + rebase**。

## 仓库拓扑

| remote   | 地址 | 角色 | 权限 |
|----------|------|------|------|
| `upstream` | `https://gh-proxy.com/https://github.com/QuantumNous/new-api.git` | 开源上游 | fetch（push 已禁用为 `no_push`） |
| `origin`   | `git@github.com:tanhao0068/new-api.git` | 你的 fork | fetch + push |

分支约定：

- `main` —— **纯净镜像上游，禁止直接 commit**，只做 `--ff-only` 快进。
- `mibi-devel` —— **长期主开发分支**（2026-09-15 从 main 切出），定制开发的首个落点，再从它切短命 `feat/xxx` 分支，完成后合回 `mibi-devel`。
- feature 分支（如 `feat/xxx`、`mibi-custom`）—— 单项定制开发，push 到 `origin`。
- 定制/主开发分支定期 `rebase main`（而非 merge），保持历史线性、冲突点集中一次解决。

## 同步流程（每次想跟上上游时）

```bash
cd /home/test/data/mibi-api
bash scripts/sync-upstream.sh
```

脚本做的事：检查工作区干净 → `fetch upstream` → `fetch origin` → `git merge --ff-only upstream/main` → `push origin main`。

定制分支跟进新上游：

```bash
git checkout feats/xxx
git rebase main          # 把定制重放到上游最新之上
git push -f origin feats/xxx   # rebase 后需强推（仅限自己的 feature 分支）
```

## 本项目同步工具（正常跟踪，随 fork 分发）

`scripts/sync-upstream.sh` 与 `FORK-SYNC.md` 是**正常 git 跟踪**文件（会 push 到 fork、随 fork 换机可复用）。上游仓库无同名文件，合流不会冲突。

## 已核实事实（2026-09-14）

- 上游 `QuantumNous/new-api`，main 最新 tag `v1.0.0-rc.37`，48k star。
- 你的 fork `tanhao0068/new-api` 之前落后上游 **760 提交**（0 领先，纯过期，clean fast-forward）。
- gitee `tien2022/mibiia` 仍为私有仓（HTTP 403），内联式管理；本目录是新的 fork 标准模式，与其并行，互不影响。