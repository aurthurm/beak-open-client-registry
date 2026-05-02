import { Link } from '@tanstack/react-router'
import {
  Activity,
  CalendarClock,
  ClipboardList,
  FileText,
  Layers3,
  LogOut,
  Moon,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { useAppStore } from '#/store'

import { ThemeToggle } from './ThemeToggle'

const navItems = [
  { to: '/', label: 'Patients', icon: Layers3 },
  { to: '/review', label: 'Review', icon: ClipboardList },
  { to: '/automatch', label: 'Auto Matches', icon: Activity },
  { to: '/csvreport', label: 'CSV Reports', icon: FileText },
  { to: '/addUser', label: 'Add User', icon: ShieldCheck, adminOnly: true },
  { to: '/changePassword', label: 'Change Password', icon: CalendarClock, adminOnly: false },
  { to: '/usersList', label: 'Users', icon: Users, adminOnly: true },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { auth, totalMatchIssues, totalAutoMatches } = useAppStore()

  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_top,_rgba(102,255,219,0.18),_transparent_35%),linear-gradient(180deg,rgba(5,15,17,0.98),rgba(5,15,17,0.72)_50%,transparent)]" />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1700px] items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="grid size-11 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 shadow-[0_0_0_1px_rgba(34,197,94,0.08),0_18px_30px_rgba(0,0,0,0.3)]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="text-[0.68rem] uppercase tracking-[0.28em] text-emerald-300/80">
                Open Client Registry
              </div>
              <div className="font-display text-lg text-white">Registry Control Surface</div>
            </div>
          </Link>

          <div className="ml-auto hidden flex-wrap items-center gap-2 lg:flex">
            <Badge variant="secondary" className="bg-white/5 text-white hover:bg-white/10">
              <CalendarClock className="mr-1 size-3.5" />
              Match issues {totalMatchIssues}
            </Badge>
            <Badge variant="secondary" className="bg-white/5 text-white hover:bg-white/10">
              <Activity className="mr-1 size-3.5" />
              Auto matches {totalAutoMatches}
            </Badge>
          </div>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
              <Moon className="size-4 text-emerald-300" />
              <span>{auth.username || 'Guest'}</span>
            </div>
            <ThemeToggle />
            <Button asChild variant="outline" size="sm" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
              <Link to="/logout">
                <LogOut className="mr-2 size-4" />
                Logout
              </Link>
            </Button>
          </div>
        </div>

        <Separator className="bg-white/10" />

        <nav className="mx-auto flex w-full max-w-[1700px] flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          {navItems.map(({ to, label, icon: Icon, adminOnly }) => {
            if (adminOnly && auth.role === 'deduplication') {
              return null
            }

            return (
              <Button key={to} asChild variant="ghost" size="sm" className="rounded-full text-slate-200 hover:bg-white/10 hover:text-white">
                <Link to={to}>
                  <Icon className="mr-2 size-4" />
                  {label}
                </Link>
              </Button>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
