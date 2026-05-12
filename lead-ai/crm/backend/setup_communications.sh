#!/bin/bash

# Communication Integrations Setup Script
# Installs dependencies and runs database migration

echo "📱 Setting up Communication Integrations..."
echo ""

# Check if in backend directory
if [ ! -f "requirements.txt" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    exit 1
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install twilio sendgrid requests

# Run database migration
echo ""
echo "🗄️ Creating communication_history table..."
python migrate_communication_history.py

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.communications.example to your .env file"
echo "2. Add your Twilio and email credentials"
echo "3. Restart the backend server"
echo "4. Test in the LeadsPage UI"
echo ""
echo "See COMMUNICATION_SETUP_GUIDE.md for detailed instructions"
