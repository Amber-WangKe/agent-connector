# GitHub 连接不稳定时怎么办

症状通常是 `api.github.com` 可以访问，但 `https://github.com/` 一直超时，`gh auth login` 和网页登录也随后失败。这更像是本机到 GitHub 某个前端 IP 的路由问题，不一定是整个 GitHub 宕机。

## 先判断故障范围

```powershell
curl.exe -I --connect-timeout 10 https://api.github.com/
curl.exe -I --connect-timeout 10 https://github.com/
Resolve-DnsName github.com -Type A
```

如果 API 正常而网页超时，可以验证固定 IP。下面只是示例，IP 会变化，不要长期盲用：

```powershell
curl.exe -I --connect-timeout 10 --resolve github.com:443:<VERIFIED_IP> https://github.com/
```

## 推荐顺序

1. 优先使用可信的代理、VPN 或公司网络出口，并让 Git、GitHub CLI 和浏览器走同一条线路。
2. 只需要推送代码时，可使用 GitHub 的 SSH 443 端口：

```text
Host github.com
  HostName ssh.github.com
  Port 443
  User git
```

3. 必须让浏览器和 GitHub CLI 都访问 `github.com` 时，可临时固定一个已验证可达的 GitHub 前端 IP。

仓库内的脚本只维护一个带标记的 hosts 区块，不会删除用户已有条目；执行前会备份原文件：

```powershell
# 先测试，不需要管理员权限
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\fix-github-hosts.ps1 -Action Test

# 在“以管理员身份运行”的 PowerShell 中执行，脚本会自动测试候选 IP
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\fix-github-hosts.ps1 -Action Apply

# 也可以显式指定一个刚验证过的 IP
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\fix-github-hosts.ps1 -Action Apply -Ip <VERIFIED_IP>

# 恢复原状
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\fix-github-hosts.ps1 -Action Revert
```

`hosts` 固定 IP 只是临时排障手段。GitHub 轮换地址后可能失效；如果延迟再次显著变差，应先撤销该区块，再重新测试候选 IP 或改用可信代理。不要把未知来源的 hosts 配置复制到生产机器。

## 推送和克隆

固定 IP 后先验证，再登录：

```powershell
ipconfig /flushdns
curl.exe -I https://github.com/
gh auth status
gh auth login --hostname github.com --git-protocol https --web --scopes "repo,read:org,gist,workflow"
```

大仓库优先使用浅克隆。只在确实需要历史时再拉取完整仓库：

```powershell
git clone --depth 1 https://github.com/<owner>/<repo>.git
```

## 安全注意事项

- 不要把 GitHub Token 写进仓库、命令行截图或公开文档。
- 不要为了提速关闭 TLS 校验。
- 不要直接把 Token 长期写进 remote URL；优先使用 `gh auth setup-git` 或系统凭据管理器。
- hosts 修改属于系统级变更，必须保留备份并确认只改动 GitHub 相关行。
