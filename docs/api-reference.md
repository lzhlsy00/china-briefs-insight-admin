# FortuneNews Admin API 说明

FortuneNews Admin 已集成原 Express 后端，所有 API 由 Next.js App Router 提供，统一前缀为 `/api/v1`。本说明面向前端调用，介绍各端点用法。

## 通用信息
- **基础地址**：同域可直接使用相对路径，例如 `/api/v1/admin/news`。
- **请求类型**：`Content-Type: application/json`，除 GET 外的接口需传 JSON 体。
- **返回结构**：
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "可选提示语"
  }
  ```
  失败时 `success=false`，提供 `message`，并可能附带 `errors`（字段级错误说明）。
- **日期格式**：`isoDate` 为 ISO8601 字符串，如 `2024-05-20T08:00:00.000Z`。
- **分页参数**：`page` 默认 1，`limit` 默认 10，最大 100。

---

## 管理端接口

### GET `/api/v1/admin/news`
- **说明**：查询新闻列表。
- **查询参数**：
  | 参数 | 说明 |
  | --- | --- |
  | `page` | 页码（默认 1） |
  | `limit` | 每页条数（默认 10，最大 100） |
  | `category` | 分类模糊搜索 |
  | `status` | `DRAFT` 或 `PUBLISH` |
  | `title` | 标题模糊搜索 |
  | `aiWorth` | `true` 或 `false` |
  | `sortBy` | `id`/`title`/`isoDate`/`category`/`status`/`aiWorth`（默认 `id`） |
  | `sortOrder` | `asc` 或 `desc`（默认 `desc`） |
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "news": [
        {
          "id": 1,
          "title": "标题",
          "isoDate": "2024-05-20T08:00:00.000Z",
          "link": "https://example.com",
          "content": "摘要",
          "aiWorth": true,
          "aiReason": "理由",
          "category": "科技",
          "status": "PUBLISH"
        }
      ],
      "pagination": {
        "current": 1,
        "total": 3,
        "count": 10,
        "totalCount": 25,
        "hasNext": true,
        "hasPrev": false
      }
    }
  }
  ```

### GET `/api/v1/admin/news/:id`
- **说明**：查询单条新闻，返回完整字段。
- **响应**：`data` 为新闻对象；不存在时返回 `404`。

### PUT `/api/v1/admin/news/:id`
- **说明**：更新新闻。
- **请求体**（任意字段可选）：
  ```json
  {
    "title": "修改后的标题",
    "isoDate": "2024-05-21T10:00:00Z",
    "link": "https://example.com",
    "content": "正文",
    "aiWorth": true,
    "aiReason": "机器评估说明",
    "category": "财经",
    "status": "PUBLISH"
  }
  ```
- **响应**：更新后的新闻数据。

### DELETE `/api/v1/admin/news/:id`
- **说明**：删除新闻。
- **响应**：`data.id` 为被删除的新闻 ID。

### GET `/api/v1/admin/stats`
- **说明**：获取整体统计。
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "total": 120,
      "status": {
        "draft": 30,
        "published": 90
      },
      "aiWorth": {
        "true": 50,
        "false": 40,
        "null": 30
      },
      "categories": [
        { "name": "科技", "count": 40 },
        { "name": "财经", "count": 25 }
      ]
    }
  }
  ```

---

## 第三方上传接口

### POST `/api/v1/upload`
- **说明**：供外部系统写入新闻。
- **请求体**：
  ```json
  {
    "title": "标题",
    "isoDate": "2024-05-20T08:00:00Z",
    "link": "https://example.com",
    "content": "正文，可选",
    "aiWorth": true,
    "aiReason": "AI 评估理由，可选",
    "category": "科技",
    "status": "DRAFT"
  }
  ```
- **响应**：新建记录，包含数据库 ID。

---

## 面向前台/公共页面接口

### GET `/api/v1/public/news`
- **说明**：查询已发布新闻列表。
- **查询参数**：`page`、`limit`、`category`、`hot=true`（筛 `aiWorth=true`）、`latest=true`（按时间降序）。
- **响应**：新闻列表不含 `aiReason`、`status` 等管理字段，附带分页信息。

### GET `/api/v1/public/news/:id`
- **说明**：获取发布状态的新闻详情；未发布或不存在返回 `404`。

### GET `/api/v1/public/categories`
- **说明**：统计已发布新闻的分类及数量。

### GET `/api/v1/public/search`
- **说明**：按标题或内容模糊搜索已发布新闻。
- **查询参数**：`q`（必填关键词）、`page`、`limit`。

### GET `/api/v1/ai/unprocessed`
- **说明**：返回 10 条 `aiWorth` 为空的新闻，用于 AI 处理。
- **响应**：包含 `news`、`count`、`totalPending`、`hasMore`。

---

## 系统辅助接口

| 接口 | 作用 |
| --- | --- |
| `GET /api/v1` | 基本信息与入口列表 |
| `GET /api/v1/docs` | 返回上述端点的 JSON 概览 |
| `GET /api/v1/health` | 健康检查（含数据库连通情况） |
| `POST /api/v1/push/generate` | 触发 AI 生成推送摘要并写入待发送列表 |

### POST `/api/v1/push/generate`
- **说明**：定时任务调用此端点，从最新已发布新闻中挑选 5 条生成推送摘要，并写入 `push_content`。
- **请求体**：无需请求体；建议结合 Supabase 或 Vercel Cron 每日执行一次。
- **响应**：成功时返回生成的 `contentId`、入库时间 `date` 以及被选中的 5 条新闻。
  ```json
  {
    "success": true,
    "data": {
      "created": true,
      "contentId": 123,
      "date": "2024-12-20T02:30:00.000Z",
      "published": false,
      "items": [
        {"id": 1, "title": "Sample Headline", "summary": "Concise English summary explaining why the story matters.", "link": "https://www.bitechina.com/article/1"}
      ]
    },
    "message": "推送内容已生成"
  }
  ```
- **备注**：需要配置 `OPENAI_API_KEY`；默认以英文返回标题和摘要，若未配置将回退为按时间排序的最近五条新闻（无 AI 评分）。

---

## 调用示例

```bash
# 获取新闻列表（按时间降序）
curl "http://localhost:3000/api/v1/admin/news?sortBy=isoDate&sortOrder=desc&limit=10"

# 查询单条新闻
curl "http://localhost:3000/api/v1/admin/news/1"

# 更新新闻
curl -X PUT "http://localhost:3000/api/v1/admin/news/1" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "更新后的标题",
    "status": "PUBLISH"
  }'

# 上传新闻
curl -X POST "http://localhost:3000/api/v1/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "科技新闻",
    "isoDate": "2024-05-20T08:00:00Z",
    "link": "https://example.com/news",
    "status": "DRAFT"
  }'
```

前端只需将现有请求指向这些端点即可读取数据库内容。更多细节可参考对应源码：`src/app/api/v1/**`。
