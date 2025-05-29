import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Load PocketBase configuration from various sources
 */
export function loadPocketBaseUrl(): string {
  // 1. Check for .pocketbase-mcp.json in current directory
  const localConfigPath = join(process.cwd(), '.pocketbase-mcp.json');
  if (existsSync(localConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(localConfigPath, 'utf-8'));
      if (config.url) {
        console.error(`Using PocketBase URL from local config: ${config.url}`);
        return config.url;
      }
    } catch (e) {
      console.error('Error reading local config:', e);
    }
  }

  // 2. Check environment variables
  const envUrl = process.env.POCKETBASE_URL;
  if (envUrl) {
    console.error(`Using PocketBase URL from environment: ${envUrl}`);
    return envUrl;
  }

  // 3. Default URL
  const defaultUrl = 'http://127.0.0.1:8090';
  console.error(`Using default PocketBase URL: ${defaultUrl}`);
  return defaultUrl;
}