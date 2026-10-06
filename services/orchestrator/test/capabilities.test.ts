import { describe, expect, it } from 'vitest';
import { capabilityOwners, ownerFor } from '../src/capabilities.js';

describe('capability ownership', () => {
  it('routes standard clinical capabilities to Medplum', () => {
    expect(ownerFor('patient')).toBe('medplum');
    expect(ownerFor('observation')).toBe('medplum');
    expect(ownerFor('audit')).toBe('medplum');
  });

  it('routes EAI-only computation to Python', () => {
    expect(ownerFor('ai-triage')).toBe('python');
    expect(ownerFor('rag')).toBe('python');
  });

  it('keeps all owners explicit', () => {
    expect(Object.keys(capabilityOwners).length).toBeGreaterThan(10);
    expect(Object.values(capabilityOwners).every((owner) => owner === 'medplum' || owner === 'python')).toBe(true);
  });
});

