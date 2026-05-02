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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { addUser } from '#/lib/ocrux'
import { useAppStore } from '#/store'

const schema = z
  .object({
    firstName: z.string().min(1),
    otherName: z.string().optional(),
    surname: z.string().min(1),
    userName: z.string().min(1),
    role: z.enum(['admin', 'deduplication']),
    password: z.string().min(1),
    confirmPassword: z.string().min(1),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  })

type FormValues = z.infer<typeof schema>

export function AddUserPage() {
  const setAlert = useAppStore((state) => state.setAlert)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      otherName: '',
      surname: '',
      userName: '',
      role: 'admin',
      password: '',
      confirmPassword: '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const formData = new FormData()
      formData.append('firstName', values.firstName)
      formData.append('otherName', values.otherName || '')
      formData.append('surname', values.surname)
      formData.append('userName', values.userName)
      formData.append('role', values.role)
      formData.append('password', values.password)
      return addUser(formData)
    },
    onSuccess: () => {
      setAlert({ show: true, type: 'success', message: 'User added successfully.' })
      form.reset()
    },
    onError: () => {
      setAlert({ show: true, type: 'error', message: 'User could not be added.' })
    },
  })

  return (
    <section className="grid gap-4">
      <PageHeader eyebrow="Users" title="Add User" description="Create registry accounts without leaving the app." />
      <Card className="mx-auto w-full max-w-2xl border-white/10 bg-white/5 text-white">
        <CardContent className="grid gap-4 p-6">
          <div className="grid gap-2">
            <Label htmlFor="firstName">Given names</Label>
            <Input id="firstName" className="border-white/10 bg-slate-950/60 text-white" {...form.register('firstName')} />
            {form.formState.errors.firstName ? <p className="text-sm text-rose-300">Given names are required</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="otherName">Middle names</Label>
            <Input id="otherName" className="border-white/10 bg-slate-950/60 text-white" {...form.register('otherName')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="surname">Surname</Label>
            <Input id="surname" className="border-white/10 bg-slate-950/60 text-white" {...form.register('surname')} />
            {form.formState.errors.surname ? <p className="text-sm text-rose-300">Surname is required</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="userName">Username</Label>
            <Input id="userName" className="border-white/10 bg-slate-950/60 text-white" {...form.register('userName')} />
            {form.formState.errors.userName ? <p className="text-sm text-rose-300">Username is required</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={form.watch('role')} onValueChange={(value) => form.setValue('role', value as FormValues['role'])}>
              <SelectTrigger className="border-white/10 bg-slate-950/60 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="deduplication">Deduplication</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" className="border-white/10 bg-slate-950/60 text-white" {...form.register('password')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
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
              Add user
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
