# agent-connector 内测快速开始

## 1. 准备

- Windows 10/11。
- Node.js 20 或更新版本。
- 一个可以在飞书开放平台创建企业自建应用的账号。

不需要公网 IP、内网穿透或端口映射。

## 2. 解压并启动配置台

在 PowerShell 中进入解压目录，运行：

```powershell
.\setup.ps1
```

浏览器会打开 `http://127.0.0.1:43120`。这个页面只监听本机。

## 3. 创建飞书机器人

1. 在飞书开放平台创建企业自建应用。
2. 启用机器人能力。
3. 添加发送消息权限 `im:message:send_as_bot`。
4. 订阅 `im.message.receive_v1`，接收方式选择“使用长连接接收事件”。
5. 发布应用，并把机器人加入测试群。

## 4. 配置飞书与 Agent

在配置台填写 App ID、App Secret 和本地 Agent。HTTP Agent 填用户自己服务提供的固定 URL，例如：

```text
http://127.0.0.1:8787/ask
```

该服务需要接收 JSON，并返回配置中 `responsePath` 指向的文本字段。CLI Agent 填写可执行文件和只读参数。

第一次可以先把用户 `open_id` 留空保存。此时机器人只会响应 `/whoami`，不会运行任何 Agent。

## 5. 获取自己的 open_id

保存后关闭配置台，再运行：

```powershell
.\start.ps1
```

在飞书群里 @ 机器人并发送：

```text
/whoami
```

把返回的 `open_id` 填回配置台，再次保存并重启 Connector。之后可以使用：

```text
/agents
/status
/ask codex 检查当前项目的风险
/ask local-http 你好
```

## 6. 常见问题

- 同一个飞书应用通常只允许一条长连接接收事件。启动前停止占用同一 App 的其他 Gateway。
- 如果显示凭据无效，检查应用是否已发布、App ID/Secret 是否对应同一应用。
- 如果机器人完全没有响应，检查应用是否已启用机器人、是否加入群、长连接事件是否订阅。
- App Secret 只写入本机 `.env`，不要发到聊天、工单或代码仓库。
- 当前版本默认只读。不要用它执行未经审批的写文件、发布或删除操作。
