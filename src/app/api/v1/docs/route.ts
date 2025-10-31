import { NextResponse } from 'next/server';

export const GET = () => {
  return NextResponse.json({
    title: 'Fortune News API 文档',
    version: '2.1.0',
    description: '新闻管理API - 支持第三方上传和后台管理',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/upload',
        description: '第三方上传新闻接口',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          title: 'string (必填) - 新闻标题',
          isoDate: 'string (必填) - ISO8601格式日期',
          link: 'string (必填) - 新闻链接URL',
          content: 'string (可选) - 新闻内容',
          aiWorth: 'boolean (可选) - AI评估价值，默认为null',
          aiReason: 'string (可选) - AI评估原因，默认为null',
          category: 'string (可选) - 新闻分类，默认为null',
          status: 'string (可选) - 新闻状态，只接受DRAFT或PUBLISH，默认为DRAFT',
        },
      },
      {
        method: 'GET',
        path: '/api/v1/admin/news',
        description: '获取新闻列表（后台管理）',
      },
      {
        method: 'GET',
        path: '/api/v1/admin/news/:id',
        description: '获取单个新闻详情（后台管理）',
      },
      {
        method: 'PUT',
        path: '/api/v1/admin/news/:id',
        description: '更新新闻（后台管理）',
      },
      {
        method: 'DELETE',
        path: '/api/v1/admin/news/:id',
        description: '删除新闻（后台管理）',
      },
      {
        method: 'GET',
        path: '/api/v1/admin/stats',
        description: '获取统计信息（后台管理）',
      },
      {
        method: 'GET',
        path: '/api/v1/admin/send-email',
        description: '获取邮件推送记录（后台管理）',
      },
      {
        method: 'GET',
        path: '/api/v1/public/news',
        description: '获取已发布新闻列表（前台）',
      },
      {
        method: 'GET',
        path: '/api/v1/public/news/:id',
        description: '获取已发布新闻详情（前台）',
      },
      {
        method: 'GET',
        path: '/api/v1/public/categories',
        description: '获取已发布新闻的分类列表（前台）',
      },
      {
        method: 'GET',
        path: '/api/v1/public/search',
        description: '搜索已发布新闻（前台）',
      },
      {
        method: 'GET',
        path: '/api/v1/ai/unprocessed',
        description: '获取未处理的新闻（AI处理专用）',
      },
    ],
  });
};
