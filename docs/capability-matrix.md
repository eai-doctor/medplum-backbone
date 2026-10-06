# Capability ownership matrix

| Capability | Primary owner | Adapter role | Initial status |
| --- | --- | --- | --- |
| Patient / Practitioner | Medplum | Shape stable facade response | Patient read implemented |
| Encounter / Observation | Medplum | Validate mappings | Planned |
| Condition / Medication | Medplum | Validate mappings | Planned |
| Appointment / Task | Medplum | Optional UI facade | Planned |
| OAuth / SMART / membership | Medplum | Token handling only | Token client implemented |
| AccessPolicy / audit / history | Medplum | No duplication | Backbone available |
| Binary / DocumentReference | Medplum | Upload workflow | Planned |
| AI triage | Python | Stable HTTP contract | Placeholder implemented |
| RAG / PubMed | Python | Stable HTTP contract | Planned |
| PDF/OCR/transcription | Python | Store result as FHIR | Planned |
| AI summaries | Python compute; Medplum record | Map output to FHIR | Planned |

An upstream outage does not change ownership. In particular, the orchestrator
must not write a second copy of a clinical resource to a legacy store because
Medplum is temporarily unavailable.

