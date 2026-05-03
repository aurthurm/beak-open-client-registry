import { useMutation } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
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
        toast.error('Invalid credentials or inactive account.')
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
      toast.success('Welcome back. The registry has been unlocked.')
      navigate({ to: search.redirect })
    },
    onError: () => {
      toast.error('Login failed. Check your credentials or backend connectivity.')
    },
  })

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </div>
            OpenCR
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <form
              className="flex flex-col gap-6"
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Login to your account</h1>
                <p className="text-balance text-sm text-muted-foreground">
                  Enter your email below to login to your account
                </p>
              </div>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="m@example.com"
                    required
                    {...form.register('username')}
                  />
                  {form.formState.errors.username ? (
                    <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    {...form.register('password')}
                  />
                  {form.formState.errors.password ? (
                    <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Signing in...' : 'Login'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <img
          src="https://images.unsplash.com/photo-1551288049-bbbda536ad0a?q=80&w=2070&auto=format&fit=crop"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}
