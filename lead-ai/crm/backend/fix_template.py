with open('main.py', 'r') as f:
    content = f.read()

# Fix the template_data dictionary - replace keyword args with proper strings
fixes = [
    ('description=payload.get("description", "")', '"description": payload.get("description", "")'),
    ('body=body_text', '"body": body_text'),
    ('variables=json.dumps(list(dict.fromkeys(variables)))', '"variables": json.dumps(list(dict.fromkeys(variables)))'),
    ('is_builtin=False', '"is_builtin": False'),
    ('created_by=current_user.get("full_name", "Unknown")', '"created_by": current_user.get("full_name", "Unknown")'),
]

for old, new in fixes:
    content = content.replace(old, new)

# Replace orphaned SQLAlchemy code after template_data dict
import re
pattern = r'(\s+"created_by":\s+current_user\.get\("full_name",\s+"Unknown"\),\s*\n\s*)\}\s*\n\s*db\.add\(t\)\s*\n\s*db\.commit\(\)\s*\n\s*db\.refresh\(t\)\s*\n\s*return \{"id": t\.id, "message": "Template created", "name": t\.name\}'

replacement = r'''\1"is_active": True
    }
    
    # Insert into Supabase
    response = supabase_data.client.table('whatsapp_templates').insert(template_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create template")
    
    created = response.data[0]
    return {"id": created["id"], "message": "Template created", "name": created["name"]}'''

content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)

with open('main.py', 'w') as f:
    f.write(content)

print("✅ Fixed template creation endpoint")
