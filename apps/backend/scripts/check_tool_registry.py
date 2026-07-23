import sys
sys.path.insert(0, '.')
from app.services.tools import TOOL_REGISTRY

print(f"Tool count: {len(TOOL_REGISTRY)}")

new_tools = ['project_memory_store', 'project_memory_recall', 'sop_state_sync']
for t in new_tools:
    status = "OK" if t in TOOL_REGISTRY else "MISSING"
    print(f"  {t}: {status}")

print()
print("All registered tools:")
for i, name in enumerate(sorted(TOOL_REGISTRY.keys())):
    print(f"  {i+1}. {name}")
