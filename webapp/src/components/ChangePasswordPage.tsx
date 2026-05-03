import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { PageHeader } from '#/components/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { changePassword } from '#/lib/ocrux'
import { useAppStore } from '#/store'
import { KeyRound, AlertCircle } from 'lucide-react'

const schema = z
  .object({
    password: z.string().min(1, 'Current password is required'),
    newpassword: z.string().min(1, 'New password is required'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((values) => values.newpassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  })

type FormValues = z.infer<typeof schema>

export function ChangePasswordPage() {
  const auth = useAppStore((state) => state.auth)
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
      const promise = changePassword(formData)
      toast.promise(promise, {
        loading: 'Updating password...',
        success: 'Password changed successfully.',
        error: 'Password could not be changed.',
      })
      return promise
    },
    onSuccess: () => {
      form.reset()
    },
  })

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PageHeader title="Security" description="Manage your registry access credentials." />
      
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Update Password
            </CardTitle>
            <CardDescription>
              Enter your current password to authorize this security update.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Current Password</Label>
                <Input id="password" type="password" {...form.register('password')} />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="newpassword">New Password</Label>
                <Input id="newpassword" type="password" {...form.register('newpassword')} />
                {form.formState.errors.newpassword && (
                  <p className="text-xs text-destructive">{form.formState.errors.newpassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input id="confirmPassword" type="password" {...form.register('confirmPassword')} />
              </div>

              {form.formState.errors.confirmPassword && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Validation Error</AlertTitle>
                  <AlertDescription>
                    {form.formState.errors.confirmPassword.message}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => form.reset()}>
                  Clear
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
