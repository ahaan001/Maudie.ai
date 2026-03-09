module.exports = {
  apps: [
    {
      name: 'maudie-ai',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/home/maudie/apps/maudie.ai',
      instances: 1,
      exec_mode: 'fork',
      env_file: '/home/maudie/apps/maudie.ai/.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
      error_file: '/home/maudie/logs/maudie-error.log',
      out_file: '/home/maudie/logs/maudie-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
