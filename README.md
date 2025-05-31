# PocketBase MCP Server

A comprehensive Model Context Protocol (MCP) server that provides tools for managing PocketBase instances. This server enables LLMs to interact with PocketBase databases through a standardized protocol.

## Overview

This MCP server exposes PocketBase functionality as tools that can be used by any MCP-compatible client (like Claude Desktop, Cursor, or other LLM applications). It provides comprehensive access to PocketBase features with 60+ tools covering all major operations.

## Features

### Collection Management
- List, get, create, update, and delete collections
- Import/export collections in bulk
- Full schema management support

### Record Operations
- CRUD operations with filtering, sorting, and pagination
- `getFullList` for retrieving all records without pagination
- `getFirstListItem` for finding the first matching record
- Advanced query support with field selection and relation expansion
- Batch operations for efficient bulk processing

### Authentication & User Management
- Multiple auth methods: password, OAuth2, OTP
- Complete auth flow support: registration, login, password reset, email verification
- Email change functionality
- Auth token refresh
- List available auth methods for collections

### File Management
- Generate file URLs with thumbnail support
- Private file token generation
- Download forcing support

### System Operations
- Health monitoring
- Settings management
- Log viewing with statistics
- Cron job management and execution

### Backup & Restore
- Create, list, download, and delete backups
- Full backup restoration support

### Hook Management
- List, read, create, and delete JavaScript hooks
- Pre-built templates for common patterns

## Installation

```bash
npm install
npm run build
```

## Configuration

The server can be configured to connect to different PocketBase instances using (in order of precedence):

1. **Local config file** (`.pocketbase-mcp.json` in your project directory):
   ```json
   {
     "url": "http://localhost:8091"
   }
   ```

2. **Environment variable**:
   - `POCKETBASE_URL`: URL of your PocketBase instance

3. **Default**: `http://127.0.0.1:8090`

### Multi-Project Setup

#### Option 1: Project-Specific Configuration (Recommended)
Each project can have its own MCP configuration:

```bash
# In project directory
claude mcp add-json pocketbase '{"command": "node", "args": ["/path/to/pocketbase-mcp-server/dist/mcp-server.js"], "env": {"POCKETBASE_URL": "http://localhost:8091"}}' --scope project
```

#### Option 2: Config File
Create a `.pocketbase-mcp.json` in your project root:

```json
{
  "url": "https://api.myproject.com"
}
```

#### Option 3: Multiple Named Servers
Add different PocketBase instances globally:

```bash
claude mcp add-json pb-local '{"command": "node", "args": ["/path/to/pocketbase-mcp-server/dist/mcp-server.js"], "env": {"POCKETBASE_URL": "http://localhost:8090"}}'
claude mcp add-json pb-prod '{"command": "node", "args": ["/path/to/pocketbase-mcp-server/dist/mcp-server.js"], "env": {"POCKETBASE_URL": "https://api.myapp.com"}}'
```

## Usage with Claude Desktop

Add this configuration to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "pocketbase": {
      "command": "node",
      "args": ["/path/to/pocketbase-mcp-server/dist/mcp-server.js"],
      "env": {
        "POCKETBASE_URL": "http://localhost:8090"
      }
    }
  }
}
```

## Available Tools

### Collection Management Tools

- `list_collections` - List all collections with pagination and filtering
- `get_collection` - Get a specific collection by ID or name
- `create_collection` - Create a new collection with schema
- `update_collection` - Update collection settings and schema
- `delete_collection` - Delete a collection
- `import_collections` - Import multiple collections at once

### Record Management Tools

- `list_records` - List records with pagination, filtering, sorting, and field selection
- `get_full_list` - Get all records without pagination (batch processing)
- `get_first_list_item` - Get the first record matching a filter
- `get_record` - Get a specific record by ID
- `create_record` - Create a new record
- `update_record` - Update an existing record
- `delete_record` - Delete a record

### Batch Operations

- `batch_create` - Create multiple records in a single transaction
- `batch_update` - Update multiple records in a single transaction
- `batch_delete` - Delete multiple records in a single transaction
- `batch_upsert` - Upsert multiple records in a single transaction

### Authentication Tools

- `list_auth_methods` - Get available authentication methods
- `auth_with_password` - Authenticate with email/username and password
- `auth_with_oauth2` - Get OAuth2 authentication URL
- `auth_refresh` - Refresh authentication token
- `request_otp` - Request OTP for email authentication
- `auth_with_otp` - Authenticate with OTP
- `request_password_reset` - Send password reset email
- `confirm_password_reset` - Confirm password reset with token
- `request_verification` - Send verification email
- `confirm_verification` - Confirm email verification
- `request_email_change` - Request email change
- `confirm_email_change` - Confirm email change

### File Management Tools

- `get_file_url` - Generate URL for accessing files with options
- `get_file_token` - Get private file access token

### Log Management Tools

- `list_logs` - List system logs with filtering
- `get_log` - Get a specific log entry
- `get_log_stats` - Get log statistics

### Cron Job Tools

- `list_cron_jobs` - List all cron jobs
- `run_cron_job` - Manually run a cron job

### System Tools

- `get_health` - Check PocketBase health status
- `get_settings` - Get PocketBase settings (requires admin auth)
- `update_settings` - Update PocketBase settings (requires admin auth)

### Backup Tools

- `create_backup` - Create a backup
- `list_backups` - List available backups
- `download_backup` - Get download URL for a backup
- `delete_backup` - Delete a backup
- `restore_backup` - Restore from a backup

### Hook Management Tools

- `list_hooks` - List JavaScript hook files in the pb_hooks directory
- `read_hook` - Read the contents of a hook file
- `create_hook` - Create or update a JavaScript hook file
- `delete_hook` - Delete a hook file
- `create_hook_template` - Generate hook templates for common patterns:
  - `record-validation`: Field validation for records
  - `record-auth`: Custom authentication logic
  - `custom-route`: API endpoint creation
  - `file-upload`: File upload validation
  - `scheduled-task`: Cron job setup

## Tool Examples

### List Records with Filtering
```json
{
  "tool": "list_records",
  "arguments": {
    "collection": "posts",
    "filter": "published = true && created >= '2024-01-01'",
    "sort": "-created",
    "expand": "author",
    "fields": "id,title,content,author",
    "skipTotal": true
  }
}
```

### Get All Records Without Pagination
```json
{
  "tool": "get_full_list",
  "arguments": {
    "collection": "categories",
    "sort": "name",
    "batch": 1000
  }
}
```

### Batch Create Records
```json
{
  "tool": "batch_create",
  "arguments": {
    "requests": [
      {
        "collection": "posts",
        "data": {
          "title": "First Post",
          "content": "Content 1"
        }
      },
      {
        "collection": "posts",
        "data": {
          "title": "Second Post",
          "content": "Content 2"
        }
      }
    ]
  }
}
```

### OAuth2 Authentication
```json
{
  "tool": "auth_with_oauth2",
  "arguments": {
    "collection": "users",
    "provider": "google",
    "redirectURL": "https://myapp.com/auth/callback"
  }
}
```

### OTP Authentication Flow
```json
// Step 1: Request OTP
{
  "tool": "request_otp",
  "arguments": {
    "collection": "users",
    "email": "user@example.com"
  }
}

// Step 2: Authenticate with OTP
{
  "tool": "auth_with_otp",
  "arguments": {
    "collection": "users",
    "otpId": "otp_id_from_step_1",
    "password": "123456"
  }
}
```

### Get File URL with Thumbnail
```json
{
  "tool": "get_file_url",
  "arguments": {
    "collection": "products",
    "recordId": "abc123",
    "filename": "photo.jpg",
    "thumb": "300x200"
  }
}
```

### Create a Hook Template
```json
{
  "tool": "create_hook_template",
  "arguments": {
    "type": "record-validation",
    "collection": "posts"
  }
}
```

## Query Syntax

The MCP server supports PocketBase's full query syntax:

### Filter Examples
- `title = "example"` - Exact match
- `created >= "2024-01-01"` - Date comparison
- `title ~ "search"` - Contains text
- `tags ?~ "important"` - Any array element contains
- `user.name = "John"` - Nested field access

### Sort Examples
- `created` - Ascending by created
- `-created` - Descending by created
- `name,-created` - Multiple sort fields

### Expand Examples
- `author` - Expand single relation
- `author,tags` - Expand multiple relations
- `author.profile` - Nested expansion

### Field Selection
- `id,title,content` - Select specific fields
- `*,expand.author.name` - Include expanded fields

## Performance Optimization

- Use `skipTotal: true` when you don't need the total count
- Use `fields` parameter to limit data transfer
- Use `get_full_list` with appropriate batch sizes for large datasets
- Use batch operations for bulk record modifications

## Development

### Running in Development Mode
```bash
npm run dev
```

### Building
```bash
npm run build
```

## Architecture

The MCP server follows the Model Context Protocol specification:

1. **MCP Server**: Handles tool registration and execution
2. **PocketBase Client**: Uses the official PocketBase JavaScript SDK
3. **Tool Handlers**: Implement specific PocketBase operations with proper error handling

## Error Handling

All tools include comprehensive error handling and return descriptive error messages. Common errors include:
- Invalid authentication
- Missing required fields
- Network connectivity issues
- Permission denied errors

## Security Considerations

- Admin operations require appropriate authentication
- Use environment variables for sensitive configuration
- The server inherits PocketBase's security model and access rules
- OAuth2 state parameters are handled securely

## Version Compatibility

- Requires PocketBase v0.20.0 or higher
- Uses PocketBase JavaScript SDK v0.21.0+
- Implements MCP protocol version 1.0

## Contributing

Contributions are welcome! Please ensure that any new tools:
- Follow the existing naming patterns
- Include proper TypeScript types
- Have comprehensive error handling
- Are documented in this README

## License

ISC