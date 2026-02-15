# CI Secrets Checklist

## Currently Required Secrets

The test pipeline (`test.yml`) does not require any secrets. It uses only public GitHub Actions.

## Optional Secrets (for future features)

### Slack Notifications

If you enable failure notifications:

| Secret | Purpose | Where to get it |
|--------|---------|-----------------|
| `SLACK_WEBHOOK` | Post failure alerts to a Slack channel | Slack App > Incoming Webhooks |

**Configure at:** Repository Settings > Secrets and variables > Actions > New repository secret

### Security Best Practices

- Never commit secrets to the repository
- Use GitHub's encrypted secrets for all sensitive values
- Rotate secrets periodically
- Use environment-scoped secrets when possible
- Review secret access in repository audit logs
