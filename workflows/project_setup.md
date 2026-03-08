# Workflow: Project Setup

## Objective
Initialize a new medical device compliance project with device metadata and regulatory profile.

## Prerequisites
- Compliance platform is running (`npm run dev`)
- PostgreSQL and Ollama are running (`docker compose up`)
- Mistral 7B and nomic-embed-text models are pulled in Ollama

## Inputs
- Device name and description
- Device category (assistive_wearable for MVP)
- Jurisdiction (fda_us for MVP)
- Intended use statement
- Device class (I, II, or III)
- Manufacturer name (if applicable)

## Steps

1. **Navigate** to http://localhost:3000/projects/new
2. **Fill in** Project Name, Device Category (Assistive/Wearable Robotics), Jurisdiction (FDA/US)
3. **Fill in** Device information: name, intended use, device class
4. **Submit** — project is created with regulatory profile `fda_assistive_wearable`
5. **Verify** project appears in dashboard

API alternative:
```
POST /api/projects
{
  "name": "MyExo 510(k) Submission",
  "deviceCategory": "assistive_wearable",
  "jurisdiction": "fda_us",
  "device": {
    "name": "MyExo Powered Lower-Limb Exoskeleton",
    "intendedUse": "To facilitate rehabilitation of patients with lower limb weakness",
    "deviceClass": "II",
    "manufacturerName": "MyRobotics Inc."
  }
}
```

## Outputs
- `projects` record created
- `devices` record created
- Project workspace available at `/projects/:id`

## Edge Cases
- If jurisdiction is CE/EU: not supported in MVP. Create as FDA project, expand later.
- If device class is uncertain: default to II (most wearable robotics) and update after regulatory review.

## Verification
- GET /api/projects returns the new project
- GET /api/projects/:id returns project + device details
