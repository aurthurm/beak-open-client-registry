import * as fhirpath from 'fhirpath'

import { apiFetch, getJson, postForm, postJson } from '#/lib/api'
import { getServerBackendOrigin } from '#/lib/ports'
import type {
  AuditRow,
  ClientEntry,
  CsvUpload,
  DisplayConfig,
  DisplayField,
  FhirBundle,
  FhirExtension,
  FhirPatient,
  MatchRow,
  PatientListRow,
  PotentialRow,
  UserRow,
} from '#/lib/types'

const OPENCR_REPORT_DISPLAY = 'http://ihris.org/fhir/StructureDefinition/opencrReportDisplay'
const DISPLAY_ENTRY = 'http://ihris.org/fhir/StructureDefinition/display'
export const BROKEN_MATCH_URL = 'http://clientregistry.org/brokenMatch'

function getExtensionValue(extension: FhirExtension[] | undefined, url: string) {
  return extension?.find((item) => item.url === url)
}

function extensionString(extension: FhirExtension | undefined) {
  return extension?.valueString || extension?.valueDate || ''
}

function evaluatePath(resource: FhirPatient, expression: string) {
  const value = fhirpath.evaluate(resource, expression)
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry && typeof entry === 'object' && 'reference' in entry && entry.reference) {
          return String(entry.reference).split('/').pop()
        }
        if (entry === null || entry === undefined) {
          return ''
        }
        return String(entry)
      })
      .filter(Boolean)
      .join(', ')
  }

  if (value && typeof value === 'object' && 'reference' in value && value.reference) {
    return String(value.reference).split('/').pop() || ''
  }

  return value === null || value === undefined ? '' : String(value)
}

function getOfficialName(resource: FhirPatient) {
  const official = resource.name?.find((item) => item.use === 'official') || resource.name?.[0]
  const given = official?.given?.join(' ') || ''
  return {
    family: official?.family || '',
    given,
  }
}

function getSourceSystem(resource: FhirPatient) {
  const tag = resource.meta?.tag?.find((entry) => entry.system === 'http://openclientregistry.org/fhir/clientid')
  return tag?.code || ''
}

function getSourceName(resource: FhirPatient, clients: ClientEntry[]) {
  const sourceId = getSourceSystem(resource)
  return clients.find((client) => client.id === sourceId)?.displayName || sourceId
}

export function extractDisplayConfig(basic: unknown): DisplayConfig {
  const fields: DisplayField[] = []
  const top = basic as { extension?: FhirExtension[] }
  const report = getExtensionValue(top.extension, OPENCR_REPORT_DISPLAY)
  const displayGroup = report?.extension?.filter((item) => item.url === DISPLAY_ENTRY) || []

  for (const display of displayGroup) {
    const label = extensionString(getExtensionValue(display.extension, 'label'))
    const fhirpathValue = extensionString(getExtensionValue(display.extension, 'fhirpath'))
    const valueset = extensionString(getExtensionValue(display.extension, 'valueset'))
    const searchable = extensionString(getExtensionValue(display.extension, 'searchable'))
    const searchparameter = extensionString(getExtensionValue(display.extension, 'searchparameter'))

    if (!label || !fhirpathValue) {
      continue
    }

    fields.push({
      label,
      fhirpath: fhirpathValue,
      searchable: searchable === 'true',
      searchparameter: searchparameter || undefined,
      valueset: valueset || undefined,
    })
  }

  return { fields }
}

export function patientToListRow(
  resource: FhirPatient,
  displayConfig: DisplayConfig,
  clients: ClientEntry[],
): PatientListRow {
  const row: PatientListRow = {
    id: resource.id || '',
    pos: getSourceName(resource, clients),
  }

  for (const field of displayConfig.fields) {
    if (!field.label || !field.fhirpath) {
      continue
    }
    row[field.label] = evaluatePath(resource, field.fhirpath)
  }

  return row
}

export async function fetchDisplayConfig() {
  const response = await getJson<FhirBundle<FhirPatient> | FhirPatient>('/ocrux/fhir/Basic/patientdisplaypage')
  const basic = Array.isArray((response as FhirBundle).entry) ? (response as FhirBundle).entry?.[0]?.resource : (response as FhirPatient)
  return extractDisplayConfig(basic || {})
}

export async function fetchPatients(queryOrPath = '') {
  if (!queryOrPath) {
    return getJson<FhirBundle<FhirPatient>>('/ocrux/fhir/Patient')
  }

  if (queryOrPath.startsWith('http://') || queryOrPath.startsWith('https://')) {
    const parsed = new URL(queryOrPath)
    const pathname = parsed.pathname.startsWith('/fhir')
      ? parsed.pathname.replace(/^\/fhir/, '/ocrux/fhir')
      : parsed.pathname
    return getJson<FhirBundle<FhirPatient>>(`${pathname}${parsed.search}`)
  }

  if (queryOrPath.startsWith('/ocrux/fhir') || queryOrPath.startsWith('/fhir')) {
    const normalized = queryOrPath.startsWith('/fhir')
      ? queryOrPath.replace(/^\/fhir/, '/ocrux/fhir')
      : queryOrPath
    return getJson<FhirBundle<FhirPatient>>(normalized)
  }

  if (queryOrPath.startsWith('?')) {
    return getJson<FhirBundle<FhirPatient>>(`/ocrux/fhir/Patient${queryOrPath}`)
  }

  return getJson<FhirBundle<FhirPatient>>(`/ocrux/fhir/Patient?${queryOrPath}`)
}

export async function fetchPatient(id: string) {
  return getJson<FhirBundle<FhirPatient>>(`/ocrux/fhir/Patient?_include=Patient:link&_id=${encodeURIComponent(id)}`)
}

export async function fetchPatientById(id: string) {
  return getJson<FhirBundle<FhirPatient>>(`/ocrux/fhir/Patient?_elements=link,extension&_id=${encodeURIComponent(id)}`)
}

export async function fetchAuditEvents(entityId: string) {
  return getJson<FhirBundle<Record<string, unknown>>>(
    `/ocrux/fhir/AuditEvent?entity=${encodeURIComponent(entityId)}&entity-name=submittedResource,breakTo,breakFrom,unBreak,unBreakFromResource&_sort=-_lastUpdated`,
  )
}

export async function fetchMatchIssues() {
  return getJson<MatchRow[]>('/ocrux/match/get-match-issues')
}

export async function fetchAutoMatches() {
  return getJson<MatchRow[]>('/ocrux/match/get-new-auto-matches')
}

export async function fetchPotentialMatches(id: string) {
  return getJson<PotentialRow[]>(`/ocrux/match/potential-matches/${encodeURIComponent(id)}`)
}

export async function fetchClients() {
  return getJson<ClientEntry[]>('/ocrux/config/getClients')
}

export async function fetchSystemURI() {
  return getJson<Record<string, { displayName: string; uri: string | string[] }>>('/ocrux/config/getURI')
}

export async function fetchCounts() {
  const [totalMatchIssues, totalAutoMatches] = await Promise.all([
    getJson<number>('/ocrux/match/count-match-issues'),
    getJson<number>('/ocrux/match/count-new-auto-matches'),
  ])

  return { totalMatchIssues, totalAutoMatches }
}

export async function fetchCSVUploads() {
  return getJson<CsvUpload[]>('/ocrux/csv/getCSVUpload')
}

export async function fetchCSVReport(id: string) {
  return apiFetch(`/ocrux/csv/getCSVReport/${encodeURIComponent(id)}`) as Promise<string>
}

export function backendPublicUrl(path: string) {
  if (typeof window === 'undefined') {
    return `${getServerBackendOrigin()}${path}`
  }

  return path
}

export async function fetchUsers() {
  return getJson<UserRow[]>('/ocrux/user/getUsers/')
}

export async function authenticate(username: string, password: string) {
  return postJson<{ token: string | null; userID: string | null; username: string; role: string | null }>(
    `/ocrux/user/authenticate?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  )
}

export async function addUser(formData: FormData) {
  return postForm('/ocrux/user/addUser/', formData)
}

export async function editUser(formData: FormData) {
  return postForm('/ocrux/user/editUser/', formData)
}

export async function changePassword(formData: FormData) {
  return postForm('/ocrux/user/changepassword/', formData)
}

export async function breakMatch(ids: string[], username: string) {
  return postJson(`/ocrux/match/break-match?username=${encodeURIComponent(username)}`, ids)
}

export async function unbreakMatch(ids: Array<{ id1: string; id2: string }>, username: string) {
  return postJson(`/ocrux/match/unbreak-match?username=${encodeURIComponent(username)}`, ids)
}

export async function resolveMatchIssue(body: {
  resolves: PotentialRow[]
  resolvingFrom: string
  removeFlag: boolean
  flagType?: string
}) {
  return postJson('/ocrux/match/resolve-match-issue', body)
}

export function flattenPatientRows(
  bundle: FhirBundle<FhirPatient>,
  displayConfig: DisplayConfig,
  clients: ClientEntry[],
) {
  return (bundle.entry || [])
    .map((entry) => entry.resource)
    .filter((resource): resource is FhirPatient => Boolean(resource && resource.resourceType === 'Patient' && resource.id))
    .map((resource) => patientToListRow(resource, displayConfig, clients))
}

export function rowName(row: MatchRow) {
  return `${row.family || ''} ${row.given || ''}`.trim()
}

export function getLinkedPatientId(resource: FhirPatient) {
  return resource.link?.[0]?.other?.reference?.split('/').pop() || ''
}

export function getOfficialPatientName(resource: FhirPatient) {
  return getOfficialName(resource)
}
