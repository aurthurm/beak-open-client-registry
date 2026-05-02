import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { PageHeader } from '#/components/PageHeader'
import { Alert } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { changePassword } from '#/lib/ocrux'
import { useAppStore } from '#/store'

const schema = z
  .object({
    password: z.string().min(1),
    newpassword: z.string().min(1),
    confirmPassword: z.string().min(1),
  })
  .refine((values) => values.newpassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  })

type FormValues = z.infer<typeof schema>

export function ChangePasswordPage() {
  const auth = useAppStore((state) => state.auth)
  const setAlert = useAppStore((state) => state.setAlert)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: '',
      newpassword: '',
      confirmPassword: '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const formData = new FormData()
      formData.append('password', values.password)
      formData.append('username', auth.username)
      formData.append('newpassword', values.newpassword)
      return changePassword(formData)
    },
    onSuccess: () => {
      setAlert({ show: true, type: 'success', message: 'Password changed successfully.' })
      form.reset()
    },
    onError: () => {
      setAlert({ show: true, type: 'error', message: 'Password could not be changed.' })
    },
  })

  return (
    <section className="grid gap-4">
      <PageHeader eyebrow="Account" title="Change Password" description="Update your current Open Client Registry password." />
      <Card className="mx-auto w-full max-w-xl border-white/10 bg-white/5 text-white">
        <CardContent className="grid gap-4 p-6">
          <div className="grid gap-2">
            <Label htmlFor="password">Current password</Label>
            <Input id="password" type="password" className="border-white/10 bg-slate-950/60 text-white" {...form.register('password')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newpassword">New password</Label>
            <Input id="newpassword" type="password" className="border-white/10 bg-slate-950/60 text-white" {...form.register('newpassword')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" type="password" className="border-white/10 bg-slate-950/60 text-white" {...form.register('confirmPassword')} />
            {form.formState.errors.confirmPassword ? (
              <Alert className="border-white/10 bg-white/5 text-slate-200">{form.formState.errors.confirmPassword.message}</Alert>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => form.reset()}>
              Clear
            </Button>
            <Button type="button" onClick={form.handleSubmit((values) => mutation.mutate(values))} disabled={mutation.isPending}>
              Change password
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
