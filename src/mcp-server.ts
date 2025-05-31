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
import { promises as fs } from 'fs';
import path from 'path';

/**
 * PocketBase MCP Server
 * Provides comprehensive tools for managing PocketBase instances through the Model Context Protocol
 */
class PocketBaseMCPServer {
  private server: Server;
  private pb: PocketBase;

  constructor() {
    this.server = new Server(
      {
        name: 'pocketbase-mcp',
        version: '2.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize PocketBase client
    const pbUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
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
        description: 'List all collections with pagination and filtering',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: 'Page number (default: 1)' },
            perPage: { type: 'number', description: 'Records per page (default: 30)' },
            filter: { type: 'string', description: 'Filter expression' },
            sort: { type: 'string', description: 'Sort expression' },
            skipTotal: { type: 'boolean', description: 'Skip total count for performance' },
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
      {
        name: 'import_collections',
        description: 'Import multiple collections at once',
        inputSchema: {
          type: 'object',
          properties: {
            collections: { 
              type: 'array', 
              description: 'Array of collection definitions',
              items: { type: 'object' }
            },
            deleteMissing: { type: 'boolean', description: 'Delete collections not in the import' },
          },
          required: ['collections'],
        },
      },
      // Record Management Tools
      {
        name: 'list_records',
        description: 'List records from a collection with pagination',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name' },
            page: { type: 'number', description: 'Page number (default: 1)' },
            perPage: { type: 'number', description: 'Records per page (default: 30)' },
            filter: { type: 'string', description: 'Filter expression' },
            sort: { type: 'string', description: 'Sort expression' },
            expand: { type: 'string', description: 'Relations to expand' },
            fields: { type: 'string', description: 'Specific fields to return' },
            skipTotal: { type: 'boolean', description: 'Skip total count for performance' },
          },
          required: ['collection'],
        },
      },
      {
        name: 'get_full_list',
        description: 'Get all records from a collection without pagination',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name' },
            batch: { type: 'number', description: 'Batch size (default: 500)' },
            filter: { type: 'string', description: 'Filter expression' },
            sort: { type: 'string', description: 'Sort expression' },
            expand: { type: 'string', description: 'Relations to expand' },
            fields: { type: 'string', description: 'Specific fields to return' },
          },
          required: ['collection'],
        },
      },
      {
        name: 'get_first_list_item',
        description: 'Get the first record matching a filter',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name' },
            filter: { type: 'string', description: 'Filter expression' },
            expand: { type: 'string', description: 'Relations to expand' },
            fields: { type: 'string', description: 'Specific fields to return' },
          },
          required: ['collection', 'filter'],
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
            fields: { type: 'string', description: 'Specific fields to return' },
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
            expand: { type: 'string', description: 'Relations to expand in response' },
            fields: { type: 'string', description: 'Specific fields to return' },
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
            expand: { type: 'string', description: 'Relations to expand in response' },
            fields: { type: 'string', description: 'Specific fields to return' },
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
      // Batch Operations
      {
        name: 'batch_create',
        description: 'Create multiple records in a single transaction',
        inputSchema: {
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              description: 'Array of create requests',
              items: {
                type: 'object',
                properties: {
                  collection: { type: 'string' },
                  data: { type: 'object' },
                },
              },
            },
          },
          required: ['requests'],
        },
      },
      {
        name: 'batch_update',
        description: 'Update multiple records in a single transaction',
        inputSchema: {
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              description: 'Array of update requests',
              items: {
                type: 'object',
                properties: {
                  collection: { type: 'string' },
                  id: { type: 'string' },
                  data: { type: 'object' },
                },
              },
            },
          },
          required: ['requests'],
        },
      },
      {
        name: 'batch_delete',
        description: 'Delete multiple records in a single transaction',
        inputSchema: {
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              description: 'Array of delete requests',
              items: {
                type: 'object',
                properties: {
                  collection: { type: 'string' },
                  id: { type: 'string' },
                },
              },
            },
          },
          required: ['requests'],
        },
      },
      {
        name: 'batch_upsert',
        description: 'Upsert (create or update) multiple records in a single transaction',
        inputSchema: {
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              description: 'Array of upsert requests',
              items: {
                type: 'object',
                properties: {
                  collection: { type: 'string' },
                  data: { type: 'object' },
                },
              },
            },
          },
          required: ['requests'],
        },
      },
      // Authentication Tools
      {
        name: 'list_auth_methods',
        description: 'Get available authentication methods for a collection',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
          },
          required: ['collection'],
        },
      },
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
        name: 'auth_with_oauth2',
        description: 'Get OAuth2 authentication URL',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
            provider: { type: 'string', description: 'OAuth2 provider name' },
            redirectURL: { type: 'string', description: 'Redirect URL after auth' },
            createData: { type: 'object', description: 'Optional data for new users' },
          },
          required: ['collection', 'provider'],
        },
      },
      {
        name: 'auth_refresh',
        description: 'Refresh authentication token',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
          },
          required: ['collection'],
        },
      },
      {
        name: 'request_otp',
        description: 'Request OTP for email authentication',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
            email: { type: 'string', description: 'Email address' },
          },
          required: ['collection', 'email'],
        },
      },
      {
        name: 'auth_with_otp',
        description: 'Authenticate with OTP',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
            otpId: { type: 'string', description: 'OTP ID from request_otp' },
            password: { type: 'string', description: 'OTP code' },
          },
          required: ['collection', 'otpId', 'password'],
        },
      },
      {
        name: 'request_password_reset',
        description: 'Send password reset email',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
            email: { type: 'string', description: 'User email' },
          },
          required: ['collection', 'email'],
        },
      },
      {
        name: 'confirm_password_reset',
        description: 'Confirm password reset with token',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
            token: { type: 'string', description: 'Reset token' },
            password: { type: 'string', description: 'New password' },
            passwordConfirm: { type: 'string', description: 'Password confirmation' },
          },
          required: ['collection', 'token', 'password', 'passwordConfirm'],
        },
      },
      {
        name: 'request_verification',
        description: 'Send verification email',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
            email: { type: 'string', description: 'User email' },
          },
          required: ['collection', 'email'],
        },
      },
      {
        name: 'confirm_verification',
        description: 'Confirm email verification',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
            token: { type: 'string', description: 'Verification token' },
          },
          required: ['collection', 'token'],
        },
      },
      {
        name: 'request_email_change',
        description: 'Request email change',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
            newEmail: { type: 'string', description: 'New email address' },
          },
          required: ['collection', 'newEmail'],
        },
      },
      {
        name: 'confirm_email_change',
        description: 'Confirm email change',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Auth collection name' },
            token: { type: 'string', description: 'Email change token' },
            password: { type: 'string', description: 'User password' },
          },
          required: ['collection', 'token', 'password'],
        },
      },
      // File Management
      {
        name: 'get_file_url',
        description: 'Generate URL for accessing a file',
        inputSchema: {
          type: 'object',
          properties: {
            collection: { type: 'string', description: 'Collection name' },
            recordId: { type: 'string', description: 'Record ID' },
            filename: { type: 'string', description: 'File name' },
            thumb: { type: 'string', description: 'Thumbnail size (e.g., 100x100)' },
            download: { type: 'boolean', description: 'Force download' },
          },
          required: ['collection', 'recordId', 'filename'],
        },
      },
      {
        name: 'get_file_token',
        description: 'Get private file access token',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // Log Management
      {
        name: 'list_logs',
        description: 'List system logs',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: 'Page number' },
            perPage: { type: 'number', description: 'Logs per page' },
            filter: { type: 'string', description: 'Filter expression' },
            sort: { type: 'string', description: 'Sort expression' },
          },
        },
      },
      {
        name: 'get_log',
        description: 'Get a specific log entry',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Log ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_log_stats',
        description: 'Get log statistics',
        inputSchema: {
          type: 'object',
          properties: {
            filter: { type: 'string', description: 'Filter expression' },
          },
        },
      },
      // Cron Jobs
      {
        name: 'list_cron_jobs',
        description: 'List all cron jobs',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'run_cron_job',
        description: 'Manually run a cron job',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string', description: 'Cron job ID' },
          },
          required: ['jobId'],
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
      {
        name: 'update_settings',
        description: 'Update PocketBase settings (requires admin auth)',
        inputSchema: {
          type: 'object',
          properties: {
            settings: { type: 'object', description: 'Settings to update' },
          },
          required: ['settings'],
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
      {
        name: 'upload_backup',
        description: 'Upload a backup file (requires admin auth)',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Backup key/name' },
          },
          required: ['key'],
        },
      },
      {
        name: 'download_backup',
        description: 'Download a backup file (requires admin auth)',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Backup key' },
          },
          required: ['key'],
        },
      },
      {
        name: 'delete_backup',
        description: 'Delete a backup file (requires admin auth)',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Backup key' },
          },
          required: ['key'],
        },
      },
      {
        name: 'restore_backup',
        description: 'Restore from a backup (requires admin auth)',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Backup key' },
          },
          required: ['key'],
        },
      },
      // Hook Management Tools
      {
        name: 'list_hooks',
        description: 'List JavaScript hook files in the pb_hooks directory',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'read_hook',
        description: 'Read the contents of a hook file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Hook file name' },
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
            filename: { type: 'string', description: 'Hook file name' },
            content: { type: 'string', description: 'Hook file content' },
          },
          required: ['filename', 'content'],
        },
      },
      {
        name: 'delete_hook',
        description: 'Delete a hook file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Hook file name' },
          },
          required: ['filename'],
        },
      },
      {
        name: 'create_hook_template',
        description: 'Generate hook templates for common patterns',
        inputSchema: {
          type: 'object',
          properties: {
            type: { 
              type: 'string', 
              enum: ['record-validation', 'record-auth', 'custom-route', 'file-upload', 'scheduled-task'],
              description: 'Template type' 
            },
            collection: { type: 'string', description: 'Collection name (for collection-specific templates)' },
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
          case 'import_collections':
            return await this.importCollections(args);

          // Record Management
          case 'list_records':
            return await this.listRecords(args);
          case 'get_full_list':
            return await this.getFullList(args);
          case 'get_first_list_item':
            return await this.getFirstListItem(args);
          case 'get_record':
            return await this.getRecord(args);
          case 'create_record':
            return await this.createRecord(args);
          case 'update_record':
            return await this.updateRecord(args);
          case 'delete_record':
            return await this.deleteRecord(args);

          // Batch Operations
          case 'batch_create':
            return await this.batchCreate(args);
          case 'batch_update':
            return await this.batchUpdate(args);
          case 'batch_delete':
            return await this.batchDelete(args);
          case 'batch_upsert':
            return await this.batchUpsert(args);

          // Authentication
          case 'list_auth_methods':
            return await this.listAuthMethods(args);
          case 'auth_with_password':
            return await this.authWithPassword(args);
          case 'auth_with_oauth2':
            return await this.authWithOAuth2(args);
          case 'auth_refresh':
            return await this.authRefresh(args);
          case 'request_otp':
            return await this.requestOTP(args);
          case 'auth_with_otp':
            return await this.authWithOTP(args);
          case 'request_password_reset':
            return await this.requestPasswordReset(args);
          case 'confirm_password_reset':
            return await this.confirmPasswordReset(args);
          case 'request_verification':
            return await this.requestVerification(args);
          case 'confirm_verification':
            return await this.confirmVerification(args);
          case 'request_email_change':
            return await this.requestEmailChange(args);
          case 'confirm_email_change':
            return await this.confirmEmailChange(args);

          // File Management
          case 'get_file_url':
            return await this.getFileUrl(args);
          case 'get_file_token':
            return await this.getFileToken();

          // Log Management
          case 'list_logs':
            return await this.listLogs(args);
          case 'get_log':
            return await this.getLog(args);
          case 'get_log_stats':
            return await this.getLogStats(args);

          // Cron Jobs
          case 'list_cron_jobs':
            return await this.listCronJobs();
          case 'run_cron_job':
            return await this.runCronJob(args);

          // Settings and Health
          case 'get_health':
            return await this.getHealth();
          case 'get_settings':
            return await this.getSettings();
          case 'update_settings':
            return await this.updateSettings(args);

          // Backup
          case 'create_backup':
            return await this.createBackup(args);
          case 'list_backups':
            return await this.listBackups();
          case 'upload_backup':
            return await this.uploadBackup(args);
          case 'download_backup':
            return await this.downloadBackup(args);
          case 'delete_backup':
            return await this.deleteBackup(args);
          case 'restore_backup':
            return await this.restoreBackup(args);

          // Hook Management
          case 'list_hooks':
            return await this.listHooks();
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
    const { page = 1, perPage = 30, filter, sort, skipTotal } = args;
    const result = await this.pb.collections.getList(page, perPage, {
      filter,
      sort,
      skipTotal,
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
   * Import collections
   */
  private async importCollections(args: any) {
    const { collections, deleteMissing = false } = args;
    await this.pb.collections.import(collections, deleteMissing);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully imported ${collections.length} collections`,
        },
      ],
    };
  }

  /**
   * List records from a collection
   */
  private async listRecords(args: any) {
    const { collection, page = 1, perPage = 30, filter, sort, expand, fields, skipTotal } = args;
    const result = await this.pb.collection(collection).getList(page, perPage, {
      filter,
      sort,
      expand,
      fields,
      skipTotal,
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
   * Get all records without pagination
   */
  private async getFullList(args: any) {
    const { collection, batch = 500, filter, sort, expand, fields } = args;
    const records = await this.pb.collection(collection).getFullList({
      batch,
      filter,
      sort,
      expand,
      fields,
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(records, null, 2),
        },
      ],
    };
  }

  /**
   * Get first record matching filter
   */
  private async getFirstListItem(args: any) {
    const { collection, filter, expand, fields } = args;
    const record = await this.pb.collection(collection).getFirstListItem(filter, {
      expand,
      fields,
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
   * Get a specific record
   */
  private async getRecord(args: any) {
    const { collection, id, expand, fields } = args;
    const record = await this.pb.collection(collection).getOne(id, {
      expand,
      fields,
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
    const { collection, data, expand, fields } = args;
    const record = await this.pb.collection(collection).create(data, {
      expand,
      fields,
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
   * Update a record
   */
  private async updateRecord(args: any) {
    const { collection, id, data, expand, fields } = args;
    const record = await this.pb.collection(collection).update(id, data, {
      expand,
      fields,
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
   * Batch create records
   */
  private async batchCreate(args: any) {
    const { requests } = args;
    const batch = this.pb.createBatch();
    
    for (const req of requests) {
      batch.collection(req.collection).create(req.data);
    }
    
    const results = await batch.send();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  /**
   * Batch update records
   */
  private async batchUpdate(args: any) {
    const { requests } = args;
    const batch = this.pb.createBatch();
    
    for (const req of requests) {
      batch.collection(req.collection).update(req.id, req.data);
    }
    
    const results = await batch.send();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  /**
   * Batch delete records
   */
  private async batchDelete(args: any) {
    const { requests } = args;
    const batch = this.pb.createBatch();
    
    for (const req of requests) {
      batch.collection(req.collection).delete(req.id);
    }
    
    const results = await batch.send();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  /**
   * Batch upsert records
   */
  private async batchUpsert(args: any) {
    const { requests } = args;
    const batch = this.pb.createBatch();
    
    for (const req of requests) {
      batch.collection(req.collection).upsert(req.data);
    }
    
    const results = await batch.send();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  /**
   * List authentication methods
   */
  private async listAuthMethods(args: any) {
    const { collection } = args;
    const methods = await this.pb.collection(collection).listAuthMethods();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(methods, null, 2),
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
   * Get OAuth2 auth URL
   */
  private async authWithOAuth2(args: any) {
    const { collection, provider, redirectURL, createData } = args;
    const authMethods = await this.pb.collection(collection).listAuthMethods();
    
    const providerData = authMethods.oauth2?.providers?.find(p => p.name === provider);
    if (!providerData) {
      throw new Error(`OAuth2 provider ${provider} not found`);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            authURL: providerData.authURL,
            state: providerData.state,
            codeVerifier: providerData.codeVerifier,
            codeChallenge: providerData.codeChallenge,
            codeChallengeMethod: providerData.codeChallengeMethod,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Refresh authentication
   */
  private async authRefresh(args: any) {
    const { collection } = args;
    const authData = await this.pb.collection(collection).authRefresh();
    
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
   * Request OTP
   */
  private async requestOTP(args: any) {
    const { collection, email } = args;
    const result = await this.pb.collection(collection).requestOTP(email);
    
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
   * Authenticate with OTP
   */
  private async authWithOTP(args: any) {
    const { collection, otpId, password } = args;
    const authData = await this.pb.collection(collection).authWithOTP(otpId, password);
    
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
   * Request password reset
   */
  private async requestPasswordReset(args: any) {
    const { collection, email } = args;
    await this.pb.collection(collection).requestPasswordReset(email);
    
    return {
      content: [
        {
          type: 'text',
          text: `Password reset email sent to ${email}`,
        },
      ],
    };
  }

  /**
   * Confirm password reset
   */
  private async confirmPasswordReset(args: any) {
    const { collection, token, password, passwordConfirm } = args;
    await this.pb.collection(collection).confirmPasswordReset(token, password, passwordConfirm);
    
    return {
      content: [
        {
          type: 'text',
          text: 'Password reset successfully',
        },
      ],
    };
  }

  /**
   * Request verification
   */
  private async requestVerification(args: any) {
    const { collection, email } = args;
    await this.pb.collection(collection).requestVerification(email);
    
    return {
      content: [
        {
          type: 'text',
          text: `Verification email sent to ${email}`,
        },
      ],
    };
  }

  /**
   * Confirm verification
   */
  private async confirmVerification(args: any) {
    const { collection, token } = args;
    await this.pb.collection(collection).confirmVerification(token);
    
    return {
      content: [
        {
          type: 'text',
          text: 'Email verified successfully',
        },
      ],
    };
  }

  /**
   * Request email change
   */
  private async requestEmailChange(args: any) {
    const { collection, newEmail } = args;
    await this.pb.collection(collection).requestEmailChange(newEmail);
    
    return {
      content: [
        {
          type: 'text',
          text: `Email change requested. Confirmation sent to ${newEmail}`,
        },
      ],
    };
  }

  /**
   * Confirm email change
   */
  private async confirmEmailChange(args: any) {
    const { collection, token, password } = args;
    await this.pb.collection(collection).confirmEmailChange(token, password);
    
    return {
      content: [
        {
          type: 'text',
          text: 'Email changed successfully',
        },
      ],
    };
  }

  /**
   * Get file URL
   */
  private async getFileUrl(args: any) {
    const { collection, recordId, filename, thumb, download } = args;
    const record = { id: recordId, collectionName: collection };
    const url = this.pb.files.getURL(record, filename, { thumb, download });
    
    return {
      content: [
        {
          type: 'text',
          text: url,
        },
      ],
    };
  }

  /**
   * Get file token
   */
  private async getFileToken() {
    const token = await this.pb.files.getToken();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ token }, null, 2),
        },
      ],
    };
  }

  /**
   * List logs
   */
  private async listLogs(args: any) {
    const { page = 1, perPage = 30, filter, sort } = args;
    const logs = await this.pb.logs.getList(page, perPage, { filter, sort });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(logs, null, 2),
        },
      ],
    };
  }

  /**
   * Get a specific log
   */
  private async getLog(args: any) {
    const { id } = args;
    const log = await this.pb.logs.getOne(id);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(log, null, 2),
        },
      ],
    };
  }

  /**
   * Get log statistics
   */
  private async getLogStats(args: any) {
    const { filter } = args;
    const stats = await this.pb.logs.getStats({ filter });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  /**
   * List cron jobs
   */
  private async listCronJobs() {
    const jobs = await this.pb.crons.getFullList();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jobs, null, 2),
        },
      ],
    };
  }

  /**
   * Run a cron job
   */
  private async runCronJob(args: any) {
    const { jobId } = args;
    await this.pb.crons.run(jobId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Cron job ${jobId} executed successfully`,
        },
      ],
    };
  }

  /**
   * Get health status
   */
  private async getHealth() {
    const response = await fetch(`${this.pb.baseURL}/api/health`);
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
   * Update settings
   */
  private async updateSettings(args: any) {
    const { settings } = args;
    const updated = await this.pb.settings.update(settings);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(updated, null, 2),
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

  /**
   * Upload backup
   */
  private async uploadBackup(args: any) {
    const { key } = args;
    // Note: This would need actual file handling implementation
    return {
      content: [
        {
          type: 'text',
          text: `Backup upload for ${key} would require file handling implementation`,
        },
      ],
    };
  }

  /**
   * Download backup
   */
  private async downloadBackup(args: any) {
    const { key } = args;
    // Get file token first
    const token = await this.pb.files.getToken();
    const url = this.pb.backups.getDownloadURL(token, key);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ downloadURL: url }, null, 2),
        },
      ],
    };
  }

  /**
   * Delete backup
   */
  private async deleteBackup(args: any) {
    const { key } = args;
    await this.pb.backups.delete(key);
    
    return {
      content: [
        {
          type: 'text',
          text: `Backup ${key} deleted successfully`,
        },
      ],
    };
  }

  /**
   * Restore backup
   */
  private async restoreBackup(args: any) {
    const { key } = args;
    await this.pb.backups.restore(key);
    
    return {
      content: [
        {
          type: 'text',
          text: `Backup ${key} restored successfully`,
        },
      ],
    };
  }

  /**
   * List hook files
   */
  private async listHooks() {
    try {
      // PocketBase looks for hooks in the pb_hooks directory
      const hooksDir = path.join(process.cwd(), 'pb_hooks');
      const files = await fs.readdir(hooksDir);
      const jsFiles = files.filter(f => f.endsWith('.js'));
      
      const hooks = await Promise.all(
        jsFiles.map(async (file) => {
          const stats = await fs.stat(path.join(hooksDir, file));
          return {
            filename: file,
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        })
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(hooks, null, 2),
          },
        ],
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'pb_hooks directory not found' }, null, 2),
            },
          ],
        };
      }
      throw error;
    }
  }

  /**
   * Read a hook file
   */
  private async readHook(args: any) {
    const { filename } = args;
    const hookPath = path.join(process.cwd(), 'pb_hooks', filename);
    
    try {
      const content = await fs.readFile(hookPath, 'utf-8');
      
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Hook file ${filename} not found`);
      }
      throw error;
    }
  }

  /**
   * Create or update a hook file
   */
  private async createHook(args: any) {
    const { filename, content } = args;
    
    // Ensure filename ends with .js
    const hookFilename = filename.endsWith('.js') ? filename : `${filename}.js`;
    const hooksDir = path.join(process.cwd(), 'pb_hooks');
    const hookPath = path.join(hooksDir, hookFilename);
    
    // Create pb_hooks directory if it doesn't exist
    await fs.mkdir(hooksDir, { recursive: true });
    
    // Write the hook file
    await fs.writeFile(hookPath, content, 'utf-8');
    
    return {
      content: [
        {
          type: 'text',
          text: `Hook ${hookFilename} created/updated successfully`,
        },
      ],
    };
  }

  /**
   * Delete a hook file
   */
  private async deleteHook(args: any) {
    const { filename } = args;
    const hookPath = path.join(process.cwd(), 'pb_hooks', filename);
    
    try {
      await fs.unlink(hookPath);
      
      return {
        content: [
          {
            type: 'text',
            text: `Hook ${filename} deleted successfully`,
          },
        ],
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Hook file ${filename} not found`);
      }
      throw error;
    }
  }

  /**
   * Create a hook template
   */
  private async createHookTemplate(args: any) {
    const { type, collection } = args;
    let template = '';
    let filename = '';
    
    switch (type) {
      case 'record-validation':
        filename = `${collection || 'collection'}_validation.pb.js`;
        template = `// Hook for ${collection || 'collection'} record validation
onRecordCreateRequest((e) => {
    // Get the record data
    const data = e.record.originalCopy || e.record;
    
    // Example: Validate a required field
    if (!data.title || data.title.trim() === '') {
        throw new Error('Title is required');
    }
    
    // Example: Validate field length
    if (data.title && data.title.length > 100) {
        throw new Error('Title must be less than 100 characters');
    }
    
    // Example: Custom validation logic
    // if (data.price && data.price < 0) {
    //     throw new Error('Price must be positive');
    // }
}, "${collection || 'collection'}");

onRecordUpdateRequest((e) => {
    // Same validation for updates
    const data = e.record.originalCopy || e.record;
    
    if (!data.title || data.title.trim() === '') {
        throw new Error('Title is required');
    }
    
    if (data.title && data.title.length > 100) {
        throw new Error('Title must be less than 100 characters');
    }
}, "${collection || 'collection'}");
`;
        break;
        
      case 'record-auth':
        filename = `${collection || 'users'}_auth.pb.js`;
        template = `// Custom authentication logic for ${collection || 'users'}
onRecordAuthRequest((e) => {
    // Example: Log authentication attempts
    console.log(\`Authentication attempt for: \${e.identity}\`);
    
    // Example: Add custom validation
    // if (e.identity.includes('blocked')) {
    //     throw new Error('This account has been blocked');
    // }
    
    // Example: Add rate limiting logic
    // You could implement rate limiting by tracking attempts in a custom collection
}, "${collection || 'users'}");

// Hook for after successful authentication
onRecordAfterAuthWithPasswordRequest((e) => {
    // Example: Update last login time
    const record = e.record;
    record.set('lastLogin', new Date().toISOString());
    
    // Save without triggering hooks
    app.dao().saveRecord(record);
    
    // Example: Log successful login
    console.log(\`User \${record.get('email')} logged in successfully\`);
}, "${collection || 'users'}");
`;
        break;
        
      case 'custom-route':
        filename = 'custom_routes.pb.js';
        template = `// Custom API routes
routerAdd("GET", "/api/custom/hello", (e) => {
    // Example: Simple JSON response
    return e.json(200, {
        message: "Hello from custom route!",
        timestamp: new Date().toISOString()
    });
});

// Example: Route with authentication
routerAdd("GET", "/api/custom/user-data", (e) => {
    // Get authenticated user
    const user = e.auth;
    
    if (!user) {
        return e.json(401, { error: "Unauthorized" });
    }
    
    return e.json(200, {
        id: user.id,
        email: user.email,
        created: user.created
    });
}, /* optional middleware */ $apis.requireAuth());

// Example: Route with parameters
routerAdd("GET", "/api/custom/items/:id", (e) => {
    const id = e.request.pathValue("id");
    
    try {
        // Fetch record from database
        const record = app.dao().findRecordById("items", id);
        
        return e.json(200, {
            id: record.id,
            data: record.publicExport()
        });
    } catch (err) {
        return e.json(404, { error: "Item not found" });
    }
});

// Example: POST route with body parsing
routerAdd("POST", "/api/custom/submit", async (e) => {
    // Parse JSON body
    const data = await e.request.json();
    
    // Validate input
    if (!data.name || !data.email) {
        return e.json(400, { error: "Name and email are required" });
    }
    
    // Process the data...
    return e.json(200, { success: true });
});
`;
        break;
        
      case 'file-upload':
        filename = `${collection || 'collection'}_file_upload.pb.js`;
        template = `// File upload validation for ${collection || 'collection'}
onRecordCreateRequest((e) => {
    // Get uploaded files
    const files = e.uploadedFiles;
    
    // Example: Validate file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    
    for (const [fieldName, filesList] of Object.entries(files)) {
        for (const file of filesList) {
            // Check file type
            if (!allowedTypes.includes(file.type)) {
                throw new Error(\`Invalid file type for \${fieldName}: \${file.type}\`);
            }
            
            // Check file size (5MB limit)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                throw new Error(\`File too large for \${fieldName}: \${file.name}\`);
            }
        }
    }
    
    // Example: Ensure at least one image is uploaded
    // if (!files.image || files.image.length === 0) {
    //     throw new Error('At least one image is required');
    // }
}, "${collection || 'collection'}");

// Process files after upload
onRecordAfterCreateRequest((e) => {
    const record = e.record;
    
    // Example: Generate thumbnails or process images
    // This would require additional libraries or external services
    console.log(\`Files uploaded for record \${record.id}\`);
    
    // Example: Update a field based on uploaded files
    // if (record.get('images') && record.get('images').length > 0) {
    //     record.set('hasImages', true);
    //     app.dao().saveRecord(record);
    // }
}, "${collection || 'collection'}");
`;
        break;
        
      case 'scheduled-task':
        filename = 'scheduled_tasks.pb.js';
        template = `// Scheduled tasks using cron
// This runs every hour at minute 0
cronAdd("0 * * * *", "hourly-cleanup", () => {
    // Example: Clean up old sessions or temporary data
    const dao = app.dao();
    
    try {
        // Delete records older than 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        dao.db()
            .newQuery("DELETE FROM temp_data WHERE created < {:date}")
            .bind({ date: yesterday.toISOString() })
            .execute();
            
        console.log("Hourly cleanup completed");
    } catch (err) {
        console.error("Cleanup error:", err);
    }
});

// Daily task at 2 AM
cronAdd("0 2 * * *", "daily-report", () => {
    // Example: Generate daily statistics
    const dao = app.dao();
    
    try {
        // Count new users from yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const today = new Date();
        
        const result = dao.db()
            .newQuery("SELECT COUNT(*) as count FROM users WHERE created >= {:start} AND created < {:end}")
            .bind({ 
                start: yesterday.toISOString().split('T')[0],
                end: today.toISOString().split('T')[0]
            })
            .one();
            
        console.log(\`New users yesterday: \${result.count}\`);
        
        // You could save this to a statistics collection
        // const collection = dao.findCollectionByNameOrId("daily_stats");
        // const record = new Record(collection);
        // record.set("date", yesterday.toISOString().split('T')[0]);
        // record.set("newUsers", result.count);
        // dao.saveRecord(record);
        
    } catch (err) {
        console.error("Daily report error:", err);
    }
});

// Weekly task on Sundays at 3 AM
cronAdd("0 3 * * 0", "weekly-backup-reminder", () => {
    // Example: Send backup reminder
    console.log("Time to create a weekly backup!");
    
    // You could trigger an actual backup here
    // app.createBackup(\`weekly_backup_\${new Date().toISOString().split('T')[0]}.zip\`);
});
`;
        break;
    }
    
    // Create the hook file
    const hooksDir = path.join(process.cwd(), 'pb_hooks');
    await fs.mkdir(hooksDir, { recursive: true });
    await fs.writeFile(path.join(hooksDir, filename), template, 'utf-8');
    
    return {
      content: [
        {
          type: 'text',
          text: `Hook template '${filename}' created with ${type} template`,
        },
      ],
    };
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('PocketBase MCP server v2.1.0 running...');
  }
}

// Start the server
const server = new PocketBaseMCPServer();
server.run().catch(console.error);