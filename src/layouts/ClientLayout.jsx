import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard, Map, Video, BookOpen, ClipboardList, CheckCircle2,
  FileText, LogOut, Menu, X, Zap, Home, MessageCircle, Phone
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Desktop sidebar nav items (full set)
const sidebarItems = [
  { to: '/client', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/client/blueprint', icon: Map, label: 'Blueprint' },
  { to: '/client/calls', icon: Video, label: 'Sessions' },
  { to: '/client/checkin', icon: CheckCircle2, label: 'Check-In' },
  { to: '/client/notes', icon: FileText, label: 'Notes' },
  { to: '/client/intake', icon: ClipboardList, label: 'Intake' },
  { to: '/client/resources', icon: BookOpen, label: 'Resources' },
]

// Mobile bottom tab items (4 main tabs like X/Facebook)
const mobileTabItems = [
  { to: '/client', icon: Home, label: 'Home', end: true },
  { to: '/client/checkin', icon: CheckCircle2, label: 'Check In' },
  { to: '/client/notes', icon: FileText, label: 'Notes' },
  { to: '/client/calls', icon: Phone, label: 'Contact' },
]

export function ClientLayout() {
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Check if current path matches a nav item
  const isActive = (to, end) => {
    if (end) return location.pathname === to
    return location.pathname.startsWith(to)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== DESKTOP SIDEBAR (hidden on mobile) ===== */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-64 bg-navy text-white flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold flex items-center justify-center">
              <Zap className="w-6 h-6 text-navy-dark" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">IEB 1:1</h1>
              <p className="text-xs text-gray-400">Launch Coach</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-gold text-navy-dark" : "text-gray-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-sm font-bold">
              {profile?.full_name?.[0] || 'C'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || 'Client'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ===== MOBILE TOP HEADER (visible on mobile only) ===== */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-navy text-white px-4 py-3 flex items-center justify-between safe-top">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
            <Zap className="w-5 h-5 text-navy-dark" />
          </div>
          <span className="font-bold text-base">IEB 1:1</span>
        </div>

        <div className="flex items-center gap-3">
          {/* More menu for secondary pages */}
          <div className="relative">
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {moreMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                  <NavLink
                    to="/client/blueprint"
                    onClick={() => setMoreMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                      isActive ? "bg-gold/10 text-navy font-semibold" : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <Map className="w-4 h-4" /> Blueprint
                  </NavLink>
                  <NavLink
                    to="/client/intake"
                    onClick={() => setMoreMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                      isActive ? "bg-gold/10 text-navy font-semibold" : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <ClipboardList className="w-4 h-4" /> Intake Form
                  </NavLink>
                  <NavLink
                    to="/client/resources"
                    onClick={() => setMoreMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                      isActive ? "bg-gold/10 text-navy font-semibold" : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <BookOpen className="w-4 h-4" /> Resources
                  </NavLink>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { setMoreMenuOpen(false); handleSignOut() }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className={cn(
        "lg:ml-64",
        // Mobile: add top padding for fixed header, bottom padding for fixed nav bar
        "pt-[60px] pb-[80px]",
        // Desktop: no extra top/bottom padding needed
        "lg:pt-0 lg:pb-0",
      )}>
        <div className="p-4 lg:p-8 min-h-screen">
          <Outlet />
        </div>
      </main>

      {/* ===== MOBILE BOTTOM NAV BAR (visible on mobile only) ===== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileTabItems.map(item => {
            const active = isActive(item.to, item.end)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 min-w-0"
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                  active ? "bg-gold/15" : ""
                )}>
                  <item.icon
                    className={cn(
                      "w-5 h-5 transition-colors",
                      active ? "text-gold-dark" : "text-gray-400"
                    )}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                </div>
                <span className={cn(
                  "text-[10px] leading-tight font-medium transition-colors",
                  active ? "text-gold-dark" : "text-gray-400"
                )}>
                  {item.label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
