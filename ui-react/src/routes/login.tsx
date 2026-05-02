import { useMutation } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authenticate } from '#/lib/ocrux'
import { saveSession } from '#/lib/auth'
import { getSession, sanitizeRedirect } from '#/lib/session'
import { useAppStore } from '#/store'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  beforeLoad: async ({ search }) => {
    const session = await getSession()
    if (session?.token) {
      throw redirect({ to: search.redirect })
    }
  },
  component: LoginRoute,
})

function LoginRoute() {
  const navigate = useNavigate()
  const setAuth = useAppStore((state) => state.setAuth)
  const setAlert = useAppStore((state) => state.setAlert)
  const search = Route.useSearch()

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof loginSchema>) => {
      return authenticate(values.username, values.password)
    },
    onSuccess: (data, values) => {
      if (!data.token || !data.userID) {
        setAlert({
          show: true,
          type: 'error',
          message: 'Invalid credentials or inactive account.',
        })
        return
      }

      const auth = {
        token: data.token,
        userID: data.userID,
        username: values.username,
        role: data.role || '',
      }

      saveSession(auth)
      setAuth(auth)
      setAlert({
        show: true,
        type: 'success',
        message: 'Welcome back. The registry has been unlocked.',
      })
      navigate({ to: search.redirect })
    },
    onError: () => {
      setAlert({
        show: true,
        type: 'error',
        message: 'Login failed. Check your credentials or backend connectivity.',
      })
    },
  })

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(15,118,110,0.2),_transparent_28%),linear-gradient(180deg,#071114_0%,#09171b_60%,#050b0d_100%)]" />
      <Card className="relative w-full max-w-lg border-white/10 bg-white/5 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <CardHeader className="space-y-3">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            <ShieldCheck className="size-7" />
          </div>
          <CardTitle className="font-display text-4xl">Open Client Registry</CardTitle>
          <CardDescription className="text-slate-300">
            Sign in to review matches, resolve conflicts, and manage registry users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-5"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <div className="grid gap-2">
              <Label htmlFor="username" className="text-slate-200">
                Username
              </Label>
              <Input
                id="username"
                autoComplete="username"
                className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
                {...form.register('username')}
              />
              {form.formState.errors.username ? (
                <p className="text-sm text-rose-300">{form.formState.errors.username.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-slate-200">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <p className="text-sm text-rose-300">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
            <Button
              type="submit"
              size="lg"
              className="mt-2 bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950 hover:opacity-95"
              disabled={mutation.isPending}
            >
              <LockKeyhole className="mr-2 size-4" />
              {mutation.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
