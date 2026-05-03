import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  createRootRoute,
} from '@tanstack/react-router'
import { useState } from 'react'
import { Toaster } from '#/components/ui/sonner'
import { TooltipProvider } from '#/components/ui/tooltip'

export const Route = createRootRoute({
  component: RootDocument,
})

function RootDocument() {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
        <Toaster position="bottom-right" closeButton richColors />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
