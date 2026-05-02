export type AlertState = {
  show: boolean
  type: 'success' | 'error'
  message: string
}

export type ProgressState = {
  show: boolean
  title: string
}

export type AuthState = {
  token: string
  username: string
  userID: string
  role: string
}

export type ClientEntry = {
  id: string
  displayName: string
}

export type Session = AuthState | null

export type CsvUpload = {
  uuid: string
  reportId: string
  name: string
  date: string
}

export type PatientListRow = Record<string, unknown> & {
  id: string
  pos?: string
  link?: Array<{ other?: { reference?: string } }>
}

export type DisplayField = {
  label?: string
  fhirpath?: string
  searchable?: boolean
  searchparameter?: string
  valueset?: string
}

export type DisplayConfig = {
  fields: DisplayField[]
}

export type FhirReference = {
  reference?: string
}

export type FhirName = {
  use?: string
  given?: string[]
  family?: string
}

export type FhirIdentifier = {
  system?: string
  value?: string
}

export type FhirTelecom = {
  system?: string
  value?: string
}

export type FhirExtension = {
  url?: string
  valueString?: string
  valueDate?: string
  valueReference?: FhirReference
  extension?: FhirExtension[]
}

export type FhirMeta = {
  tag?: Array<{
    system?: string
    code?: string
    display?: string
  }>
}

export type FhirPatient = {
  resourceType?: 'Patient'
  id?: string
  link?: Array<{
    other?: FhirReference
    type?: string
  }>
  meta?: FhirMeta
  name?: FhirName[]
  gender?: string
  birthDate?: string
  telecom?: FhirTelecom[]
  identifier?: FhirIdentifier[]
  extension?: FhirExtension[]
  [key: string]: unknown
}

export type FhirBundle<T = unknown> = {
  resourceType?: 'Bundle'
  type?: string
  total?: number
  entry?: Array<{
    fullUrl?: string
    resource: T
    response?: {
      status?: string
      etag?: string
      location?: string
    }
  }>
  link?: Array<{
    relation?: string
    url?: string
  }>
}

export type MatchRow = {
  id: string
  uid: string
  ouid?: string
  source: string
  source_id: string
  family: string
  given: string
  gender: string
  birthdate: string
  reason?: string
  reasonCode?: string
  date?: string
}

export type PotentialRow = MatchRow & {
  scores?: Record<string, number>
  [key: string]: unknown
}

export type AuditRow = {
  type: 'submittedResource' | 'breakMatch' | 'unBreak'
  recorded: string
  operation?: string
  outcome?: string
  outcomeCode?: string
  outcomeDesc?: string
  username?: string
  ipaddress?: string
  break?: string
  breakFrom?: string[]
  CRUID?: string
  unBreak?: string
  unBreakFrom?: string[]
  unBreakFromCRUID?: string
  submittedResource?: string
  submittedResourceData?: string
  matchData?: Array<{
    matchingType?: string
    decisionRule?: Array<{
      name?: string
      id?: string
      details?: Record<string, unknown>
    }>
    query?: string
    autoMatches?: string
    potentialMatches?: string
    conflictsMatchResults?: string
  }>
}

export type UserRow = {
  id: string
  firstName: string
  otherName?: string
  surname: string
  userName: string
  role: string
  status: string
}
