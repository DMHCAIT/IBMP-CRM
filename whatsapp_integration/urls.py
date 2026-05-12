from django.urls import path
from . import views

urlpatterns = [
    # Meta webhook — both GET (verification) and POST (incoming messages)
    path("webhook/", views.webhook, name="whatsapp_webhook"),

    # Send a message to a lead
    path("send/", views.send_message, name="whatsapp_send"),

    # Get full chat history with a lead
    path("history/<str:phone_number>/", views.get_chat_history, name="whatsapp_history"),

    # Mark messages as read when agent opens chat
    path("mark-read/", views.mark_messages_read, name="whatsapp_mark_read"),
]

# In your main urls.py add:
# path("api/whatsapp/", include("whatsapp_integration.urls")),
