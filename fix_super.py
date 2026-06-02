import sys
path = r"D:\00_MildMate\Re-Build_Web\public\admin\sandbox\admin.html"
with open(path, encoding="utf-8") as f:
    c = f.read()

# Remove "Super Admin Only" section and its items
lines = c.split("\n")
out = []
skip_until = None
for i, l in enumerate(lines):
    stripped = l.strip()
    # Skip "Super Admin Only" section and its child items
    if stripped == '<div class="sidebar-section">Super Admin Only</div>':
        skip_until = i + 6  # skip this + next 5 lines
        continue
    if skip_until is not None and i < skip_until:
        continue
    # Fix toolbar badge: SUPER ADMIN -> ADMIN
    if 'role-badge super' in l and 'SUPER ADMIN' in l:
        l = l.replace("SUPER ADMIN", "ADMIN")
    out.append(l)
    if skip_until is not None and i >= skip_until:
        skip_until = None

with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("done")
