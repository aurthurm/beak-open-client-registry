import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { PageHeader } from '#/components/PageHeader'
import { Alert } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { editUser, fetchUsers } from '#/lib/ocrux'
import type { UserRow } from '#/lib/types'
import { useAppStore } from '#/store'

const roles = [
  { label: 'Admin', value: 'admin' },
  { label: 'Deduplication', value: 'deduplication' },
]

const statuses = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
]

export function UsersListPage() {
  const setAlert = useAppStore((state) => state.setAlert)
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
    const data = query.data || []
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
      return editUser(formData)
    },
    onSuccess: () => {
      setAlert({ show: true, type: 'success', message: 'User updated successfully.' })
      setEditing(null)
      query.refetch()
    },
    onError: () => {
      setAlert({ show: true, type: 'error', message: 'User could not be updated.' })
    },
  })

  return (
    <section className="grid gap-4">
      <PageHeader
        eyebrow="Users"
        title="User Accounts"
        description="Search and edit registry accounts."
        actions={(
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" className="w-full max-w-sm border-white/10 bg-slate-950/60 text-white" />
        )}
      />

      <Card className="border-white/10 bg-white/5 text-white">
        <CardContent className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-300">
              <tr>
                <th className="px-4 py-3">Given names</th>
                <th className="px-4 py-3">Surname</th>
                <th className="px-4 py-3">Other</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="px-4 py-3">{row.firstName}</td>
                  <td className="px-4 py-3">{row.surname}</td>
                  <td className="px-4 py-3">{row.otherName || '—'}</td>
                  <td className="px-4 py-3">{row.userName}</td>
                  <td className="px-4 py-3">{row.role}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3">
                    <Button type="button" size="sm" onClick={() => openEditor(row)}>Edit</Button>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={7}>
                    {query.isLoading ? 'Loading users...' : 'No users found.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Edit {editing?.userName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="editFirstName">Given names</Label>
              <Input id="editFirstName" className="border-white/10 bg-slate-900 text-white" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editOtherName">Other names</Label>
              <Input id="editOtherName" className="border-white/10 bg-slate-900 text-white" value={otherName} onChange={(event) => setOtherName(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editSurname">Surname</Label>
              <Input id="editSurname" className="border-white/10 bg-slate-900 text-white" value={surname} onChange={(event) => setSurname(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="border-white/10 bg-slate-900 text-white">
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
                <SelectTrigger className="border-white/10 bg-slate-900 text-white">
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
          <DialogFooter>
            <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
