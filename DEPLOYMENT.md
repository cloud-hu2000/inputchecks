# 将 InputChecks 部署到 Cloudflare Pages

本指南用于将静态 Astro 网站部署到 `https://inputchecks.com`。项目不需要 Cloudflare Worker、数据库或服务端运行环境。

## 1. 准备代码仓库

将本项目推送至 GitHub、GitLab 或 Bitbucket。推送前，在本地执行以下检查：

```bash
npm install
npm run lint
npm run test
npm run build
```

构建产物位于 `dist` 目录。除非你的团队工作流另有规定，否则不需要将 `dist` 提交到 Git 仓库。

## 2. 创建 Cloudflare Pages 项目

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 打开 **Workers & Pages**，点击 **Create application** → **Pages** → **Connect to Git**。
3. 如有需要，授权 Cloudflare 访问 Git 平台，然后选择 InputChecks 仓库。
4. 选择生产分支，通常为 `main`。
5. 使用以下构建设置：

| 控制台字段 | 填写内容 |
| --- | --- |
| Framework preset | `Astro` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `22` |

6. 在 **Environment variables** 中添加生产环境变量：

| 变量名 | 值 |
| --- | --- |
| `SITE_URL` | `https://inputchecks.com` |

7. 点击 **Save and Deploy**。构建成功后，Cloudflare 会先提供一个 `*.pages.dev` 预览地址。

## 3. 绑定 inputchecks.com

在 Pages 项目中打开 **Custom domains**，点击 **Set up a custom domain**。

1. 添加 `inputchecks.com`，并将其设为主域名。
2. 如果域名已经使用 Cloudflare 的 DNS / Nameservers，Cloudflare 通常会自动创建所需 DNS 记录。
3. 如果 DNS 托管在其他服务商处，请严格按照 Cloudflare 页面显示的记录类型、主机名和值添加记录。除非 Cloudflare 明确要求，否则不要为 Pages 项目自行创建 A 记录。
4. 同时添加 `www.inputchecks.com`，然后在 **Rules** → **Redirect Rules** 中建立跳转：

   ```text
   www.inputchecks.com/*
   → https://inputchecks.com/$1
   ```

   这样可避免 `www` 和非 `www` 版本产生重复页面。
5. 等待自定义域名状态显示为 **Active**。Cloudflare 会自动配置 HTTPS 证书。

## 4. 可选：接入 GA4 与 AdSense

仅在相应服务已准备或获批后再添加变量。在 Cloudflare Pages 的 **Settings** → **Environment variables** 中为 Production 环境添加，保存后重新部署。

| 变量名 | 是否必填 | 用途 |
| --- | --- | --- |
| `PUBLIC_GA_ID` | 否 | GA4 衡量 ID；未设置时不会加载 GA 脚本。 |
| `PUBLIC_ADSENSE_CLIENT_ID` | 否 | AdSense Client ID；未设置时不会请求广告脚本。 |
| `PUBLIC_ADSENSE_SLOT_TOP` | 否 | 测试结果下方的广告位 ID。 |
| `PUBLIC_ADSENSE_SLOT_CONTENT` | 否 | 正文中广告位预留 ID。 |
| `PUBLIC_ADSENSE_SLOT_SIDEBAR` | 否 | 桌面端侧栏广告位预留 ID。 |

不要在以 `PUBLIC_` 开头的变量中保存密钥、Token 或其他敏感信息；这类变量会被写入浏览器端生成代码。

## 5. 上线后检查清单

当 DNS 和 HTTPS 均已生效后，逐项检查：

- `https://inputchecks.com/` 能正常打开，且滚轮测试可以接收输入。
- `https://inputchecks.com/robots.txt` 指向 `https://inputchecks.com/sitemap.xml`。
- `https://inputchecks.com/sitemap.xml` 能正常访问，且只包含预期的 canonical 页面。
- `https://inputchecks.com/llms.txt` 能正常访问，并列出网站的主要工具、指南和使用限制。
- 首页 HTML 的 canonical URL 为 `https://inputchecks.com/`。
- `https://www.inputchecks.com/` 会跳转到 `https://inputchecks.com/`。
- 其余三个工具页与三篇指南页均能正常打开。
- 在 Google Search Console 中添加 `inputchecks.com` 的网域资源（Domain property），完成验证后提交 `https://inputchecks.com/sitemap.xml`。

## 后续发布

每次推送到配置的生产分支时，Cloudflare Pages 会自动重新部署。Pull Request 可以自动生成预览部署。生产和预览环境都建议使用 `SITE_URL=https://inputchecks.com`，从而避免 canonical URL 指向临时的 Pages 预览域名。
