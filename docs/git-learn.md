# Git 常用操作学习文档

## 1. 忽略文件与刷新缓存

### 添加忽略规则
在项目根目录的 `.gitignore` 文件中添加需要忽略的文件或目录，例如：
```
docs/architecture.md
```

### 强制刷新 git 缓存（让 .gitignore 立即生效）
1. 移除已被 git 跟踪但现在要忽略的文件：
   ```bash
   git rm --cached docs/architecture.md
   ```
   > 这样不会删除本地文件，只是让 git 停止跟踪它。

2. 如果有多项需要刷新，可以批量操作：
   ```bash
   git rm -r --cached .
   git add .
   ```
   > 这会让所有 .gitignore 规则生效，重新索引所有文件。

3. 提交更改：
   ```bash
   git commit -m "refresh git cache and update .gitignore"
   ```

4. 推送到远程仓库：
   ```bash
   git push
   ```

---

## 2. 常用 Git 命令

### 初始化仓库
```bash
git init
```

### 克隆远程仓库
```bash
git clone <仓库地址>
```

### 查看当前状态
```bash
git status
```

### 添加文件到暂存区
```bash
git add <文件或目录>
```

### 提交更改
```bash
git commit -m "提交说明"
```

### 查看提交历史
```bash
git log
```

### 推送到远程仓库
```bash
git push
```

### 拉取远程更新
```bash
git pull
```

---

## 3. 其他实用技巧

- 查看分支：
  ```bash
  git branch
  ```
- 创建新分支：
  ```bash
  git checkout -b <新分支名>
  ```
- 切换分支：
  ```bash
  git checkout <分支名>
  ```
- 合并分支：
  ```bash
  git merge <分支名>
  ```

---

## 4. 进阶操作命令

### 1. 撤销与重置（reset）
- 回退到某个提交（保留修改到暂存区）：
  ```bash
  git reset --soft <commit>
  ```
- 回退到某个提交（保留修改到工作区）：
  ```bash
  git reset --mixed <commit>
  ```
- 回退到某个提交（彻底丢弃修改）：
  ```bash
  git reset --hard <commit>
  ```

### 2. 变基（rebase）
- 将当前分支变基到目标分支最新提交：
  ```bash
  git rebase <目标分支>
  ```
- 交互式变基（可编辑、合并、重排提交）：
  ```bash
  git rebase -i <commit>
  ```

### 3. 拣选提交（cherry-pick）
- 将指定提交应用到当前分支：
  ```bash
  git cherry-pick <commit>
  ```

### 4. 合并分支（merge）
- 合并目标分支到当前分支：
  ```bash
  git merge <目标分支>
  ```
- 遇到冲突时，手动解决后：
  ```bash
  git add <冲突文件>
  git commit
  ```

---

如需更详细的 Git 学习资料，可参考 [Pro Git 中文版](https://git-scm.com/book/zh/v2) 或官方文档。 