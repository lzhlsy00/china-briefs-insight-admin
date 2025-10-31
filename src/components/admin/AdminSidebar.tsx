'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function AdminSidebar() {
  const pathname = usePathname()
  const [activeMenu, setActiveMenu] = useState('news')
  const { logout } = useAuth()

  // 根据当前路径设置活动菜单
  useEffect(() => {
    if (pathname === '/admin/users') {
      setActiveMenu('users')
    } else if (pathname === '/admin/send-email') {
      setActiveMenu('send-email')
    } else if (pathname === '/admin') {
      setActiveMenu('news')
    } else {
      setActiveMenu('')
    }
  }, [pathname])

  const menuItems = [
    {
      id: 'news',
      name: 'News',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      ),
      href: '/admin'
    },
    {
      id: 'users',
      name: 'Users',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      href: '/admin/users'
    },
    {
      id: 'send-email',
      name: 'Send Email',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      href: '/admin/send-email'
    }
  ]

  return (
    <aside className="w-64 bg-black h-screen flex flex-col fixed left-0 top-0">
      {/* 顶部Logo */}
      <div className="p-6 border-b border-gray-800">
        <Link href="/admin" className="block">
          <div className="text-2xl font-bold text-white">FortuneNews</div>
        </Link>
      </div>

      {/* 菜单区域 */}
      <div className="flex-1 p-6">
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setActiveMenu(item.id)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                activeMenu === item.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>
      
      {/* 底部退出登录 */}
      <div className="p-6 border-t border-gray-800">
        <button
          onClick={() => {
            if (confirm('Are you sure you want to logout?')) {
              logout()
            }
          }}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  )
}
