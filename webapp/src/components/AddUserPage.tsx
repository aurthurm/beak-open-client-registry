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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Separator } from '#/components/ui/separator'
import { addUser } from '#/lib/ocrux'
import { UserPlus, AlertCircle } from 'lucide-react'

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    otherName: z.string().optional(),
    surname: z.string().min(1, 'Surname is required'),
    userName: z.string().min(1, 'Username is required'),
    role: z.enum(['admin', 'deduplication']),
    password: z.string().min(1, 'Password is required'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  })

type FormValues = z.infer<typeof schema>

export function AddUserPage() {
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
      const promise = addUser(formData)
      toast.promise(promise, {
        loading: 'Creating user account...',
        success: 'User added successfully.',
        error: 'User could not be added.',
      })
      return promise
    },
    onSuccess: () => {
      form.reset()
    },
  })

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PageHeader title="Add User" description="Create registry accounts without leaving the app." />
      
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              New User Details
            </CardTitle>
            <CardDescription>
              Provide the information below to create a new registry administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" {...form.register('firstName')} />
                  {form.formState.errors.firstName && (
                    <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surname">Surname</Label>
                  <Input id="surname" {...form.register('surname')} />
                  {form.formState.errors.surname && (
                    <p className="text-xs text-destructive">{form.formState.errors.surname.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otherName">Middle/Other Names</Label>
                <Input id="otherName" {...form.register('otherName')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userName">Username</Label>
                  <Input id="userName" {...form.register('userName')} />
                  {form.formState.errors.userName && (
                    <p className="text-xs text-destructive">{form.formState.errors.userName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Account Role</Label>
                  <Select 
                    value={form.watch('role')} 
                    onValueChange={(value) => form.setValue('role', value as FormValues['role'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="deduplication">Deduplication Specialist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" {...form.register('password')} />
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" {...form.register('confirmPassword')} />
                </div>
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
                  Reset
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  Create Account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
