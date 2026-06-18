/**
 * PM2 Ecosystem Configuration for AI-CRM
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart ai-crm
 *   pm2 logs ai-crm
 *   pm2 save (to persist across reboots)
 *
 * Created: 2025-12-28
 * Mission: MISSION-20251228-L7WFOB (TASK-005)
 */

module.exports = {
  apps: [
    {
      name: 'ai-crm',
      script: 'npm',
      args: 'run start',
      cwd: '/home/kei/www/ai-crm',
      env: {
        PORT: 3002,
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/kei/logs/ai-crm-error.log',
      out_file: '/home/kei/logs/ai-crm-out.log',
      merge_logs: true,
      restart_delay: 1000,
    },
  ],
};
