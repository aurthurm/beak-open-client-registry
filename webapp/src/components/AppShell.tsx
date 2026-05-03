import { Link, useLocation } from '@tanstack/react-router'
import {
  Activity,
  CalendarClock,
  ClipboardList,
  FileText,
  Layers3,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
} from '#/components/ui/sidebar'
import { Badge } from '#/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Separator } from '#/components/ui/separator'
import { TooltipProvider } from '#/components/ui/tooltip'
import { ScrollArea } from '#/components/ui/scroll-area'
import { useAppStore } from '#/store'
import { ThemeToggle } from './ThemeToggle'

const navItems = [
  { to: '/', label: 'Patients', icon: Layers3 },
  { to: '/review', label: 'Review', icon: ClipboardList, badgeKey: 'totalMatchIssues' as const },
  { to: '/automatch', label: 'Auto Matches', icon: Activity, badgeKey: 'totalAutoMatches' as const },
  { to: '/csvreport', label: 'CSV Reports', icon: FileText },
  { to: '/addUser', label: 'Add User', icon: ShieldCheck, adminOnly: true },
  { to: '/changePassword', label: 'Change Password', icon: CalendarClock, adminOnly: false },
  { to: '/usersList', label: 'Users', icon: Users, adminOnly: true },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { auth, totalMatchIssues, totalAutoMatches } = useAppStore()
  const location = useLocation()

  const filteredNavItems = navItems.filter(({ adminOnly }) => {
    if (adminOnly && auth.role === 'deduplication') {
      return false
    }
    return true
  })

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link to="/" />}
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-foreground">OpenCR</span>
                  <span className="truncate text-xs text-muted-foreground">Registry Service</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="h-full">
            <SidebarGroup>
              <SidebarGroupLabel>Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredNavItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        render={<Link to={item.to} />}
                        isActive={location.pathname === item.to}
                        tooltip={item.label}
                        className="justify-between gap-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <item.icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badgeKey === 'totalMatchIssues' && totalMatchIssues > 0 ? (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-5 min-w-5 px-1 text-[10px] font-semibold tabular-nums group-data-[collapsible=icon]/sidebar-wrapper:hidden"
                          >
                            {totalMatchIssues}
                          </Badge>
                        ) : null}
                        {item.badgeKey === 'totalAutoMatches' && totalAutoMatches > 0 ? (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-5 min-w-5 px-1 text-[10px] font-semibold tabular-nums group-data-[collapsible=icon]/sidebar-wrapper:hidden"
                          >
                            {totalAutoMatches}
                          </Badge>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/70 p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/changePassword" className="flex w-full items-center gap-2" />}
                size="sm"
                className="justify-start gap-2"
              >
                <CalendarClock className="size-4 shrink-0" />
                <span>Account Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/logout" className="flex w-full items-center gap-2" />}
                size="sm"
                className="justify-start gap-2"
              >
                <LogOut className="size-4 shrink-0" />
                <span>Log out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
