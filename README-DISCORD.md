# 🎛️ Discord Command Center — Setup Guide

Replace Telegram with Discord as your **AI Operations Center**. Your private Discord server becomes a live dashboard where you monitor, approve, generate, publish and analyze everything with a single click.

---

## 1. Create the Discord Bot

1. Go to **https://discord.com/developers/applications**
2. Click **New Application** → name it `SocialForge`
3. Go to **Bot** tab → **Reset Token** → copy the token
4. Enable **Message Content Intent** (Settings → Bot → Privileged Gateway Intents)

## 2. Invite the Bot to Your Server

Use this invite URL (replace `YOUR_CLIENT_ID` with your app's Client ID from the General Information tab):

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268438608&scope=bot%20applications.commands
```

- Permissions: Send Messages, Embed Links, Read Message History, Manage Channels, Create Public Threads
- Scope: `bot` + `applications.commands`

## 3. Get Your Server ID

- Right-click your server name in Discord → **Copy Server ID**
- (You need Developer Mode enabled: Settings → Advanced → Developer Mode)

## 4. Configure in the Web App

1. Open **Settings → Discord** tab
2. Paste the **Bot Token**
3. Paste the **Guild (Server) ID**
4. Click **Save**
5. Click **Setup Server** — this automatically creates all 21 channels across 4 categories:

| Category | Channels |
|---|---|
| **Operations** | announcements, dashboard, scheduler, approval-center, error-center, automation-logs, running-jobs, system-health |
| **Intelligence** | news-radar, linkedin-engagement, analytics, daily-reports |
| **Content** | compose, blog-engine, ai-generation, image-generation, content-library, seo-center, hashtag-engine |
| **Publishing** | social-publishing, campaign-manager |

6. Click **Register Commands** to enable slash commands

## 5. Environment Variables (Optional)

If you prefer env-based configuration instead of the Settings UI:

```
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id_here
```

## 6. Slash Commands

| Command | Description |
|---|---|
| `/setup` | Create/verify all 21 channels + categories |
| `/dashboard` | Update the live AI Operations Dashboard |
| `/news` | Post pending news opportunities to #news-radar |
| `/approvals` | Post pending drafts to #approval-center |
| `/analytics` | Refresh #analytics with performance data |
| `/schedule` | Refresh #scheduler with today's plan |
| `/health` | Refresh #system-health with service status |
| `/publish <job_id>` | Publish a job by ID |
| `/status` | Show current system status |
| `/jobs [status]` | List jobs filtered by status |

## 7. Every Detected News Opportunity

The **News Radar** sends a rich Discord embed with:
- 📰 Headline, source, published time
- 📝 AI summary + why this matters
- 🎓 MBA, 📊 Business Analytics, 👥 HR, 🔍 SEO, 🔥 Virality, 🎯 Audience Match, 📈 Trend scores
- ⭐ Opportunity score, 📏 estimated reach, 📱 recommended platforms
- **Buttons**: Generate All, LinkedIn, Instagram, Facebook, Threads, Blog, Newsletter, Schedule, Save, Read, Re-analyze, Ignore

## 8. AI Generation Progress

Clicking **Generate** updates the message live:
```
█░░░░░░░░░ 10% — Reading article…
████░░░░░░ 50% — Writing LinkedIn…
██████████ 100% — ✅ Complete!
```

## 9. Approvals & Publishing

Each generated draft appears in **#approval-center** with:
- Full preview of every platform caption/hashtags/CTA
- **Buttons**: Approve, Publish Now, Schedule, Edit, Regenerate, Skip, Reject

Publishing results appear in **#social-publishing** with:
- ✅/❌ per platform, published URLs, timestamps
- **Retry** + **Logs** buttons on failure

## 10. Google Sheets

Everything is still written to Google Sheets — the Discord Command Center is a **view and control layer** on top of your existing operational database. Every approve, publish, reject, schedule action updates the corresponding sheet.

## 11. Webhook URL

Discord sends interactions to:

```
POST {YOUR_BASE_URL}/api/discord/webhook
```

This endpoint is already registered in `middleware.js` as public.