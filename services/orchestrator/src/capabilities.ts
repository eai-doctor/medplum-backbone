export type CapabilityOwner = 'medplum' | 'python';

export const capabilityOwners = {
  patient: 'medplum',
  practitioner: 'medplum',
  encounter: 'medplum',
  observation: 'medplum',
  condition: 'medplum',
  medication: 'medplum',
  appointment: 'medplum',
  authentication: 'medplum',
  authorization: 'medplum',
  audit: 'medplum',
  history: 'medplum',
  'ai-triage': 'python',
  rag: 'python',
  pubmed: 'python',
  'document-intelligence': 'python',
  transcription: 'python',
} as const satisfies Record<string, CapabilityOwner>;

export type Capability = keyof typeof capabilityOwners;

export function ownerFor(capability: Capability): CapabilityOwner {
  return capabilityOwners[capability];
}

