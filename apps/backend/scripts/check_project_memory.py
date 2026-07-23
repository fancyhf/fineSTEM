import sys
sys.path.insert(0, '.')
from app.services.zeroclaw_memory import recall_memory, recall_project_profile, recall_stage_history, BRAIN_DB_PATH, ASSISTANT_AGENT_ID
import json

print(f"BRAIN_DB_PATH: {BRAIN_DB_PATH}")
print(f"ASSISTANT_AGENT_ID: {ASSISTANT_AGENT_ID}")
print()

# Search for all finestem project memories
result = recall_memory(query="finestem:project")
print(f"FTS search 'finestem:project' found {result.get('count', 0)} entries:")
for mem in result.get('memories', []):
    key = mem.get('key', 'N/A')
    data = mem.get('data', {})
    preview = json.dumps(data, ensure_ascii=False)[:200]
    print(f"  key: {key}")
    print(f"  data: {preview}")
    print()

# Try to recall the specific project profile from the multi-turn test
# The project ID was created during the WS multi-turn test
# Let's search more broadly
result2 = recall_memory(query="profile")
print(f"\nFTS search 'profile' found {result2.get('count', 0)} entries:")
for mem in result2.get('memories', []):
    key = mem.get('key', 'N/A')
    if 'finestem:project' in key:
        data = mem.get('data', {})
        print(f"  key: {key}")
        print(f"  data: {json.dumps(data, ensure_ascii=False)[:300]}")
        print()
