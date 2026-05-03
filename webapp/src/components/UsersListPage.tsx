import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { PageHeader } from '#/components/PageHeader'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { editUser, fetchUsers } from '#/lib/ocrux'
import type { UserRow } from '#/lib/types'
import { useAppStore } from '#/store'
import { UserCog } from 'lucide-react'

const roles = [
  { label: 'Admin', value: 'admin' },
  { label: 'Deduplication', value: 'deduplication' },
]

const statuses = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
]

export function UsersListPage() {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [firstName, setFirstName] = useState('')
  const [otherName, setOtherName] = useState('')
  const [surname, setSurname] = useState('')
  const [role, setRole] = useState('admin')
  const [status, setStatus] = useState('active')

  const query = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  const rows = useMemo(() => {
    const data = Array.isArray(query.data) ? query.data : []
    if (!search) return data
    const term = search.toLowerCase()
    return data.filter((row) =>
      [row.firstName, row.otherName, row.surname, row.userName, row.role, row.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    )
  }, [query.data, search])

  function openEditor(user: UserRow) {
    setEditing(user)
    setFirstName(user.firstName)
    setOtherName(user.otherName || '')
    setSurname(user.surname)
    setRole(user.role)
    setStatus(user.status)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!editing) return
      const formData = new FormData()
      formData.append('id', editing.id)
      formData.append('firstName', firstName)
      formData.append('otherName', otherName)
      formData.append('surname', surname)
      formData.append('role', role)
      formData.append('status', status)
      const promise = editUser(formData)
      toast.promise(promise, {
        loading: 'Updating user profile...',
        success: 'User updated successfully.',
        error: 'User could not be updated.',
      })
      return promise
    },
    onSuccess: () => {
      setEditing(null)
      query.refetch()
    },
  })

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PageHeader
        title="User Accounts"
        description="Search and edit registry accounts."
        actions={(
          <Input 
            value={search} 
            onChange={(event) => setSearch(event.target.value)} 
            placeholder="Search users..." 
            className="w-[200px] lg:w-[300px]" 
          />
        )}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Names</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.firstName} {row.otherName} {row.surname}
                </TableCell>
                <TableCell className="font-mono text-xs">{row.userName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{row.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEditor(row)}>
                    <UserCog className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {query.isLoading ? 'Loading users...' : 'No users found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Update information for <span className="font-semibold">{editing?.userName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="editFirstName">First Name</Label>
                <Input id="editFirstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editSurname">Surname</Label>
                <Input id="editSurname" value={surname} onChange={(event) => setSurname(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editOtherName">Other Names</Label>
              <Input id="editOtherName" value={otherName} onChange={(event) => setOtherName(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
