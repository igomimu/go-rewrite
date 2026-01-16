/**
 * VERSIONING RULES:
 * 
 * [Development Version] (e.g., v39.1.13)
 * - Used for internal tracking, G-diary, and displayed during development.
 * - Format: v[Major].[Workflow].[Task]
 * 
 * [Public Version] (e.g., 1.5.0)
 * - Used for public releases in manifest.json and package.json.
 * - Format: [Semi-Major].[Feature].[Fix]
 * 
 * DO NOT CONFUSE THESE TWO.
 * When releasing for public, ensure manifest.json version matches the PUBLIC version.
 */

export const APP_VERSION = "1.5.1";       // Public official version
export const DEV_VERSION = "v39.1.15";     // Detailed development version
