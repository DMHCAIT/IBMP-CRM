# ═══════════════════════════════════════════════════════════
# ADD THESE SETTINGS TO YOUR Django settings.py
# ═══════════════════════════════════════════════════════════

# ── WhatsApp Cloud API Credentials ──────────────────────────
# Get these from: https://developers.facebook.com → Your App → WhatsApp → API Setup

WHATSAPP_PHONE_NUMBER_ID = "your_phone_number_id"        # e.g. "123456789012345"
WHATSAPP_ACCESS_TOKEN = "your_permanent_access_token"    # System User token (never expires)
WHATSAPP_WEBHOOK_VERIFY_TOKEN = "your_custom_secret"     # Any string you choose — must match Meta dashboard
WHATSAPP_BUSINESS_NUMBER = "919xxxxxxxxx"                # Your business WhatsApp number


# ── Supabase Credentials ─────────────────────────────────────
# Get these from: https://supabase.com → Your Project → Settings → API

SUPABASE_URL = "https://your-project-id.supabase.co"
SUPABASE_SERVICE_KEY = "your-service-role-key"           # Use service key for backend (not anon key)


# ── Required Python Packages ─────────────────────────────────
# Run: pip install requests supabase

INSTALLED_APPS = [
    # ... your existing apps ...
    "whatsapp_integration",                              # Add this
]


# ── Webhook URL for Meta Dashboard ──────────────────────────
# Set this URL in Meta Developer Console → WhatsApp → Configuration → Webhook:
# https://yourcrm.com/api/whatsapp/webhook/
#
# Subscribe to these webhook fields:
# ✅ messages
# ✅ message_deliveries
# ✅ message_reads


# ═══════════════════════════════════════════════════════════
# HOW TO GET YOUR PERMANENT ACCESS TOKEN (Important!)
# ═══════════════════════════════════════════════════════════
#
# 1. Go to business.facebook.com → Settings → System Users
# 2. Create a new System User (Admin role)
# 3. Click "Generate New Token"
# 4. Select your App
# 5. Add permissions: whatsapp_business_messaging, whatsapp_business_management
# 6. Set token expiry to "Never"
# 7. Copy the token → paste as WHATSAPP_ACCESS_TOKEN above
#
# This token NEVER expires — your CRM will never stop working.
