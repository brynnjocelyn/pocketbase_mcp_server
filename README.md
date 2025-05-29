# PocketBase MCP Server

A Model Context Protocol (MCP) server that provides tools for managing PocketBase instances. This server enables LLMs to interact with PocketBase databases through a standardized protocol.

## Overview

This MCP server exposes PocketBase functionality as tools that can be used by any MCP-compatible client (like Claude Desktop, Cursor, or other LLM applications). It provides comprehensive access to PocketBase features including:

- Collection management (CRUD operations)
- Record management with filtering and pagination
- Authentication and user management
- Settings and health monitoring
- Backup operations

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

## Usage

### As an MCP Server

To use with Claude Desktop or other MCP clients, add this to your MCP settings:

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

### Available Tools

#### Collection Management

- **list_collections**: List all collections with pagination and filtering
- **get_collection**: Get a specific collection by ID or name
- **create_collection**: Create a new collection with schema
- **update_collection**: Update collection settings and schema
- **delete_collection**: Delete a collection

#### Record Management

- **list_records**: List records from a collection with filtering, sorting, and pagination
- **get_record**: Get a specific record by ID
- **create_record**: Create a new record
- **update_record**: Update an existing record
- **delete_record**: Delete a record

#### Authentication

- **auth_with_password**: Authenticate using email/username and password
- **create_user**: Create a new user in an auth collection

#### System

- **get_health**: Check PocketBase health status
- **get_settings**: Get PocketBase settings (requires admin auth)
- **create_backup**: Create a backup (requires admin auth)
- **list_backups**: List available backups (requires admin auth)

#### Hook Management

- **list_hooks**: List JavaScript hook files in the pb_hooks directory
- **read_hook**: Read the contents of a hook file
- **create_hook**: Create or update a JavaScript hook file
- **delete_hook**: Delete a hook file
- **create_hook_template**: Generate hook templates for common patterns:
  - `record-validation`: Field validation for records
  - `record-auth`: Custom authentication logic
  - `custom-route`: API endpoint creation
  - `file-upload`: File upload validation
  - `scheduled-task`: Cron job setup

## Tool Examples

### List Collections
```json
{
  "tool": "list_collections",
  "arguments": {
    "page": 1,
    "perPage": 10,
    "filter": "type = 'auth'"
  }
}
```

### Create a Record
```json
{
  "tool": "create_record",
  "arguments": {
    "collection": "posts",
    "data": {
      "title": "My First Post",
      "content": "Hello, world!",
      "published": true
    }
  }
}
```

### Query Records with Filtering
```json
{
  "tool": "list_records",
  "arguments": {
    "collection": "posts",
    "filter": "published = true && created >= '2024-01-01'",
    "sort": "-created",
    "expand": "author"
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

### Create a Custom Hook
```json
{
  "tool": "create_hook",
  "arguments": {
    "filename": "posts-validation.pb.js",
    "content": "// Custom validation code here..."
  }
}
```

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
2. **PocketBase Client**: Communicates with PocketBase instance
3. **Tool Handlers**: Implement specific PocketBase operations

## Security Considerations

- The server requires appropriate authentication for admin operations
- Use environment variables to configure sensitive settings
- Consider implementing additional access controls based on your use case

## Contributing

Contributions are welcome! Please ensure that any new tools follow the existing patterns and include proper error handling.

## License

ISC