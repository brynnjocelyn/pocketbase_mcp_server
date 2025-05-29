#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import PocketBase from 'pocketbase';
import { z } from 'zod';
import { loadPocketBaseUrl } from './config-loader.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

/**
 * PocketBase MCP Server
 * Provides tools for managing PocketBase instances through the Model Context Protocol
 */
class PocketBaseMCPServer {
  private server: Server;
  private pb: PocketBase;

  constructor() {
    this.server = new Server(
      {
        name: 'pocketbase-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize PocketBase client using config loader
    const pbUrl = loadPocketBaseUrl();
    this.pb = new PocketBase(pbUrl);

    this.setupToolHandlers();
  }

  /**
   * Define all available PocketBase tools
   */
  private getTools(): Tool[] {
    return [
      // Collection Management Tools
      {
        name: 'list_collections',
        description: 'List all collections in PocketBase',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: 'Page number (default: 1)' },
            perPage: { type: 'number', description: 'Records per page (default: 30)' },
            filter: { type: 'string', description: 'Filter expression' },
            sort: { type: 'string', description: 'Sort expression' },
          },
        },
      },
      {
        name: 'get_collection',
        description: 'Get a specific collection by ID or name',
        inputSchema: {
          type: 'object',
          properties: {
            idOrName: { type: 'string', description: 'Collection ID or name' },
          },
          required: ['idOrName'],
        },
      },
      {
        name: 'create_collection',
        description: 'Create a new collection',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Collection name' },
            type: { type: 'string', enum: ['base', 'auth'], description: 'Collection type' },
            schema: {
              type: 'array',
              description: 'Collection schema fields',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  required: { type: 'boolean' },
                  options: { type: 'object' },
                },
              },
            },
            listRule: { type: 'string', description: 'List access rule' },
            viewRule: { type: 'string', description: 'View access rule' },
            createRule: { type: 'string', description: 'Create access rule' },
            updateRule: { type: 'string', description: 'Update access rule' },
            deleteRule: { type: 'string', description: 'Delete access rule' },
          },
          required: ['name', 'type'],
        },
      },
      {
        name: 'update_collection',
        description: 'Update an existing collection',
        inputSchema: {
          type: 'object',
          properties: {
            idOrName: { type: 'string', description: 'Collection ID or name' },
            data: {
              type: 'object',
              description: 'Collection update data',
              properties: {
                name: { type: 'string' },
                schema: { type: 'array' },
                listRule: { type: 'string' },
                viewRule: { type: 'string' },
                createRule: { type: 'string' },
                updateRule: { type: 'string' },
                deleteRule: { type: 'string' },
              },
            },
          },
          required: ['idOrName', 'data'],
        },
      },
      {
        name: 'delete_collection',
        description: 'Delete a collection',
        inputSchema: {
          type: 'object',
          properties: {
            idOrName: { type: 'string', description: 'Collection ID or name' },
          },
          required: ['idOrName'],
        },
      },
      // Record Management Tools
      {
        name: 'list_records',
        description: 'List records from a collection',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name' },
            page: { type: 'number', description: 'Page number (default: 1)' },
            perPage: { type: 'number', description: 'Records per page (default: 30)' },
            filter: { type: 'string', description: 'Filter expression' },
            sort: { type: 'string', description: 'Sort expression' },
            expand: { type: 'string', description: 'Relations to expand' },
          },
          required: ['collection'],
        },
      },
      {
        name: 'get_record',
        description: 'Get a specific record by ID',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name' },
            id: { type: 'string', description: 'Record ID' },
            expand: { type: 'string', description: 'Relations to expand' },
          },
          required: ['collection', 'id'],
        },
      },
      {
        name: 'create_record',
        description: 'Create a new record in a collection',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name' },
            data: { type: 'object', description: 'Record data' },
          },
          required: ['collection', 'data'],
        },
      },
      {
        name: 'update_record',
        description: 'Update an existing record',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name' },
            id: { type: 'string', description: 'Record ID' },
            data: { type: 'object', description: 'Update data' },
          },
          required: ['collection', 'id', 'data'],
        },
      },
      {
        name: 'delete_record',
        description: 'Delete a record',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name' },
            id: { type: 'string', description: 'Record ID' },
          },
          required: ['collection', 'id'],
        },
      },
      // Authentication Tools
      {
        name: 'auth_with_password',
        description: 'Authenticate with email/username and password',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name (default: users)' },
            identity: { type: 'string', description: 'Email or username' },
            password: { type: 'string', description: 'Password' },
          },
          required: ['identity', 'password'],
        },
      },
      {
        name: 'create_user',
        description: 'Create a new user in an auth collection',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name (default: users)' },
            email: { type: 'string', description: 'User email' },
            password: { type: 'string', description: 'User password' },
            passwordConfirm: { type: 'string', description: 'Password confirmation' },
            data: { type: 'object', description: 'Additional user data' },
          },
          required: ['email', 'password', 'passwordConfirm'],
        },
      },
      // Settings and Health
      {
        name: 'get_health',
        description: 'Check PocketBase health status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_settings',
        description: 'Get PocketBase settings (requires admin auth)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // Backup Tools
      {
        name: 'create_backup',
        description: 'Create a backup of PocketBase data (requires admin auth)',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Backup name' },
          },
        },
      },
      {
        name: 'list_backups',
        description: 'List available backups (requires admin auth)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // Hook Management Tools
      {
        name: 'list_hooks',
        description: 'List JavaScript hook files in the pb_hooks directory',
        inputSchema: {
          type: 'object',
          properties: {
            pbDataPath: { type: 'string', description: 'Path to PocketBase data directory (optional)' },
          },
        },
      },
      {
        name: 'read_hook',
        description: 'Read the contents of a JavaScript hook file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Hook filename (e.g., main.pb.js)' },
            pbDataPath: { type: 'string', description: 'Path to PocketBase data directory (optional)' },
          },
          required: ['filename'],
        },
      },
      {
        name: 'create_hook',
        description: 'Create or update a JavaScript hook file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Hook filename (must end with .pb.js)' },
            content: { type: 'string', description: 'JavaScript code for the hook' },
            pbDataPath: { type: 'string', description: 'Path to PocketBase data directory (optional)' },
          },
          required: ['filename', 'content'],
        },
      },
      {
        name: 'delete_hook',
        description: 'Delete a JavaScript hook file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Hook filename to delete' },
            pbDataPath: { type: 'string', description: 'Path to PocketBase data directory (optional)' },
          },
          required: ['filename'],
        },
      },
      {
        name: 'create_hook_template',
        description: 'Generate a hook template for common patterns',
        inputSchema: {
          type: 'object',
          properties: {
            type: { 
              type: 'string', 
              enum: ['record-validation', 'record-auth', 'custom-route', 'file-upload', 'scheduled-task'],
              description: 'Type of hook template to generate' 
            },
            collection: { type: 'string', description: 'Collection name (for record hooks)' },
            route: { type: 'string', description: 'Route path (for custom routes)' },
          },
          required: ['type'],
        },
      },
    ];
  }

  /**
   * Set up request handlers for the MCP server
   */
  private setupToolHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // Collection Management
          case 'list_collections':
            return await this.listCollections(args);
          case 'get_collection':
            return await this.getCollection(args);
          case 'create_collection':
            return await this.createCollection(args);
          case 'update_collection':
            return await this.updateCollection(args);
          case 'delete_collection':
            return await this.deleteCollection(args);

          // Record Management
          case 'list_records':
            return await this.listRecords(args);
          case 'get_record':
            return await this.getRecord(args);
          case 'create_record':
            return await this.createRecord(args);
          case 'update_record':
            return await this.updateRecord(args);
          case 'delete_record':
            return await this.deleteRecord(args);

          // Authentication
          case 'auth_with_password':
            return await this.authWithPassword(args);
          case 'create_user':
            return await this.createUser(args);

          // Settings and Health
          case 'get_health':
            return await this.getHealth();
          case 'get_settings':
            return await this.getSettings();

          // Backup
          case 'create_backup':
            return await this.createBackup(args);
          case 'list_backups':
            return await this.listBackups();

          // Hook Management
          case 'list_hooks':
            return await this.listHooks(args);
          case 'read_hook':
            return await this.readHook(args);
          case 'create_hook':
            return await this.createHook(args);
          case 'delete_hook':
            return await this.deleteHook(args);
          case 'create_hook_template':
            return await this.createHookTemplate(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  // Tool implementations

  /**
   * List all collections
   */
  private async listCollections(args: any) {
    const { page = 1, perPage = 30, filter, sort } = args;
    const result = await this.pb.collections.getList(page, perPage, {
      filter,
      sort,
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Get a specific collection
   */
  private async getCollection(args: any) {
    const { idOrName } = args;
    const collection = await this.pb.collections.getOne(idOrName);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(collection, null, 2),
        },
      ],
    };
  }

  /**
   * Create a new collection
   */
  private async createCollection(args: any) {
    const collection = await this.pb.collections.create(args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(collection, null, 2),
        },
      ],
    };
  }

  /**
   * Update a collection
   */
  private async updateCollection(args: any) {
    const { idOrName, data } = args;
    const collection = await this.pb.collections.update(idOrName, data);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(collection, null, 2),
        },
      ],
    };
  }

  /**
   * Delete a collection
   */
  private async deleteCollection(args: any) {
    const { idOrName } = args;
    await this.pb.collections.delete(idOrName);
    
    return {
      content: [
        {
          type: 'text',
          text: `Collection ${idOrName} deleted successfully`,
        },
      ],
    };
  }

  /**
   * List records from a collection
   */
  private async listRecords(args: any) {
    const { collection, page = 1, perPage = 30, filter, sort, expand } = args;
    const result = await this.pb.collection(collection).getList(page, perPage, {
      filter,
      sort,
      expand,
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Get a specific record
   */
  private async getRecord(args: any) {
    const { collection, id, expand } = args;
    const record = await this.pb.collection(collection).getOne(id, {
      expand,
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(record, null, 2),
        },
      ],
    };
  }

  /**
   * Create a record
   */
  private async createRecord(args: any) {
    const { collection, data } = args;
    const record = await this.pb.collection(collection).create(data);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(record, null, 2),
        },
      ],
    };
  }

  /**
   * Update a record
   */
  private async updateRecord(args: any) {
    const { collection, id, data } = args;
    const record = await this.pb.collection(collection).update(id, data);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(record, null, 2),
        },
      ],
    };
  }

  /**
   * Delete a record
   */
  private async deleteRecord(args: any) {
    const { collection, id } = args;
    await this.pb.collection(collection).delete(id);
    
    return {
      content: [
        {
          type: 'text',
          text: `Record ${id} deleted from ${collection}`,
        },
      ],
    };
  }

  /**
   * Authenticate with password
   */
  private async authWithPassword(args: any) {
    const { collection = 'users', identity, password } = args;
    const authData = await this.pb.collection(collection).authWithPassword(identity, password);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            token: authData.token,
            user: authData.record,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Create a new user
   */
  private async createUser(args: any) {
    const { collection = 'users', email, password, passwordConfirm, data = {} } = args;
    const userData = {
      email,
      password,
      passwordConfirm,
      ...data,
    };
    
    const user = await this.pb.collection(collection).create(userData);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(user, null, 2),
        },
      ],
    };
  }

  /**
   * Get health status
   */
  private async getHealth() {
    const response = await fetch(`${this.pb.baseUrl}/api/health`);
    const health = await response.json();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(health, null, 2),
        },
      ],
    };
  }

  /**
   * Get settings (requires admin auth)
   */
  private async getSettings() {
    const settings = await this.pb.settings.getAll();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(settings, null, 2),
        },
      ],
    };
  }

  /**
   * Create a backup
   */
  private async createBackup(args: any) {
    const { name } = args;
    const backup = await this.pb.backups.create(name);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(backup, null, 2),
        },
      ],
    };
  }

  /**
   * List backups
   */
  private async listBackups() {
    const backups = await this.pb.backups.getFullList();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(backups, null, 2),
        },
      ],
    };
  }

  // Hook Management Methods

  /**
   * Get the pb_hooks directory path
   */
  private getHooksPath(pbDataPath?: string): string {
    // If specific path provided, use it
    if (pbDataPath) {
      return path.join(pbDataPath, 'pb_hooks');
    }
    
    // Try to infer from PocketBase URL
    const pbUrl = new URL(this.pb.baseUrl);
    if (pbUrl.hostname === 'localhost' || pbUrl.hostname === '127.0.0.1') {
      // Assume local installation next to current directory
      return path.join(process.cwd(), 'pb_hooks');
    }
    
    // Default to current directory
    return path.join(process.cwd(), 'pb_hooks');
  }

  /**
   * List all hook files
   */
  private async listHooks(args: any) {
    const hooksPath = this.getHooksPath(args.pbDataPath);
    
    try {
      if (!existsSync(hooksPath)) {
        return {
          content: [{
            type: 'text',
            text: `No pb_hooks directory found at ${hooksPath}. Create it next to your PocketBase executable.`,
          }],
        };
      }

      const files = await fs.readdir(hooksPath);
      const hookFiles = files.filter(f => f.endsWith('.pb.js'));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            path: hooksPath,
            hooks: hookFiles,
            count: hookFiles.length,
          }, null, 2),
        }],
      };
    } catch (error) {
      throw new Error(`Failed to list hooks: ${error}`);
    }
  }

  /**
   * Read a hook file
   */
  private async readHook(args: any) {
    const { filename, pbDataPath } = args;
    const hooksPath = this.getHooksPath(pbDataPath);
    const filePath = path.join(hooksPath, filename);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      return {
        content: [{
          type: 'text',
          text: content,
        }],
      };
    } catch (error) {
      throw new Error(`Failed to read hook ${filename}: ${error}`);
    }
  }

  /**
   * Create or update a hook file
   */
  private async createHook(args: any) {
    const { filename, content, pbDataPath } = args;
    
    // Validate filename
    if (!filename.endsWith('.pb.js')) {
      throw new Error('Hook filename must end with .pb.js');
    }
    
    const hooksPath = this.getHooksPath(pbDataPath);
    const filePath = path.join(hooksPath, filename);
    
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(hooksPath, { recursive: true });
      
      // Write the hook file
      await fs.writeFile(filePath, content, 'utf-8');
      
      return {
        content: [{
          type: 'text',
          text: `Hook ${filename} created/updated successfully at ${filePath}`,
        }],
      };
    } catch (error) {
      throw new Error(`Failed to create hook ${filename}: ${error}`);
    }
  }

  /**
   * Delete a hook file
   */
  private async deleteHook(args: any) {
    const { filename, pbDataPath } = args;
    const hooksPath = this.getHooksPath(pbDataPath);
    const filePath = path.join(hooksPath, filename);
    
    try {
      await fs.unlink(filePath);
      
      return {
        content: [{
          type: 'text',
          text: `Hook ${filename} deleted successfully`,
        }],
      };
    } catch (error) {
      throw new Error(`Failed to delete hook ${filename}: ${error}`);
    }
  }

  /**
   * Generate hook templates
   */
  private async createHookTemplate(args: any) {
    const { type, collection, route } = args;
    let template = '';
    
    switch (type) {
      case 'record-validation':
        template = `/// <reference path="../pb_data/types.d.ts" />

// Validate records before create/update for ${collection || 'COLLECTION_NAME'}
onRecordCreateRequest((e) => {
    // Add validation logic here
    if (!e.record.get('title') || e.record.get('title').length < 3) {
        throw new Error('Title must be at least 3 characters long');
    }
    
    // Set default values
    if (!e.record.get('status')) {
        e.record.set('status', 'draft');
    }
    
    e.next();
}, '${collection || 'COLLECTION_NAME'}');

onRecordUpdateRequest((e) => {
    // Add validation logic here
    if (e.record.get('status') === 'published' && !e.record.get('publishedAt')) {
        e.record.set('publishedAt', new Date().toISOString());
    }
    
    // Prevent status change after publish
    if (e.record.originalCopy().get('status') === 'published' && 
        e.record.get('status') !== 'published') {
        throw new Error('Cannot change status after publishing');
    }
    
    e.next();
}, '${collection || 'COLLECTION_NAME'}');`;
        break;
        
      case 'record-auth':
        template = `/// <reference path="../pb_data/types.d.ts" />

// Custom authentication logic for ${collection || 'users'}
onRecordAuthRequest((e) => {
    // Triggered on each successful auth request (sign-in, token refresh, etc.)
    console.log('User authenticated:', e.record.get('email'));
    
    // Add custom logic here
    // e.record - the authenticated record
    // e.token - the auth token
    // e.meta - auth meta data
    // e.authMethod - the auth method used
    
    // Example: Add custom claims to token
    e.meta.lastLogin = new Date().toISOString();
    
    e.next();
}, '${collection || 'users'}');

// Handle password authentication
onRecordAuthWithPasswordRequest((e) => {
    // e.identity - submitted email/username
    // e.password - submitted password
    // e.record - found record (could be null)
    
    if (e.record) {
        // Log login attempt
        console.log('Password auth attempt for:', e.identity);
        
        // Update last login
        e.record.set('lastLoginAt', new Date().toISOString());
        $app.save(e.record);
    }
    
    e.next();
}, '${collection || 'users'}');`;
        break;
        
      case 'custom-route':
        template = `/// <reference path="../pb_data/types.d.ts" />

// Custom API endpoint
routerAdd('GET', '${route || '/api/custom/:id'}', (e) => {
    // Get path parameters
    const id = e.request.pathValue('id');
    
    // Get query parameters
    const filter = e.request.url.searchParams.get('filter');
    
    // Example: fetch data
    try {
        const record = $app.findRecordById('COLLECTION_NAME', id);
        
        return e.json(200, {
            success: true,
            data: record,
        });
    } catch (error) {
        return e.json(404, {
            success: false,
            error: 'Record not found',
        });
    }
});

// Protected route with auth
routerAdd('POST', '${route || '/api/protected'}', (e) => {
    // Require authentication
    const auth = e.requestInfo.auth;
    if (!auth) {
        return e.json(401, { error: 'Unauthorized' });
    }
    
    // Get JSON body
    const data = e.requestInfo.body;
    
    // Process request...
    
    return e.json(200, { success: true });
}, $apis.requireAuth());`;
        break;
        
      case 'file-upload':
        template = `/// <reference path="../pb_data/types.d.ts" />

// Handle file uploads for ${collection || 'COLLECTION_NAME'}
onRecordCreateRequest((e) => {
    // Get uploaded files from request
    const uploadedFiles = e.files();
    
    // Process each file field
    for (const [fieldName, files] of Object.entries(uploadedFiles)) {
        for (const file of files) {
            // Get file extension
            const ext = file.originalFilename.split('.').pop().toLowerCase();
            const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];
            
            if (!allowedTypes.includes(ext)) {
                throw new Error(\`File type .\${ext} not allowed for field \${fieldName}\`);
            }
            
            // Check file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                throw new Error(\`File size must be less than 5MB for field \${fieldName}\`);
            }
        }
    }
    
    e.next();
}, '${collection || 'COLLECTION_NAME'}');

onRecordUpdateRequest((e) => {
    // Same validation for updates
    const uploadedFiles = e.files();
    
    for (const [fieldName, files] of Object.entries(uploadedFiles)) {
        for (const file of files) {
            const ext = file.originalFilename.split('.').pop().toLowerCase();
            const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];
            
            if (!allowedTypes.includes(ext)) {
                throw new Error(\`File type .\${ext} not allowed for field \${fieldName}\`);
            }
            
            if (file.size > 5 * 1024 * 1024) {
                throw new Error(\`File size must be less than 5MB for field \${fieldName}\`);
            }
        }
    }
    
    e.next();
}, '${collection || 'COLLECTION_NAME'}');`;
        break;
        
      case 'scheduled-task':
        template = `/// <reference path="../pb_data/types.d.ts" />

// Scheduled task - runs every hour
cronAdd('hourly-task', '0 * * * *', () => {
    console.log('Running hourly task...');
    
    try {
        // Example: Clean up old records
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const oldRecords = $app.findRecordsByFilter(
            'COLLECTION_NAME',
            \`created < "\${thirtyDaysAgo.toISOString()}" && status = "expired"\`
        );
        
        for (const record of oldRecords) {
            $app.delete(record);
        }
        
        console.log(\`Cleaned up \${oldRecords.length} expired records\`);
    } catch (error) {
        console.error('Scheduled task error:', error);
    }
});

// Daily task at 2 AM
cronAdd('daily-backup', '0 2 * * *', () => {
    try {
        $app.createBackup(\`scheduled-backup-\${new Date().toISOString().split('T')[0]}.zip\`);
        console.log('Daily backup created');
    } catch (error) {
        console.error('Backup failed:', error);
    }
});`;
        break;
        
      default:
        throw new Error(`Unknown template type: ${type}`);
    }
    
    return {
      content: [{
        type: 'text',
        text: template,
      }],
    };
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('PocketBase MCP server running...');
  }
}

// Start the server
const server = new PocketBaseMCPServer();
server.run().catch(console.error);