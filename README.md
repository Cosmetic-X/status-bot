# status-bot

### At the discord-server

1. Create a channel named `status`
2. Allow the bot following permissions to that channel
   > `View Channel`, `Send Messages`, `Manage Messages`, `Read Message History`

### config.json

```json5
{
	// NOTE: Cosmetic-X discord server id.
	"guild_id": "Snowflake",

	// NOTE: delay in seconds the status data values will ping.
	"refresh_seconds": "integer",

	// NOTE: status data.
	"sites": {
		"display name": "domain.tld/uri"
	}
}
```