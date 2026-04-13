import os
import requests

def send_slack_notification(question, votes, moderator_summary):
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        print("No Slack webhook configured")
        return

    vote_text = "\n".join([f"• {agent}: *{vote}*" for agent, vote in votes.items()])

    message = {
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "🏛️ Shadow Board Session Complete"}
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Strategic Question:*\n{question}"}
            },
            {"type": "divider"},
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Board Vote:*\n{vote_text}"}
            },
            {"type": "divider"},
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Executive Summary:*\n{moderator_summary[:500]}"}
            },
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": "Shadow Board by Agent Quorum | Powered by AIRIA"}]
            }
        ]
    }

    try:
        response = requests.post(webhook_url, json=message)
        print(f"Slack notification sent: {response.status_code}")
    except Exception as e:
        print(f"Slack error: {e}")